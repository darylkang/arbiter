import type { EventBus } from "../events/event-bus.js";
import type { ArbiterResolvedConfig } from "../generated/config.types.js";
import type { ArbiterParsedOutputRecord } from "../generated/parsed-output.types.js";
import type { ArbiterDebugEmbeddingJSONLRecord } from "../generated/embedding.types.js";
import type { OpenRouterMessage } from "../openrouter/client.js";
import { sha256Hex } from "../utils/hash.js";
import { encodeFloat32Base64 } from "../utils/float32-base64.js";
import { formatDecisionContractClause } from "../protocols/contract/extraction.js";
import type { EmbedTextPreparation } from "./embed-text.js";
import type { RunnerStopSignal } from "./trial-executor.js";

export type LiveTrialExecutionState = {
  contractFailures: {
    fallback: number;
    failed: number;
  };
  embeddingDimensions: number | null;
  actualEmbeddingModel: string | null;
  embeddingModelConflict: boolean;
  embeddingGenerationIds: Set<string>;
};

export type PersonaEntry = {
  text?: string | null;
};

export type ProtocolEntry = {
  text?: string | null;
};

export type LiveTrialExecutionContext = {
  bus: EventBus;
  resolvedConfig: ArbiterResolvedConfig;
  personaMap: Map<string, PersonaEntry>;
  protocolMap: Map<string, ProtocolEntry>;
  embeddingMaxChars: number;
  hasDecisionContract: boolean;
  contractFailurePolicy?: "warn" | "exclude" | "fail";
  shouldStop: () => RunnerStopSignal;
  abortSignal?: AbortSignal;
  state: LiveTrialExecutionState;
};

export const buildIndependentMessages = (
  config: ArbiterResolvedConfig,
  personaText: string,
  protocolText: string
): OpenRouterMessage[] => {
  const systemParts: string[] = [];
  if (personaText) {
    systemParts.push(personaText);
  }
  if (protocolText) {
    systemParts.push(protocolText);
  }
  if (config.protocol.decision_contract) {
    systemParts.push(formatDecisionContractClause(config.protocol.decision_contract.schema));
  }
  if (config.sampling.instruments) {
    config.sampling.instruments.forEach((instrument) => {
      if (instrument.text) {
        systemParts.push(instrument.text);
      }
    });
  }

  const messages: OpenRouterMessage[] = [];
  if (systemParts.length > 0) {
    messages.push({ role: "system", content: systemParts.join("\n\n") });
  }
  messages.push({ role: "user", content: config.question.text });
  return messages;
};

export const createTimeoutSignal = (
  timeoutMs: number,
  parentSignal?: AbortSignal
): { signal: AbortSignal; cancel: () => void; didTimeout: () => boolean } => {
  let timedOut = false;
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let parentListenerAttached = false;
  const onParentAbort = (): void => {
    controller.abort();
    cleanup();
  };
  const cleanup = (): void => {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
    if (parentSignal && parentListenerAttached) {
      parentSignal.removeEventListener("abort", onParentAbort);
      parentListenerAttached = false;
    }
  };

  timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
    cleanup();
  }, timeoutMs);

  if (parentSignal) {
    if (parentSignal.aborted) {
      controller.abort();
    } else {
      parentSignal.addEventListener("abort", onParentAbort, { once: true });
      parentListenerAttached = true;
    }
  }

  return {
    signal: controller.signal,
    cancel: cleanup,
    didTimeout: () => timedOut
  };
};

export const extractAssistantText = (responseBody: unknown): string => {
  if (
    responseBody &&
    typeof responseBody === "object" &&
    "choices" in responseBody
  ) {
    const choices = (responseBody as { choices?: Array<{ message?: { content?: unknown } }> }).choices;
    const content = choices?.[0]?.message?.content;
    if (typeof content === "string") {
      return content;
    }
  }
  return "";
};

export const buildIndependentParsedOutput = (
  trialId: number,
  outcome: string,
  rawAssistantText: string,
  embedTextValue: string,
  parseError?: string
): ArbiterParsedOutputRecord => ({
  trial_id: trialId,
  parse_status: parseError ? "failed" : "success",
  outcome: outcome || undefined,
  raw_assistant_text: rawAssistantText || undefined,
  embed_text: embedTextValue || undefined,
  parser_version: "live-v0",
  parse_error: parseError ? { message: parseError } : undefined
});

export const buildSkippedEmbedding = (
  trialId: number,
  reason: string,
  preparation: EmbedTextPreparation
): ArbiterDebugEmbeddingJSONLRecord => ({
  trial_id: trialId,
  embedding_status: "skipped",
  vector_b64: null,
  dtype: "float32",
  encoding: "float32le_base64",
  skip_reason: reason,
  embed_text_sha256: preparation.text ? sha256Hex(preparation.text) : undefined,
  embed_text_truncated: preparation.truncated,
  embed_text_original_chars: preparation.original_chars,
  embed_text_final_chars: preparation.final_chars,
  truncation_reason: preparation.truncation_reason
});

export const buildFailedEmbedding = (
  trialId: number,
  error: string,
  preparation: EmbedTextPreparation
): ArbiterDebugEmbeddingJSONLRecord => ({
  trial_id: trialId,
  embedding_status: "failed",
  vector_b64: null,
  dtype: "float32",
  encoding: "float32le_base64",
  error,
  embed_text_sha256: preparation.text ? sha256Hex(preparation.text) : undefined,
  embed_text_truncated: preparation.truncated,
  embed_text_original_chars: preparation.original_chars,
  embed_text_final_chars: preparation.final_chars,
  truncation_reason: preparation.truncation_reason
});

export const buildSuccessEmbedding = (
  trialId: number,
  vector: number[],
  preparation: EmbedTextPreparation,
  generationId?: string | null
): ArbiterDebugEmbeddingJSONLRecord => ({
  trial_id: trialId,
  embedding_status: "success",
  vector_b64: encodeFloat32Base64(vector),
  dtype: "float32",
  encoding: "float32le_base64",
  dimensions: vector.length,
  embed_text_sha256: sha256Hex(preparation.text),
  generation_id: generationId ?? undefined,
  embed_text_truncated: preparation.truncated,
  embed_text_original_chars: preparation.original_chars,
  embed_text_final_chars: preparation.final_chars,
  truncation_reason: preparation.truncation_reason
});

export const asObject = (value: unknown): Record<string, unknown> | undefined => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
};

export const normalizeErrorCode = (code: unknown): string | undefined => {
  if (typeof code !== "string") {
    return undefined;
  }
  const trimmed = code.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const isContractParseFailure = (input: {
  hasDecisionContract: boolean;
  trialSucceeded: boolean;
  parseStatus: ArbiterParsedOutputRecord["parse_status"];
}): boolean => input.hasDecisionContract && input.trialSucceeded && input.parseStatus !== "success";

export const shouldExcludeContractFailure = (input: {
  contractParseFailure: boolean;
  contractFailurePolicy?: "warn" | "exclude" | "fail";
}): boolean => input.contractParseFailure && input.contractFailurePolicy === "exclude";

export const applyEmbeddingMetadata = (
  state: LiveTrialExecutionState,
  vectorLength: number,
  model: string | null,
  generationId?: string | null
): void => {
  if (model) {
    if (!state.embeddingModelConflict && state.actualEmbeddingModel === null) {
      state.actualEmbeddingModel = model;
    } else if (!state.embeddingModelConflict && state.actualEmbeddingModel !== model) {
      state.embeddingModelConflict = true;
      state.actualEmbeddingModel = null;
    }
  }

  if (generationId) {
    state.embeddingGenerationIds.add(generationId);
  }

  if (state.embeddingDimensions === null) {
    state.embeddingDimensions = vectorLength;
    return;
  }

  if (state.embeddingDimensions !== vectorLength) {
    throw new Error(
      `Embedding dimensions mismatch: expected ${state.embeddingDimensions}, got ${vectorLength}`
    );
  }
};
