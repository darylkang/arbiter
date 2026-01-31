import { existsSync, readdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";

import type { EventBus } from "../events/event-bus.js";
import type { ArbiterResolvedConfig } from "../generated/config.types.js";
import type { ArbiterTrialRecord } from "../generated/trial.types.js";
import type { ArbiterParsedOutputRecord } from "../generated/parsed-output.types.js";
import type { ArbiterDebugEmbeddingJSONLRecord } from "../generated/embedding.types.js";
import type { ArbiterAggregates } from "../generated/aggregates.types.js";
import { finalizeEmbeddingsToArrow } from "../artifacts/embeddings.js";
import type { EmbeddingsProvenance } from "../artifacts/embeddings-provenance.js";
import { sha256Hex } from "../utils/hash.js";
import { encodeFloat32Base64 } from "../utils/float32-base64.js";
import type { OpenRouterMessage } from "../openrouter/client.js";
import { chatCompletion, embedText, OpenRouterError } from "../openrouter/client.js";
import { generateTrialPlan, type TrialPlanEntry } from "./planner.js";
import { buildDebateMessages, buildDebateParsedOutput } from "./debate-v1.js";

export interface LiveRunOptions {
  bus: EventBus;
  runDir: string;
  resolvedConfig: ArbiterResolvedConfig;
  embeddingsJsonlPath: string;
  debugEnabled: boolean;
  beforeFinalize?: () => Promise<void>;
  shutdown?: {
    signal: AbortSignal;
    isRequested: () => boolean;
  };
}

export interface LiveRunResult {
  runId: string;
  runDir: string;
  kAttempted: number;
  kEligible: number;
  embeddingsProvenance: EmbeddingsProvenance;
  embeddingsArrowPath?: string;
}

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

const createTimeoutSignal = (
  timeoutMs: number,
  parentSignal?: AbortSignal
): { signal: AbortSignal; cancel: () => void; didTimeout: () => boolean } => {
  let timedOut = false;
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  if (parentSignal) {
    if (parentSignal.aborted) {
      controller.abort();
    } else {
      parentSignal.addEventListener("abort", () => controller.abort(), { once: true });
    }
  }

  return {
    signal: controller.signal,
    cancel: () => clearTimeout(timeout),
    didTimeout: () => timedOut
  };
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

  const { plan, planSha256 } = generateTrialPlan(resolvedConfig);
  const personaMap = new Map(
    resolvedConfig.sampling.personas.map((persona) => [persona.persona, persona])
  );
  const protocolMap = new Map(
    resolvedConfig.sampling.protocols.map((protocol) => [protocol.protocol, protocol])
  );

  bus.emit({
    type: "run.started",
    payload: {
      run_id: runId,
      started_at: startedAt,
      resolved_config: resolvedConfig,
      debug_enabled: options.debugEnabled,
      plan_sha256: planSha256,
      k_planned: plan.length
    }
  });

  const kMax = plan.length;
  const batchSize = resolvedConfig.execution.batch_size;
  const workerCount = Math.max(1, resolvedConfig.execution.workers);
  let attempted = 0;
  let eligible = 0;
  let embeddingDimensions: number | null = null;
  let stopReason: "k_max_reached" | "user_interrupt" | "error" = "k_max_reached";
  let incomplete = false;

  const shouldStop = (): boolean => options.shutdown?.isRequested() ?? false;
  const abortSignal = options.shutdown?.signal;

  type TrialResult = {
    trial_id: number;
    embedding:
      | { status: "success"; vector: number[] }
      | { status: "failed" | "skipped" };
  };

  const executeTrial = async (entry: TrialPlanEntry): Promise<TrialResult> => {
    const assigned = entry.assigned_config;
    const attemptStarted = new Date().toISOString();

    bus.emit({
      type: "trial.planned",
      payload: {
        trial_id: entry.trial_id,
        assignment: assigned
      }
    });

    if (entry.protocol === "debate_v1") {
      const roleAssignments = entry.role_assignments;
      if (!roleAssignments) {
        throw new Error(`Missing role assignments for debate trial ${entry.trial_id}`);
      }
      const proposerPersona = roleAssignments.proposer.persona_id
        ? personaMap.get(roleAssignments.proposer.persona_id)
        : undefined;
      const criticPersona = roleAssignments.critic.persona_id
        ? personaMap.get(roleAssignments.critic.persona_id)
        : undefined;
      if (!resolvedConfig.protocol.prompts) {
        throw new Error("Debate prompts are missing from resolved config");
      }

      const protocolPrompts = resolvedConfig.protocol.prompts;
      const calls: NonNullable<ArbiterTrialRecord["calls"]> = [];
      const transcript: NonNullable<ArbiterTrialRecord["transcript"]> = [];
      const trialStartedMs = Date.now();
      const totalTimeoutMs = resolvedConfig.protocol.timeouts.total_trial_timeout_ms;
      const perCallTimeoutMs = resolvedConfig.protocol.timeouts.per_call_timeout_ms;
      const perCallMaxRetries = resolvedConfig.protocol.timeouts.per_call_max_retries;
      const backoffMs = resolvedConfig.execution.retry_policy.backoff_ms ?? 0;

      const runCall = async (input: {
        callIndex: number;
        turn: 0 | 1 | 2;
        role: "proposer" | "critic";
        systemPrompt: string;
        personaPrompt?: string | null;
        proposerTurn?: string;
        criticTurn?: string;
      }): Promise<{
        content?: string;
        modelActual?: string | null;
        error?: OpenRouterError | Error;
        errorCode?: string;
      }> => {
        const elapsed = Date.now() - trialStartedMs;
        const remaining = totalTimeoutMs - elapsed;
        if (remaining <= 0) {
          return { error: new Error("Total trial timeout exhausted"), errorCode: "timeout_exhausted" };
        }

        const callStarted = new Date().toISOString();
        const messages = buildDebateMessages({
          turn: input.turn,
          question: resolvedConfig.question.text,
          systemPrompt: input.systemPrompt,
          personaPrompt: input.personaPrompt,
          proposerTurn: input.proposerTurn,
          criticTurn: input.criticTurn
        });

        const timeout = createTimeoutSignal(Math.min(perCallTimeoutMs, remaining), abortSignal);
        let result: Awaited<ReturnType<typeof chatCompletion>> | null = null;
        let error: OpenRouterError | Error | null = null;

        try {
          result = await chatCompletion({
            model: roleAssignments[input.role].model_slug,
            messages,
            params: roleAssignments[input.role].decode,
            options: {
              retry: { maxRetries: perCallMaxRetries, backoffMs },
              signal: timeout.signal
            }
          });
        } catch (err) {
          error = err instanceof OpenRouterError ? err : (err as Error);
        } finally {
          timeout.cancel();
        }

        if (result) {
          const content = extractAssistantText(result.responseBody);
          calls.push({
            call_index: input.callIndex,
            turn: input.turn,
            role: input.role,
            model_requested: roleAssignments[input.role].model_slug,
            model_actual: result.modelHeader ?? null,
            request_payload: result.requestPayload,
            response_payload: asObject(result.responseBody) ?? null,
            attempt: {
              started_at: callStarted,
              completed_at: new Date().toISOString(),
              latency_ms: result.latencyMs,
              retry_count: result.retryCount
            },
            error_message: null
          });
          transcript.push({ turn: input.turn, role: input.role, content });
          return { content, modelActual: result.modelHeader ?? null };
        }

        const errorMessage =
          error instanceof OpenRouterError
            ? error.message
            : error?.message ?? "OpenRouter request failed";
        const retryCount = error instanceof OpenRouterError ? error.retryCount : 0;
        const latencyMs = error instanceof OpenRouterError ? error.latencyMs ?? 0 : 0;
        const responsePayload =
          error instanceof OpenRouterError ? error.responseBody : undefined;
        const modelActual =
          error instanceof OpenRouterError ? error.headers?.["x-model"] ?? null : null;
        const timeoutCode = timeout.didTimeout() ? "timeout_exhausted" : undefined;

        calls.push({
          call_index: input.callIndex,
          turn: input.turn,
          role: input.role,
          model_requested: roleAssignments[input.role].model_slug,
          model_actual: modelActual,
          request_payload:
            error instanceof OpenRouterError ? (error.requestPayload ?? {}) : {},
          response_payload: asObject(responsePayload) ?? null,
          attempt: {
            started_at: callStarted,
            completed_at: new Date().toISOString(),
            latency_ms: latencyMs,
            retry_count: retryCount
          },
          error_message: errorMessage
        });

        return { error: error ?? new Error(errorMessage), errorCode: timeoutCode };
      };

      const proposerPersonaText = proposerPersona?.text ?? "";
      const criticPersonaText = criticPersona?.text ?? "";

      const turn0 = await runCall({
        callIndex: 0,
        turn: 0,
        role: "proposer",
        systemPrompt: protocolPrompts.proposer_system.text,
        personaPrompt: proposerPersonaText
      });
      if (!turn0.content) {
        const errorCode = turn0.errorCode ?? (shouldStop() ? "shutdown_abort" : null);
        const status =
          turn0.error instanceof OpenRouterError && turn0.error.modelUnavailable
            ? "model_unavailable"
            : "error";
        const trialRecord: ArbiterTrialRecord = {
          trial_id: entry.trial_id,
          requested_model_slug: assigned.model,
          actual_model: null,
          protocol: "debate_v1",
          status,
          assigned_config: assigned,
          role_assignments: roleAssignments,
          calls,
          transcript,
          error: {
            message: turn0.error?.message ?? "Debate call failed",
            code: turn0.error instanceof OpenRouterError ? turn0.error.code : undefined,
            retryable:
              turn0.error instanceof OpenRouterError ? turn0.error.retryable : false
          },
          error_code: errorCode
        };
        bus.emit({ type: "trial.completed", payload: { trial_record: trialRecord } });
        bus.emit({
          type: "parsed.output",
          payload: {
            parsed_record: {
              trial_id: entry.trial_id,
              parse_status: "failed",
              parser_version: "debate-v1"
            }
          }
        });
        bus.emit({
          type: "embedding.recorded",
          payload: {
            embedding_record: buildSkippedEmbedding(entry.trial_id, "trial_not_success")
          }
        });
        return { trial_id: entry.trial_id, embedding: { status: "skipped" } };
      }

      const turn1 = await runCall({
        callIndex: 1,
        turn: 1,
        role: "critic",
        systemPrompt: protocolPrompts.critic_system.text,
        personaPrompt: criticPersonaText,
        proposerTurn: turn0.content
      });
      if (!turn1.content) {
        const errorCode = turn1.errorCode ?? (shouldStop() ? "shutdown_abort" : null);
        const status =
          turn1.error instanceof OpenRouterError && turn1.error.modelUnavailable
            ? "model_unavailable"
            : "error";
        const trialRecord: ArbiterTrialRecord = {
          trial_id: entry.trial_id,
          requested_model_slug: assigned.model,
          actual_model: null,
          protocol: "debate_v1",
          status,
          assigned_config: assigned,
          role_assignments: roleAssignments,
          calls,
          transcript,
          error: {
            message: turn1.error?.message ?? "Debate call failed",
            code: turn1.error instanceof OpenRouterError ? turn1.error.code : undefined,
            retryable:
              turn1.error instanceof OpenRouterError ? turn1.error.retryable : false
          },
          error_code: errorCode
        };
        bus.emit({ type: "trial.completed", payload: { trial_record: trialRecord } });
        bus.emit({
          type: "parsed.output",
          payload: {
            parsed_record: {
              trial_id: entry.trial_id,
              parse_status: "failed",
              parser_version: "debate-v1"
            }
          }
        });
        bus.emit({
          type: "embedding.recorded",
          payload: {
            embedding_record: buildSkippedEmbedding(entry.trial_id, "trial_not_success")
          }
        });
        return { trial_id: entry.trial_id, embedding: { status: "skipped" } };
      }

      const turn2 = await runCall({
        callIndex: 2,
        turn: 2,
        role: "proposer",
        systemPrompt: protocolPrompts.proposer_final_system.text,
        personaPrompt: proposerPersonaText,
        proposerTurn: turn0.content,
        criticTurn: turn1.content
      });

      if (!turn2.content) {
        const errorCode = turn2.errorCode ?? (shouldStop() ? "shutdown_abort" : null);
        const status =
          turn2.error instanceof OpenRouterError && turn2.error.modelUnavailable
            ? "model_unavailable"
            : "error";
        const trialRecord: ArbiterTrialRecord = {
          trial_id: entry.trial_id,
          requested_model_slug: assigned.model,
          actual_model: null,
          protocol: "debate_v1",
          status,
          assigned_config: assigned,
          role_assignments: roleAssignments,
          calls,
          transcript,
          error: {
            message: turn2.error?.message ?? "Debate call failed",
            code: turn2.error instanceof OpenRouterError ? turn2.error.code : undefined,
            retryable:
              turn2.error instanceof OpenRouterError ? turn2.error.retryable : false
          },
          error_code: errorCode
        };
        bus.emit({ type: "trial.completed", payload: { trial_record: trialRecord } });
        bus.emit({
          type: "parsed.output",
          payload: {
            parsed_record: {
              trial_id: entry.trial_id,
              parse_status: "failed",
              parser_version: "debate-v1"
            }
          }
        });
        bus.emit({
          type: "embedding.recorded",
          payload: {
            embedding_record: buildSkippedEmbedding(entry.trial_id, "trial_not_success")
          }
        });
        return { trial_id: entry.trial_id, embedding: { status: "skipped" } };
      }

      const parsedRecord = buildDebateParsedOutput(entry.trial_id, turn2.content);
      const trialRecord: ArbiterTrialRecord = {
        trial_id: entry.trial_id,
        requested_model_slug: assigned.model,
        actual_model: turn2.modelActual ?? null,
        protocol: "debate_v1",
        status: "success",
        assigned_config: assigned,
        role_assignments: roleAssignments,
        calls,
        transcript,
        raw_assistant_text: turn2.content
      };

      bus.emit({ type: "trial.completed", payload: { trial_record: trialRecord } });
      bus.emit({ type: "parsed.output", payload: { parsed_record: parsedRecord } });

      const embedTextValue = parsedRecord.embed_text ?? "";
      if (!embedTextValue) {
        bus.emit({
          type: "embedding.recorded",
          payload: {
            embedding_record: buildSkippedEmbedding(entry.trial_id, "empty_embed_text")
          }
        });
        return { trial_id: entry.trial_id, embedding: { status: "skipped" } };
      }

      try {
        const embedResult = await embedText({
          model: resolvedConfig.measurement.embedding_model,
          text: embedTextValue,
          options: {
            retry: {
              maxRetries: resolvedConfig.execution.retry_policy.max_retries,
              backoffMs: resolvedConfig.execution.retry_policy.backoff_ms ?? 0
            },
            signal: abortSignal
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
              entry.trial_id,
              embedResult.vector,
              embedTextValue
            )
          }
        });
        return {
          trial_id: entry.trial_id,
          embedding: { status: "success", vector: embedResult.vector }
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        bus.emit({
          type: "embedding.recorded",
          payload: {
            embedding_record: buildFailedEmbedding(entry.trial_id, message, embedTextValue)
          }
        });
        return { trial_id: entry.trial_id, embedding: { status: "failed" } };
      }
    }

    const persona = personaMap.get(assigned.persona);
    const protocol = protocolMap.get(assigned.protocol);
    if (!persona || !protocol) {
      throw new Error(`Missing persona/protocol for trial ${entry.trial_id}`);
    }

    const messages = buildMessages(resolvedConfig, persona.text ?? "", protocol.text ?? "");
    const timeout = createTimeoutSignal(
      resolvedConfig.protocol.timeouts.per_call_timeout_ms,
      abortSignal
    );

    let trialRecord: ArbiterTrialRecord;
    let rawAssistantText = "";
    let responsePayload: unknown;
    let actualModel: string | null = null;
    let retryCount = 0;
    let latencyMs = 0;
    let chatError: OpenRouterError | null = null;

    try {
      const chatResult = await chatCompletion({
        model: assigned.model,
        messages,
        params: assigned.decode,
        options: {
          retry: {
            maxRetries: resolvedConfig.protocol.timeouts.per_call_max_retries,
            backoffMs: resolvedConfig.execution.retry_policy.backoff_ms ?? 0
          },
          signal: timeout.signal
        }
      });

      retryCount = chatResult.retryCount;
      latencyMs = chatResult.latencyMs;
      responsePayload = chatResult.responseBody;
      actualModel = chatResult.modelHeader;
      rawAssistantText = extractAssistantText(chatResult.responseBody);

      trialRecord = {
        trial_id: entry.trial_id,
        requested_model_slug: assigned.model,
        actual_model: actualModel ?? null,
        protocol: "independent",
        status: "success",
        assigned_config: assigned,
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
        trial_id: entry.trial_id,
        requested_model_slug: assigned.model,
        actual_model: actualModel ?? null,
        protocol: "independent",
        status,
        assigned_config: assigned,
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
        error_code: timeout.didTimeout() ? "timeout_exhausted" : null,
        request_payload: asObject(chatError?.requestPayload),
        response_payload: asObject(responsePayload)
      };
    } finally {
      timeout.cancel();
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
      entry.trial_id,
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
          embedding_record: buildSkippedEmbedding(entry.trial_id, "trial_not_success")
        }
      });
      return { trial_id: entry.trial_id, embedding: { status: "skipped" } };
    }

    if (!embedTextValue) {
      bus.emit({
        type: "embedding.recorded",
        payload: {
          embedding_record: buildSkippedEmbedding(entry.trial_id, "empty_embed_text")
        }
      });
      return { trial_id: entry.trial_id, embedding: { status: "skipped" } };
    }

    try {
      const embedResult = await embedText({
        model: resolvedConfig.measurement.embedding_model,
        text: embedTextValue,
        options: {
          retry: {
            maxRetries: resolvedConfig.execution.retry_policy.max_retries,
            backoffMs: resolvedConfig.execution.retry_policy.backoff_ms ?? 0
          },
          signal: abortSignal
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
            entry.trial_id,
            embedResult.vector,
            embedTextValue
          )
        }
      });
      return {
        trial_id: entry.trial_id,
        embedding: { status: "success", vector: embedResult.vector }
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      bus.emit({
        type: "embedding.recorded",
        payload: {
          embedding_record: buildFailedEmbedding(entry.trial_id, message, embedTextValue)
        }
      });
      return { trial_id: entry.trial_id, embedding: { status: "failed" } };
    }
  };

  const runBatch = async (entries: TrialPlanEntry[]): Promise<TrialResult[]> => {
    const results: TrialResult[] = [];
    let index = 0;
    let inFlight = 0;

    return new Promise((resolve, reject) => {
      const launch = (): void => {
        while (inFlight < workerCount && index < entries.length && !shouldStop()) {
          const entry = entries[index];
          index += 1;
          inFlight += 1;
          executeTrial(entry)
            .then((result) => {
              results.push(result);
              inFlight -= 1;
              launch();
            })
            .catch((error) => {
              reject(error);
            });
        }

        if ((index >= entries.length || shouldStop()) && inFlight === 0) {
          resolve(results);
        }
      };

      launch();
    });
  };

  try {
    for (let batchStart = 0; batchStart < kMax; batchStart += batchSize) {
      if (shouldStop()) {
        stopReason = "user_interrupt";
        incomplete = true;
        break;
      }

      const batchNumber = Math.floor(batchStart / batchSize);
      const batchEntries = plan.slice(batchStart, batchStart + batchSize);
      const batchIds = batchEntries.map((entry) => entry.trial_id);
      const batchStartTime = Date.now();

      bus.emit({
        type: "batch.started",
        payload: { batch_number: batchNumber, trial_ids: batchIds }
      });

      const results = await runBatch(batchEntries);

      const completedIds = results.map((result) => result.trial_id).sort((a, b) => a - b);
      bus.emit({
        type: "batch.completed",
        payload: {
          batch_number: batchNumber,
          trial_ids: completedIds,
          elapsed_ms: Date.now() - batchStartTime
        }
      });

      attempted += results.length;

      const batchEligible = results.filter(
        (result) => result.embedding.status === "success"
      ).length;
      eligible += batchEligible;

      if (shouldStop()) {
        stopReason = "user_interrupt";
        incomplete = true;
        break;
      }
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
        stop_reason: stopReason,
        incomplete
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
