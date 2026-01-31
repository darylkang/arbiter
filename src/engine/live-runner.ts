import { existsSync, readdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";

import type { EventBus } from "../events/event-bus.js";
import type { ArbiterResolvedConfig } from "../generated/config.types.js";
import type { ArbiterTrialRecord } from "../generated/trial.types.js";
import type { ArbiterParsedOutputRecord } from "../generated/parsed-output.types.js";
import type { ArbiterDebugEmbeddingJSONLRecord } from "../generated/embedding.types.js";
import type { ArbiterConvergenceTraceRecord } from "../generated/convergence-trace.types.js";
import type { ArbiterAggregates } from "../generated/aggregates.types.js";
import { finalizeEmbeddingsToArrow } from "../artifacts/embeddings.js";
import type { EmbeddingsProvenance } from "../artifacts/embeddings-provenance.js";
import { sha256Hex } from "../utils/hash.js";
import { createRngForTrial } from "../utils/seeded-rng.js";
import type { ChatCompletionParams, OpenRouterMessage } from "../openrouter/client.js";
import { chatCompletion, embedText, OpenRouterError } from "../openrouter/client.js";

type WeightedItem<T> = { weight: number } & T;

export interface LiveRunOptions {
  bus: EventBus;
  runDir: string;
  resolvedConfig: ArbiterResolvedConfig;
  embeddingsJsonlPath: string;
  debugEnabled: boolean;
  beforeFinalize?: () => Promise<void>;
}

export interface LiveRunResult {
  runId: string;
  runDir: string;
  kAttempted: number;
  kEligible: number;
  embeddingsProvenance: EmbeddingsProvenance;
  embeddingsArrowPath?: string;
}

const sampleWeighted = <T>(items: Array<WeightedItem<T>>, rng: () => number): T => {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  if (total <= 0) {
    throw new Error("Weighted sampling requires positive total weight");
  }
  const target = rng() * total;
  let cumulative = 0;
  for (const item of items) {
    cumulative += item.weight;
    if (target <= cumulative) {
      return item;
    }
  }
  return items[items.length - 1];
};

const sampleNumber = (value: number | { min: number; max: number }, rng: () => number): number =>
  typeof value === "number" ? value : value.min + rng() * (value.max - value.min);

const sampleInteger = (value: number | { min: number; max: number }, rng: () => number): number => {
  if (typeof value === "number") {
    return value;
  }
  const min = Math.ceil(value.min);
  const max = Math.floor(value.max);
  return Math.floor(min + rng() * (max - min + 1));
};

const resolveDecodeParams = (
  decode: ArbiterResolvedConfig["sampling"]["decode"] | undefined,
  rng: () => number
): ChatCompletionParams | undefined => {
  if (!decode) {
    return undefined;
  }

  const resolved: ChatCompletionParams = {};

  if (decode.temperature !== undefined) {
    resolved.temperature = sampleNumber(decode.temperature, rng);
  }
  if (decode.top_p !== undefined) {
    resolved.top_p = sampleNumber(decode.top_p, rng);
  }
  if (decode.max_tokens !== undefined) {
    resolved.max_tokens = sampleInteger(decode.max_tokens, rng);
  }
  if (decode.presence_penalty !== undefined) {
    resolved.presence_penalty = sampleNumber(decode.presence_penalty, rng);
  }
  if (decode.frequency_penalty !== undefined) {
    resolved.frequency_penalty = sampleNumber(decode.frequency_penalty, rng);
  }

  return Object.keys(resolved).length > 0 ? resolved : undefined;
};

const encodeFloat32Base64 = (values: number[]): string => {
  const array = new Float32Array(values);
  const buffer = Buffer.from(array.buffer, array.byteOffset, array.byteLength);
  return buffer.toString("base64");
};

const buildMessages = (
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

const extractAssistantText = (responseBody: unknown): string => {
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

const buildParsedOutput = (
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

const buildSkippedEmbedding = (
  trialId: number,
  reason: string,
  embedText?: string
): ArbiterDebugEmbeddingJSONLRecord => ({
  trial_id: trialId,
  embedding_status: "skipped",
  vector_b64: null,
  dtype: "float32",
  encoding: "float32le_base64",
  skip_reason: reason,
  embed_text_sha256: embedText ? sha256Hex(embedText) : undefined
});

const buildFailedEmbedding = (
  trialId: number,
  error: string,
  embedText?: string
): ArbiterDebugEmbeddingJSONLRecord => ({
  trial_id: trialId,
  embedding_status: "failed",
  vector_b64: null,
  dtype: "float32",
  encoding: "float32le_base64",
  error,
  embed_text_sha256: embedText ? sha256Hex(embedText) : undefined
});

const buildSuccessEmbedding = (
  trialId: number,
  vector: number[],
  embedTextValue: string
): ArbiterDebugEmbeddingJSONLRecord => ({
  trial_id: trialId,
  embedding_status: "success",
  vector_b64: encodeFloat32Base64(vector),
  dtype: "float32",
  encoding: "float32le_base64",
  dimensions: vector.length,
  embed_text_sha256: sha256Hex(embedTextValue)
});

const asObject = (value: unknown): Record<string, unknown> | undefined => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
};

export const runLive = async (options: LiveRunOptions): Promise<LiveRunResult> => {
  const { bus, resolvedConfig } = options;
  const runId = resolvedConfig.run.run_id;
  const startedAt = new Date().toISOString();

  bus.emit({
    type: "run.started",
    payload: {
      run_id: runId,
      started_at: startedAt,
      resolved_config: resolvedConfig,
      debug_enabled: options.debugEnabled
    }
  });

  const kMax = resolvedConfig.execution.k_max;
  const batchSize = resolvedConfig.execution.batch_size;
  const stopMode = resolvedConfig.execution.stop_mode;
  let attempted = 0;
  let eligible = 0;
  let embeddingDimensions: number | null = null;

  try {
    for (let batchStart = 0; batchStart < kMax; batchStart += batchSize) {
      const batchNumber = Math.floor(batchStart / batchSize);
      const batchIds = Array.from(
        { length: Math.min(batchSize, kMax - batchStart) },
        (_, idx) => batchStart + idx
      );
      const batchStartTime = Date.now();

      bus.emit({
        type: "batch.started",
        payload: { batch_number: batchNumber, trial_ids: batchIds }
      });

      for (const trialId of batchIds) {
        const planRng = createRngForTrial(resolvedConfig.run.seed, "plan", trialId);
        const decodeRng = createRngForTrial(resolvedConfig.run.seed, "decode", trialId);

        const model = sampleWeighted(resolvedConfig.sampling.models, planRng);
        const persona = sampleWeighted(resolvedConfig.sampling.personas, planRng);
        const protocol = sampleWeighted(resolvedConfig.sampling.protocols, planRng);
        const decode = resolveDecodeParams(resolvedConfig.sampling.decode, decodeRng);

        bus.emit({
          type: "trial.planned",
          payload: {
            trial_id: trialId,
            assignment: {
              model: model.model,
              persona: persona.persona,
              protocol: protocol.protocol,
              decode
            }
          }
        });

        const messages = buildMessages(
          resolvedConfig,
          persona.text ?? "",
          protocol.text ?? ""
        );
        const attemptStarted = new Date().toISOString();

        let trialRecord: ArbiterTrialRecord;
        let rawAssistantText = "";
        let responsePayload: unknown;
        let actualModel: string | null = null;
        let retryCount = 0;
        let latencyMs = 0;
        let chatError: OpenRouterError | null = null;

        try {
          const chatResult = await chatCompletion({
            model: model.model,
            messages,
            params: decode,
            options: {
              retry: {
                maxRetries: resolvedConfig.execution.retry_policy.max_retries,
                backoffMs: resolvedConfig.execution.retry_policy.backoff_ms ?? 0
              }
            }
          });

          retryCount = chatResult.retryCount;
          latencyMs = chatResult.latencyMs;
          responsePayload = chatResult.responseBody;
          actualModel = chatResult.modelHeader;
          rawAssistantText = extractAssistantText(chatResult.responseBody);

          trialRecord = {
            trial_id: trialId,
            requested_model_slug: model.model,
            actual_model: actualModel ?? null,
            status: "success",
            assigned_config: {
              model: model.model,
              persona: persona.persona,
              protocol: protocol.protocol,
              decode
            },
            attempt: {
              started_at: attemptStarted,
              completed_at: new Date().toISOString(),
              latency_ms: latencyMs,
              retry_count: retryCount
            },
            raw_assistant_text: rawAssistantText,
            request_payload: chatResult.requestPayload,
            response_payload: asObject(responsePayload)
          };
        } catch (error) {
          chatError = error instanceof OpenRouterError ? error : null;
          retryCount = chatError?.retryCount ?? 0;
          latencyMs = chatError?.latencyMs ?? 0;
          responsePayload = chatError?.responseBody;
          actualModel = chatError?.headers?.["x-model"] ?? null;

          const status = chatError?.modelUnavailable ? "model_unavailable" : "error";

          trialRecord = {
            trial_id: trialId,
            requested_model_slug: model.model,
            actual_model: actualModel ?? null,
            status,
            assigned_config: {
              model: model.model,
              persona: persona.persona,
              protocol: protocol.protocol,
              decode
            },
            attempt: {
              started_at: attemptStarted,
              completed_at: new Date().toISOString(),
              latency_ms: latencyMs,
              retry_count: retryCount
            },
            error: {
              message: chatError?.message ?? "OpenRouter request failed",
              code: chatError?.code,
              retryable: chatError?.retryable ?? false
            },
            request_payload: asObject(chatError?.requestPayload),
            response_payload: asObject(responsePayload)
          };
        }

        bus.emit({ type: "trial.completed", payload: { trial_record: trialRecord } });

        const parseError =
          trialRecord.status === "success"
            ? rawAssistantText
              ? undefined
              : "Missing assistant content"
            : trialRecord.error?.message ?? "Trial did not complete successfully";
        const outcome = rawAssistantText;
        const embedTextValue =
          resolvedConfig.measurement.embed_text_strategy === "outcome_only"
            ? outcome
            : outcome || rawAssistantText;

        const parsedRecord = buildParsedOutput(
          trialId,
          outcome,
          rawAssistantText,
          embedTextValue,
          parseError
        );
        bus.emit({ type: "parsed.output", payload: { parsed_record: parsedRecord } });

        if (trialRecord.status !== "success") {
          bus.emit({
            type: "embedding.recorded",
            payload: {
              embedding_record: buildSkippedEmbedding(trialId, "trial_not_success")
            }
          });
        } else if (!embedTextValue) {
          bus.emit({
            type: "embedding.recorded",
            payload: {
              embedding_record: buildSkippedEmbedding(trialId, "empty_embed_text")
            }
          });
        } else {
          try {
            const embedResult = await embedText({
              model: resolvedConfig.measurement.embedding_model,
              text: embedTextValue,
              options: {
                retry: {
                  maxRetries: resolvedConfig.execution.retry_policy.max_retries,
                  backoffMs: resolvedConfig.execution.retry_policy.backoff_ms ?? 0
                }
              }
            });

            if (embeddingDimensions === null) {
              embeddingDimensions = embedResult.vector.length;
            } else if (embeddingDimensions !== embedResult.vector.length) {
              throw new Error(
                `Embedding dimensions mismatch: expected ${embeddingDimensions}, got ${embedResult.vector.length}`
              );
            }

            bus.emit({
              type: "embedding.recorded",
              payload: {
                embedding_record: buildSuccessEmbedding(
                  trialId,
                  embedResult.vector,
                  embedTextValue
                )
              }
            });
            eligible += 1;
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            bus.emit({
              type: "embedding.recorded",
              payload: {
                embedding_record: buildFailedEmbedding(trialId, message, embedTextValue)
              }
            });
          }
        }

        attempted += 1;
      }

      bus.emit({
        type: "batch.completed",
        payload: {
          batch_number: batchNumber,
          trial_ids: batchIds,
          elapsed_ms: Date.now() - batchStartTime
        }
      });

      const convergenceRecord: ArbiterConvergenceTraceRecord = {
        batch_number: batchNumber,
        k_attempted: attempted,
        k_eligible: eligible,
        novelty_rate: 0,
        mean_max_sim_to_prior: 0,
        recorded_at: new Date().toISOString(),
        stop: {
          mode: stopMode,
          would_stop: false,
          should_stop: false
        }
      };

      bus.emit({ type: "convergence.record", payload: { convergence_record: convergenceRecord } });
    }

    if (options.beforeFinalize) {
      await options.beforeFinalize();
    }

    let provenance: EmbeddingsProvenance;
    let arrowPath: string | undefined;
    if (embeddingDimensions === null) {
      provenance = {
        schema_version: "1.0.0",
        status: "not_generated",
        reason: "no_successful_embeddings",
        intended_primary_format: "arrow_ipc_file",
        primary_format: "none",
        dtype: "float32",
        dimensions: null,
        note: "No successful embeddings; arrow file not generated"
      };
    } else {
      const finalizeResult = await finalizeEmbeddingsToArrow({
        runDir: options.runDir,
        dimensions: embeddingDimensions,
        debugJsonlPath: options.embeddingsJsonlPath
      });
      provenance = finalizeResult.provenance;
      arrowPath =
        provenance.status === "arrow_generated"
          ? resolve(options.runDir, "embeddings.arrow")
          : undefined;
    }

    if (!options.debugEnabled && provenance.status === "arrow_generated") {
      if (existsSync(options.embeddingsJsonlPath)) {
        rmSync(options.embeddingsJsonlPath, { force: true });
      }
      const debugDir = resolve(options.runDir, "debug");
      if (existsSync(debugDir) && readdirSync(debugDir).length === 0) {
        rmSync(debugDir, { recursive: true, force: true });
      }
      provenance = { ...provenance, debug_jsonl_present: false };
    }

    bus.emit({ type: "embeddings.finalized", payload: { provenance } });

    const aggregates: ArbiterAggregates = {
      schema_version: "1.0.0",
      k_attempted: attempted,
      k_eligible: eligible,
      novelty_rate: 0,
      mean_max_sim_to_prior: 0,
      cluster_count: null,
      entropy: null
    };
    bus.emit({ type: "aggregates.computed", payload: { aggregates } });

    const completedAt = new Date().toISOString();
    bus.emit({
      type: "run.completed",
      payload: {
        run_id: runId,
        completed_at: completedAt,
        stop_reason: "completed",
        incomplete: false
      }
    });

    return {
      runId,
      runDir: options.runDir,
      kAttempted: attempted,
      kEligible: eligible,
      embeddingsProvenance: provenance,
      embeddingsArrowPath: arrowPath
    };
  } catch (error) {
    const completedAt = new Date().toISOString();
    const message = error instanceof Error ? error.message : String(error);
    bus.emit({
      type: "run.failed",
      payload: { run_id: runId, completed_at: completedAt, error: message }
    });
    throw error;
  }
};
