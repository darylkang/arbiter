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
import { createRngForTrial } from "../utils/seeded-rng.js";
import { generateTrialPlan, type TrialPlanEntry } from "./planner.js";

export interface MockRunOptions {
  bus: EventBus;
  runDir: string;
  resolvedConfig: ArbiterResolvedConfig;
  embeddingsJsonlPath: string;
  debugEnabled: boolean;
  embeddingDimensions?: number;
  beforeFinalize?: () => Promise<void>;
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

const encodeFloat32Base64 = (values: number[]): string => {
  const array = new Float32Array(values);
  const buffer = Buffer.from(array.buffer, array.byteOffset, array.byteLength);
  return buffer.toString("base64");
};

const buildParsedOutput = (
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
  const delayMs = Number(process.env.ARBITER_MOCK_DELAY_MS ?? 0);

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

  const kMax = plan.length;
  const batchSize = resolvedConfig.execution.batch_size;
  const workerCount = Math.max(1, resolvedConfig.execution.workers);
  let attempted = 0;
  let eligible = 0;
  let stopReason: "k_max_reached" | "user_interrupt" = "k_max_reached";
  let incomplete = false;

  const shouldStop = (): boolean => options.shutdown?.isRequested() ?? false;

  type TrialResult = {
    trial_id: number;
    vector: number[];
  };

  const executeTrial = async (entry: TrialPlanEntry): Promise<TrialResult> => {
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    const embedRng = createRngForTrial(resolvedConfig.run.seed, "embedding", entry.trial_id);

    bus.emit({
      type: "trial.planned",
      payload: {
        trial_id: entry.trial_id,
        assignment: entry.assigned_config
      }
    });

    const outcomeVariant = entry.trial_id % 3;
    const outcome = `Answer variant ${outcomeVariant}`;
    const rawAssistantText = `${outcome}\n`;
    const embedTextValue =
      resolvedConfig.measurement.embed_text_strategy === "outcome_only"
        ? outcome
        : outcome || rawAssistantText;

    const trialRecord: ArbiterTrialRecord = {
      trial_id: entry.trial_id,
      requested_model_slug: entry.assigned_config.model,
      actual_model: entry.assigned_config.model,
      status: "success",
      assigned_config: entry.assigned_config,
      raw_assistant_text: rawAssistantText
    };

    bus.emit({ type: "trial.completed", payload: { trial_record: trialRecord } });

    const parsedRecord = buildParsedOutput(
      entry.trial_id,
      outcome,
      rawAssistantText,
      embedTextValue
    );
    bus.emit({ type: "parsed.output", payload: { parsed_record: parsedRecord } });

    const vector = Array.from({ length: embeddingDimensions }, () => embedRng());
    const embeddingRecord: ArbiterDebugEmbeddingJSONLRecord = {
      trial_id: entry.trial_id,
      embedding_status: "success",
      vector_b64: encodeFloat32Base64(vector),
      dtype: "float32",
      encoding: "float32le_base64",
      dimensions: embeddingDimensions,
      embed_text_sha256: sha256Hex(embedTextValue)
    };
    bus.emit({ type: "embedding.recorded", payload: { embedding_record: embeddingRecord } });

    return { trial_id: entry.trial_id, vector };
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
      eligible += results.length;

      if (shouldStop()) {
        stopReason = "user_interrupt";
        incomplete = true;
        break;
      }
    }

    if (options.beforeFinalize) {
      await options.beforeFinalize();
    }

    const finalizeResult = await finalizeEmbeddingsToArrow({
      runDir: options.runDir,
      dimensions: embeddingDimensions,
      debugJsonlPath: options.embeddingsJsonlPath
    });

    let provenance = finalizeResult.provenance;
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
