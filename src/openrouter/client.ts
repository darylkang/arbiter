import { setTimeout as delay } from "node:timers/promises";

export type OpenRouterMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type ChatCompletionParams = {
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
};

export type TokenUsage = {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost?: number;
};

export interface OpenRouterRequestOptions {
  apiKey?: string;
  baseUrl?: string;
  signal?: AbortSignal;
  retry?: {
    maxRetries: number;
    backoffMs: number;
    maxBackoffMs?: number;
    jitter?: "none" | "full";
  };
}

export interface ChatCompletionResult {
  requestPayload: Record<string, unknown>;
  responseBody: unknown;
  headers: Record<string, string>;
  latencyMs: number;
  retryCount: number;
  modelHeader: string | null;
  model: string | null;
  responseId: string | null;
  usage: TokenUsage | null;
}

export interface EmbeddingResult {
  requestPayload: Record<string, unknown>;
  responseBody: unknown;
  headers: Record<string, string>;
  latencyMs: number;
  retryCount: number;
  vector: number[];
  modelHeader: string | null;
  model: string | null;
  generationId: string | null;
}

export interface ModelsListResult {
  responseBody: unknown;
  headers: Record<string, string>;
  latencyMs: number;
}

export class OpenRouterError extends Error {
  status?: number;
  code?: string;
  retryable: boolean;
  modelUnavailable: boolean;
  responseBody?: unknown;
  headers?: Record<string, string>;
  latencyMs?: number;
  retryCount: number;
  requestPayload?: Record<string, unknown>;

  constructor(message: string, options: {
    status?: number;
    code?: string;
    retryable: boolean;
    modelUnavailable: boolean;
    responseBody?: unknown;
    headers?: Record<string, string>;
    latencyMs?: number;
    retryCount: number;
    requestPayload?: Record<string, unknown>;
  }) {
    super(message);
    this.status = options.status;
    this.code = options.code;
    this.retryable = options.retryable;
    this.modelUnavailable = options.modelUnavailable;
    this.responseBody = options.responseBody;
    this.headers = options.headers;
    this.latencyMs = options.latencyMs;
    this.retryCount = options.retryCount;
    this.requestPayload = options.requestPayload;
  }
}

const resolveBaseUrl = (baseUrl?: string): string =>
  (baseUrl ?? process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1").replace(/\/$/, "");

const resolveApiKey = (apiKey?: string): string | undefined =>
  apiKey ?? process.env.OPENROUTER_API_KEY;

const toHeaderRecord = (headers: Headers): Record<string, string> => {
  const record: Record<string, string> = {};
  headers.forEach((value, key) => {
    record[key.toLowerCase()] = value;
  });
  return record;
};

const parseJsonBody = async (response: Response): Promise<unknown> => {
  const text = await response.text();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
};

const requestGet = async (
  path: string,
  options: OpenRouterRequestOptions
): Promise<{ responseBody: unknown; headers: Record<string, string>; latencyMs: number }> => {
  const apiKey = resolveApiKey(options.apiKey);
  if (!apiKey) {
    throw new OpenRouterError("OPENROUTER_API_KEY is required", {
      retryable: false,
      modelUnavailable: false,
      retryCount: 0
    });
  }
  const baseUrl = resolveBaseUrl(options.baseUrl);
  const started = Date.now();
  const response = await fetch(`${baseUrl}${path}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`
    },
    signal: options.signal
  });
  const latencyMs = Date.now() - started;
  const responseBody = await parseJsonBody(response);
  const headers = toHeaderRecord(response.headers);

  if (response.ok) {
    return { responseBody, headers, latencyMs };
  }

  const classification = classifyError(response.status, responseBody);
  throw new OpenRouterError(
    classification.message ?? `OpenRouter request failed with status ${response.status}`,
    {
      status: response.status,
      code: classification.code,
      retryable: classification.retryable,
      modelUnavailable: classification.modelUnavailable,
      responseBody,
      headers,
      latencyMs,
      retryCount: 0
    }
  );
};

const extractModelFromBody = (body: unknown): string | null => {
  if (body && typeof body === "object" && "model" in body) {
    const value = (body as { model?: unknown }).model;
    return typeof value === "string" ? value : null;
  }
  return null;
};

const extractIdFromBody = (body: unknown): string | null => {
  if (body && typeof body === "object" && "id" in body) {
    const value = (body as { id?: unknown }).id;
    return typeof value === "string" ? value : null;
  }
  return null;
};

const toNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const isFiniteNumberArray = (value: unknown): value is number[] =>
  Array.isArray(value) &&
  value.every((item) => typeof item === "number" && Number.isFinite(item));

const extractUsageFromBody = (body: unknown): TokenUsage | null => {
  if (!body || typeof body !== "object" || !("usage" in body)) {
    return null;
  }
  const usage = (body as { usage?: Record<string, unknown> }).usage;
  if (!usage || typeof usage !== "object") {
    return null;
  }

  const prompt = toNumber(usage.prompt_tokens);
  const completion = toNumber(usage.completion_tokens);
  const total = toNumber(usage.total_tokens);
  const cost = toNumber((usage as { cost?: unknown }).cost ?? (usage as { total_cost?: unknown }).total_cost);

  if (prompt === null && completion === null && total === null && cost === null) {
    return null;
  }

  const normalizedPrompt = prompt ?? 0;
  const normalizedCompletion = completion ?? 0;
  const normalizedTotal = total ?? normalizedPrompt + normalizedCompletion;

  return {
    prompt_tokens: normalizedPrompt,
    completion_tokens: normalizedCompletion,
    total_tokens: normalizedTotal,
    ...(cost !== null ? { cost } : {})
  };
};

export const extractActualModel = (body: unknown): string | null =>
  extractModelFromBody(body);

export const extractResponseId = (body: unknown): string | null =>
  extractIdFromBody(body);

const classifyError = (
  status: number | undefined,
  body: unknown
): { retryable: boolean; modelUnavailable: boolean; code?: string; message?: string } => {
  let code: string | undefined;
  let message: string | undefined;

  if (body && typeof body === "object" && "error" in body) {
    const error = (body as { error?: { code?: string; message?: string } }).error;
    code = error?.code;
    message = error?.message;
  }

  const statusRetryable = status === 429 || (status !== undefined && status >= 500);
  const modelUnavailable =
    status === 404 ||
    code === "model_not_found" ||
    code === "model_not_available" ||
    code === "model_unavailable";

  return {
    retryable: statusRetryable,
    modelUnavailable,
    code,
    message
  };
};

const parseRetryAfterMs = (headers: Record<string, string>): number | null => {
  const raw = headers["retry-after"];
  if (!raw) {
    return null;
  }
  const numericSeconds = Number(raw);
  if (Number.isFinite(numericSeconds) && numericSeconds >= 0) {
    return Math.round(numericSeconds * 1000);
  }
  const asDate = Date.parse(raw);
  if (Number.isNaN(asDate)) {
    return null;
  }
  return Math.max(0, asDate - Date.now());
};

const computeBackoffMs = (
  retry: { backoffMs: number; maxBackoffMs?: number; jitter?: "none" | "full" },
  attempt: number
): number => {
  if (retry.backoffMs <= 0) {
    return 0;
  }
  const maxBackoffMs = retry.maxBackoffMs ?? 30_000;
  const exponential = retry.backoffMs * Math.pow(2, Math.max(0, attempt - 1));
  const capped = Math.min(maxBackoffMs, exponential);
  if ((retry.jitter ?? "full") === "none") {
    return capped;
  }
  return Math.max(0, Math.round(capped * (0.5 + Math.random())));
};

const requestWithRetry = async (
  path: string,
  requestPayload: Record<string, unknown>,
  options: OpenRouterRequestOptions
): Promise<{
  responseBody: unknown;
  headers: Record<string, string>;
  latencyMs: number;
  retryCount: number;
}> => {
  const apiKey = resolveApiKey(options.apiKey);
  if (!apiKey) {
    throw new OpenRouterError("OPENROUTER_API_KEY is required", {
      retryable: false,
      modelUnavailable: false,
      retryCount: 0
    });
  }
  const baseUrl = resolveBaseUrl(options.baseUrl);
  const retry = options.retry ?? { maxRetries: 0, backoffMs: 0 };
  let attempt = 0;
  const waitBackoff = async (retryAfterMs: number | null = null): Promise<void> => {
    const computedBackoffMs = computeBackoffMs(retry, attempt);
    const effectiveBackoffMs =
      retryAfterMs !== null ? Math.max(computedBackoffMs, retryAfterMs) : computedBackoffMs;
    if (effectiveBackoffMs <= 0) {
      return;
    }
    await delay(
      effectiveBackoffMs,
      undefined,
      options.signal ? { signal: options.signal } : undefined
    );
  };

  const isAbortError = (error: unknown): boolean => {
    if (!error || typeof error !== "object") {
      return false;
    }
    return "name" in error && (error as { name?: string }).name === "AbortError";
  };

  while (true) {
    const started = Date.now();
    try {
      const response = await fetch(`${baseUrl}${path}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(requestPayload),
        signal: options.signal
      });
      const latencyMs = Date.now() - started;
      const responseBody = await parseJsonBody(response);
      const headers = toHeaderRecord(response.headers);

      if (response.ok) {
        return {
          responseBody,
          headers,
          latencyMs,
          retryCount: attempt
        };
      }

      const classification = classifyError(response.status, responseBody);
      if (classification.retryable && attempt < retry.maxRetries) {
        attempt += 1;
        await waitBackoff(parseRetryAfterMs(headers));
        continue;
      }

      throw new OpenRouterError(
        classification.message ?? `OpenRouter request failed with status ${response.status}`,
        {
          status: response.status,
          code: classification.code,
          retryable: classification.retryable,
          modelUnavailable: classification.modelUnavailable,
          responseBody,
          headers,
          latencyMs,
          retryCount: attempt,
          requestPayload
        }
      );
    } catch (error) {
      if (isAbortError(error)) {
        throw new OpenRouterError("OpenRouter request aborted", {
          retryable: false,
          modelUnavailable: false,
          retryCount: attempt,
          requestPayload
        });
      }
      if (error instanceof OpenRouterError) {
        throw error;
      }
      if (attempt < retry.maxRetries) {
        attempt += 1;
        await waitBackoff();
        continue;
      }
      throw new OpenRouterError("OpenRouter request failed", {
        retryable: false,
        modelUnavailable: false,
        retryCount: attempt,
        requestPayload
      });
    }
  }
};

const cleanParams = (params?: ChatCompletionParams): Record<string, number> => {
  const cleaned: Record<string, number> = {};
  if (!params) {
    return cleaned;
  }
  if (params.temperature !== undefined) cleaned.temperature = params.temperature;
  if (params.top_p !== undefined) cleaned.top_p = params.top_p;
  if (params.max_tokens !== undefined) cleaned.max_tokens = params.max_tokens;
  if (params.presence_penalty !== undefined) cleaned.presence_penalty = params.presence_penalty;
  if (params.frequency_penalty !== undefined) cleaned.frequency_penalty = params.frequency_penalty;
  return cleaned;
};

export const chatCompletion = async (input: {
  model: string;
  messages: OpenRouterMessage[];
  params?: ChatCompletionParams;
  options?: OpenRouterRequestOptions;
}): Promise<ChatCompletionResult> => {
  const requestPayload: Record<string, unknown> = {
    model: input.model,
    messages: input.messages,
    ...cleanParams(input.params)
  };

  const result = await requestWithRetry("/chat/completions", requestPayload, input.options ?? {});
  return {
    requestPayload,
    responseBody: result.responseBody,
    headers: result.headers,
    latencyMs: result.latencyMs,
    retryCount: result.retryCount,
    modelHeader: result.headers["x-model"] ?? null,
    model: extractModelFromBody(result.responseBody),
    responseId: extractIdFromBody(result.responseBody),
    usage: extractUsageFromBody(result.responseBody)
  };
};

export const embedText = async (input: {
  model: string;
  text: string;
  options?: OpenRouterRequestOptions;
}): Promise<EmbeddingResult> => {
  const requestPayload: Record<string, unknown> = {
    model: input.model,
    input: input.text
  };

  const result = await requestWithRetry("/embeddings", requestPayload, input.options ?? {});
  const data = result.responseBody as { data?: Array<{ embedding?: number[] }> };
  const vector = data?.data?.[0]?.embedding;
  if (!isFiniteNumberArray(vector)) {
    throw new OpenRouterError("OpenRouter embedding response missing or invalid vector", {
      retryable: false,
      modelUnavailable: false,
      retryCount: result.retryCount,
      responseBody: result.responseBody,
      headers: result.headers,
      latencyMs: result.latencyMs,
      requestPayload
    });
  }

  return {
    requestPayload,
    responseBody: result.responseBody,
    headers: result.headers,
    latencyMs: result.latencyMs,
    retryCount: result.retryCount,
    vector,
    modelHeader: result.headers["x-model"] ?? null,
    model: extractModelFromBody(result.responseBody),
    generationId: extractIdFromBody(result.responseBody)
  };
};

export const listModels = async (options?: OpenRouterRequestOptions): Promise<ModelsListResult> => {
  const result = await requestGet("/models", options ?? {});
  return result;
};
