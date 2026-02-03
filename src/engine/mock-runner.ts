import { existsSync, readdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";

import type { EventBus } from "../events/event-bus.js";
import type { ArbiterResolvedConfig } from "../generated/config.types.js";
import type { ArbiterTrialRecord } from "../generated/trial.types.js";
import type { ArbiterParsedOutputRecord } from "../generated/parsed-output.types.js";
import type { ArbiterDebugEmbeddingJSONLRecord } from "../generated/embedding.types.js";
import { finalizeEmbeddingsToArrow } from "../artifacts/embeddings.js";
import type { EmbeddingsProvenance } from "../artifacts/embeddings-provenance.js";
import { sha256Hex } from "../utils/hash.js";
import { encodeFloat32Base64 } from "../utils/float32-base64.js";
import { createRngForTrial } from "../utils/seeded-rng.js";
import { DEFAULT_EMBEDDING_MAX_CHARS } from "../config/defaults.js";
import { generateTrialPlan, type TrialPlanEntry } from "./planner.js";
import { buildDebateParsedOutput } from "./debate-v1.js";
import { prepareEmbedText, EMBED_TEXT_NORMALIZATION } from "./embed-text.js";
import { buildParsedOutputWithContract } from "./contract-extraction.js";

export interface MockRunOptions {
  bus: EventBus;
  runDir: string;
  resolvedConfig: ArbiterResolvedConfig;
  embeddingsJsonlPath: string;
  debugEnabled: boolean;
  embeddingDimensions?: number;
  beforeFinalize?: () => Promise<void>;
  stop?: {
    shouldStop: () => boolean;
  };
  shutdown?: {
    signal: AbortSignal;
    isRequested: () => boolean;
  };
}

export interface MockRunResult {
  runId: string;
  runDir: string;
  kAttempted: number;
  kEligible: number;
  embeddingsProvenance: EmbeddingsProvenance;
  embeddingsArrowPath?: string;
}

const buildIndependentParsedOutput = (
  trialId: number,
  outcome: string,
  rawAssistantText: string,
  embedText: string
): ArbiterParsedOutputRecord => ({
  trial_id: trialId,
  parse_status: "success",
  outcome,
  raw_assistant_text: rawAssistantText,
  embed_text: embedText,
  parser_version: "mock-v0"
});

export const runMock = async (options: MockRunOptions): Promise<MockRunResult> => {
  const { bus, resolvedConfig } = options;
  const runId = resolvedConfig.run.run_id;
  const startedAt = new Date().toISOString();
  const embeddingDimensions = options.embeddingDimensions ?? 4;
  const embeddingMaxChars =
    resolvedConfig.measurement.embedding_max_chars ?? DEFAULT_EMBEDDING_MAX_CHARS;
  const delayMs = Number(process.env.ARBITER_MOCK_DELAY_MS ?? 0);
  const forceEmptyEmbedText = process.env.ARBITER_MOCK_EMPTY_EMBED === "1";

  const { plan, planSha256 } = generateTrialPlan(resolvedConfig);
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

  for (const entry of plan) {
    bus.emit({
      type: "trial.planned",
      payload: {
        trial_id: entry.trial_id,
        protocol: entry.protocol,
        assigned_config: entry.assigned_config,
        role_assignments: entry.role_assignments
      }
    });
  }

  const kMax = plan.length;
  const batchSize = resolvedConfig.execution.batch_size;
  const workerCount = Math.max(1, resolvedConfig.execution.workers);
  let attempted = 0;
  let eligible = 0;
  const embeddingGenerationIds = new Set<string>();
  let stopReason: "k_max_reached" | "user_interrupt" | "converged" = "k_max_reached";
  let incomplete = false;

  const shouldStop = (): { stop: boolean; reason?: "user_interrupt" | "converged" } => {
    const interrupted = options.shutdown?.isRequested() ?? false;
    const converged = options.stop?.shouldStop() ?? false;
    if (interrupted) {
      return { stop: true, reason: "user_interrupt" };
    }
    if (converged) {
      return { stop: true, reason: "converged" };
    }
    return { stop: false };
  };

  type TrialResult = {
    trial_id: number;
    embedding:
      | { status: "success"; vector: number[] }
      | { status: "failed" | "skipped" };
  };

  const executeTrial = async (entry: TrialPlanEntry): Promise<TrialResult> => {
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    const embedRng = createRngForTrial(resolvedConfig.run.seed, "embedding", entry.trial_id);

    const outcomeVariant = entry.trial_id % 3;
    const outcome = `Answer variant ${outcomeVariant}`;
    const rawAssistantText = `${outcome}\n`;

    if (entry.protocol === "debate_v1") {
      const proposerIntro = `Proposer opening ${entry.trial_id}`;
      const criticReply = `Critic response ${entry.trial_id}`;
      const finalPayload =
        entry.trial_id % 3 === 0
          ? `Here is the decision:\n\`\`\`json\n${JSON.stringify({
              decision: `Decision ${entry.trial_id}`,
              confidence: "medium",
              reasoning: "Mock reasoning"
            })}\n\`\`\``
          : entry.trial_id % 3 === 1
            ? `${JSON.stringify({
                decision: `Decision ${entry.trial_id}`,
                confidence: "low",
                reasoning: "Mock reasoning unfenced"
              })}`
            : `Raw final content ${entry.trial_id}`;

      const calls: NonNullable<ArbiterTrialRecord["calls"]> = [
        {
          call_index: 0,
          turn: 0,
          role: "proposer",
          model_requested: entry.assigned_config.model,
          model_actual: entry.assigned_config.model,
          request_payload: { mock: true, turn: 0 },
          response_payload: { content: proposerIntro },
          attempt: {
            started_at: new Date().toISOString(),
            completed_at: new Date().toISOString(),
            latency_ms: 0,
            retry_count: 0
          },
          error_message: null
        },
        {
          call_index: 1,
          turn: 1,
          role: "critic",
          model_requested: entry.assigned_config.model,
          model_actual: entry.assigned_config.model,
          request_payload: { mock: true, turn: 1 },
          response_payload: { content: criticReply },
          attempt: {
            started_at: new Date().toISOString(),
            completed_at: new Date().toISOString(),
            latency_ms: 0,
            retry_count: 0
          },
          error_message: null
        },
        {
          call_index: 2,
          turn: 2,
          role: "proposer",
          model_requested: entry.assigned_config.model,
          model_actual: entry.assigned_config.model,
          request_payload: { mock: true, turn: 2 },
          response_payload: { content: finalPayload },
          attempt: {
            started_at: new Date().toISOString(),
            completed_at: new Date().toISOString(),
            latency_ms: 0,
            retry_count: 0
          },
          error_message: null
        }
      ];

      const transcript: NonNullable<ArbiterTrialRecord["transcript"]> = [
        { turn: 0, role: "proposer", content: proposerIntro },
        { turn: 1, role: "critic", content: criticReply },
        { turn: 2, role: "proposer", content: finalPayload }
      ];

      const trialRecord: ArbiterTrialRecord = {
        trial_id: entry.trial_id,
        requested_model_slug: entry.assigned_config.model,
        actual_model: entry.assigned_config.model,
        protocol: "debate_v1",
        status: "success",
        assigned_config: entry.assigned_config,
        role_assignments: entry.role_assignments,
        calls,
        transcript,
        raw_assistant_text: finalPayload
      };

      bus.emit({ type: "trial.completed", payload: { trial_record: trialRecord } });

    const parsedRecord = buildDebateParsedOutput(
      entry.trial_id,
      finalPayload,
      resolvedConfig.protocol.decision_contract ?? undefined
    );
      const rawEmbedText = forceEmptyEmbedText ? "" : parsedRecord.embed_text ?? "";
      const preparation = prepareEmbedText(rawEmbedText, embeddingMaxChars);
      parsedRecord.embed_text = preparation.text || undefined;
      bus.emit({ type: "parsed.output", payload: { parsed_record: parsedRecord } });

      if (preparation.was_empty) {
        const embeddingRecord: ArbiterDebugEmbeddingJSONLRecord = {
          trial_id: entry.trial_id,
          embedding_status: "skipped",
          vector_b64: null,
          dtype: "float32",
          encoding: "float32le_base64",
          skip_reason: "empty_embed_text",
          embed_text_sha256: undefined,
          embed_text_truncated: preparation.truncated,
          embed_text_original_chars: preparation.original_chars,
          embed_text_final_chars: preparation.final_chars,
          truncation_reason: preparation.truncation_reason
        };
        bus.emit({ type: "embedding.recorded", payload: { embedding_record: embeddingRecord } });
        return { trial_id: entry.trial_id, embedding: { status: "skipped" } };
      }

      const vector = Array.from({ length: embeddingDimensions }, () => embedRng());
      const generationId = `mock-embed-${entry.trial_id}`;
      embeddingGenerationIds.add(generationId);
      const embeddingRecord: ArbiterDebugEmbeddingJSONLRecord = {
        trial_id: entry.trial_id,
        embedding_status: "success",
        vector_b64: encodeFloat32Base64(vector),
        dtype: "float32",
        encoding: "float32le_base64",
        dimensions: embeddingDimensions,
        embed_text_sha256: sha256Hex(preparation.text),
        generation_id: generationId,
        embed_text_truncated: preparation.truncated,
        embed_text_original_chars: preparation.original_chars,
        embed_text_final_chars: preparation.final_chars,
        truncation_reason: preparation.truncation_reason
      };
      bus.emit({ type: "embedding.recorded", payload: { embedding_record: embeddingRecord } });

      return { trial_id: entry.trial_id, embedding: { status: "success", vector } };
    }

    const embedTextValue =
      resolvedConfig.measurement.embed_text_strategy === "outcome_only"
        ? outcome
        : outcome || rawAssistantText;

    const trialRecord: ArbiterTrialRecord = {
      trial_id: entry.trial_id,
      requested_model_slug: entry.assigned_config.model,
      actual_model: entry.assigned_config.model,
      protocol: "independent",
      status: "success",
      assigned_config: entry.assigned_config,
      raw_assistant_text: rawAssistantText
    };

    bus.emit({ type: "trial.completed", payload: { trial_record: trialRecord } });

    const parsedRecord = resolvedConfig.protocol.decision_contract
      ? buildParsedOutputWithContract({
          trialId: entry.trial_id,
          content: rawAssistantText,
          contract: resolvedConfig.protocol.decision_contract,
          parserVersion: "independent-v1"
        })
      : buildIndependentParsedOutput(
          entry.trial_id,
          outcome,
          rawAssistantText,
          embedTextValue
        );
    const preparation = prepareEmbedText(
      forceEmptyEmbedText ? "" : parsedRecord.embed_text ?? "",
      embeddingMaxChars
    );
    parsedRecord.embed_text = preparation.text || undefined;
    bus.emit({ type: "parsed.output", payload: { parsed_record: parsedRecord } });

    if (preparation.was_empty) {
      const embeddingRecord: ArbiterDebugEmbeddingJSONLRecord = {
        trial_id: entry.trial_id,
        embedding_status: "skipped",
        vector_b64: null,
        dtype: "float32",
        encoding: "float32le_base64",
        skip_reason: "empty_embed_text",
        embed_text_sha256: undefined,
        embed_text_truncated: preparation.truncated,
        embed_text_original_chars: preparation.original_chars,
        embed_text_final_chars: preparation.final_chars,
        truncation_reason: preparation.truncation_reason
      };
      bus.emit({ type: "embedding.recorded", payload: { embedding_record: embeddingRecord } });
      return { trial_id: entry.trial_id, embedding: { status: "skipped" } };
    }

    const vector = Array.from({ length: embeddingDimensions }, () => embedRng());
    const generationId = `mock-embed-${entry.trial_id}`;
    embeddingGenerationIds.add(generationId);
    const embeddingRecord: ArbiterDebugEmbeddingJSONLRecord = {
      trial_id: entry.trial_id,
      embedding_status: "success",
      vector_b64: encodeFloat32Base64(vector),
      dtype: "float32",
      encoding: "float32le_base64",
      dimensions: embeddingDimensions,
      embed_text_sha256: sha256Hex(preparation.text),
      generation_id: generationId,
      embed_text_truncated: preparation.truncated,
      embed_text_original_chars: preparation.original_chars,
      embed_text_final_chars: preparation.final_chars,
      truncation_reason: preparation.truncation_reason
    };
    bus.emit({ type: "embedding.recorded", payload: { embedding_record: embeddingRecord } });

    return { trial_id: entry.trial_id, embedding: { status: "success", vector } };
  };

  const runBatch = async (entries: TrialPlanEntry[]): Promise<TrialResult[]> => {
    const results: TrialResult[] = [];
    let index = 0;
    let inFlight = 0;

    return new Promise((resolve, reject) => {
      const launch = (): void => {
        while (inFlight < workerCount && index < entries.length && !shouldStop().stop) {
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

        if ((index >= entries.length || shouldStop().stop) && inFlight === 0) {
          resolve(results);
        }
      };

      launch();
    });
  };

  try {
    for (let batchStart = 0; batchStart < kMax; batchStart += batchSize) {
      const preStop = shouldStop();
      if (preStop.stop) {
        stopReason = preStop.reason ?? "user_interrupt";
        incomplete = stopReason === "user_interrupt";
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
      eligible += results.filter((result) => result.embedding.status === "success").length;

      const postStop = shouldStop();
      if (postStop.stop) {
        stopReason = postStop.reason ?? "user_interrupt";
        incomplete = stopReason === "user_interrupt";
        break;
      }
    }

    if (options.beforeFinalize) {
      await options.beforeFinalize();
    }

    const provenanceMeta = {
      requestedEmbeddingModel: resolvedConfig.measurement.embedding_model,
      actualEmbeddingModel: null,
      generationIds: Array.from(embeddingGenerationIds),
      embedTextStrategy: resolvedConfig.measurement.embed_text_strategy,
      normalization: EMBED_TEXT_NORMALIZATION
    };

    let provenance: EmbeddingsProvenance;
    if (eligible === 0) {
      provenance = {
        schema_version: "1.0.0",
        status: "not_generated",
        reason: "no_successful_embeddings",
        intended_primary_format: "arrow_ipc_file",
        primary_format: "none",
        dtype: "float32",
        dimensions: null,
        note: "No successful embeddings; arrow file not generated",
        requested_embedding_model: provenanceMeta.requestedEmbeddingModel,
        actual_embedding_model: provenanceMeta.actualEmbeddingModel,
        embed_text_strategy: provenanceMeta.embedTextStrategy,
        normalization: provenanceMeta.normalization
      };
    } else {
      const finalizeResult = await finalizeEmbeddingsToArrow({
        runDir: options.runDir,
        dimensions: embeddingDimensions,
        debugJsonlPath: options.embeddingsJsonlPath,
        provenance: provenanceMeta
      });
      provenance = finalizeResult.provenance;
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
      embeddingsArrowPath:
        provenance.status === "arrow_generated"
          ? resolve(options.runDir, "embeddings.arrow")
          : undefined
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
