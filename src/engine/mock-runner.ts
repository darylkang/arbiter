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

type WeightedItem<T> = { weight: number } & T;

export interface MockRunOptions {
  bus: EventBus;
  runDir: string;
  resolvedConfig: ArbiterResolvedConfig;
  embeddingsJsonlPath: string;
  debugEnabled: boolean;
  embeddingDimensions?: number;
  beforeFinalize?: () => Promise<void>;
}

export interface MockRunResult {
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
): ArbiterTrialRecord["assigned_config"]["decode"] | undefined => {
  if (!decode) {
    return undefined;
  }

  const resolved: ArbiterTrialRecord["assigned_config"]["decode"] = {};

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
        const embedRng = createRngForTrial(resolvedConfig.run.seed, "embedding", trialId);

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

        const outcomeVariant = trialId % 3;
        const outcome = `Answer variant ${outcomeVariant}`;
        const rawAssistantText = `${outcome}\n`;
        const embedText =
          resolvedConfig.measurement.embed_text_strategy === "outcome_only"
            ? outcome
            : outcome || rawAssistantText;

        const trialRecord: ArbiterTrialRecord = {
          trial_id: trialId,
          requested_model_slug: model.model,
          actual_model: model.model,
          status: "success",
          assigned_config: {
            model: model.model,
            persona: persona.persona,
            protocol: protocol.protocol,
            decode
          },
          raw_assistant_text: rawAssistantText
        };

        bus.emit({ type: "trial.completed", payload: { trial_record: trialRecord } });

        const parsedRecord = buildParsedOutput(trialId, outcome, rawAssistantText, embedText);
        bus.emit({ type: "parsed.output", payload: { parsed_record: parsedRecord } });

        const vector = Array.from({ length: embeddingDimensions }, () => embedRng());
        const embeddingRecord: ArbiterDebugEmbeddingJSONLRecord = {
          trial_id: trialId,
          embedding_status: "success",
          vector_b64: encodeFloat32Base64(vector),
          dtype: "float32",
          encoding: "float32le_base64",
          dimensions: embeddingDimensions,
          embed_text_sha256: sha256Hex(embedText)
        };
        bus.emit({ type: "embedding.recorded", payload: { embedding_record: embeddingRecord } });

        attempted += 1;
        eligible += 1;
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
