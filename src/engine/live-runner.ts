import { existsSync, readdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";

import type { EventBus } from "../events/event-bus.js";
import type { ArbiterResolvedConfig } from "../generated/config.types.js";
import { finalizeEmbeddingsToArrow } from "../artifacts/embeddings.js";
import type { EmbeddingsProvenance } from "../artifacts/embeddings-provenance.js";
import { DEFAULT_EMBEDDING_MAX_CHARS } from "../config/defaults.js";
import { generateTrialPlan, type TrialPlanEntry } from "../planning/planner.js";
import { runBatchWithWorkers } from "./batch-executor.js";
import { EMBED_TEXT_NORMALIZATION } from "./embed-text.js";
import {
  createLiveTrialExecutor,
  type LiveTrialExecutionState
} from "./live-trial-executor.js";
import type { RunnerStopSignal } from "./trial-executor.js";

export interface LiveRunOptions {
  bus: EventBus;
  runDir: string;
  resolvedConfig: ArbiterResolvedConfig;
  embeddingsJsonlPath: string;
  debugEnabled: boolean;
  contractFailurePolicy?: "warn" | "exclude" | "fail";
  beforeFinalize?: () => Promise<void>;
  stop?: {
    shouldStop: () => boolean;
  };
  shutdown?: {
    signal: AbortSignal;
    isRequested: () => boolean;
  };
  precomputedPlan?: {
    plan: ReadonlyArray<Readonly<TrialPlanEntry>>;
    planSha256: string;
  };
}

export interface LiveRunResult {
  runId: string;
  runDir: string;
  kAttempted: number;
  kEligible: number;
  contractFailures: {
    fallback: number;
    failed: number;
    total: number;
  };
  embeddingsProvenance: EmbeddingsProvenance;
  embeddingsArrowPath?: string;
}

export const runLive = async (options: LiveRunOptions): Promise<LiveRunResult> => {
  const { bus, resolvedConfig } = options;
  const runId = resolvedConfig.run.run_id;
  const startedAt = new Date().toISOString();
  const embeddingMaxChars =
    resolvedConfig.measurement.embedding_max_chars ?? DEFAULT_EMBEDDING_MAX_CHARS;
  const hasDecisionContract = Boolean(resolvedConfig.protocol.decision_contract);

  const planData = options.precomputedPlan ?? generateTrialPlan(resolvedConfig);
  const plan = planData.plan;
  const planSha256 = planData.planSha256;
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
  let stopReason: "k_max_reached" | "user_interrupt" | "converged" | "error" = "k_max_reached";
  let incomplete = false;

  const shouldStop = (): RunnerStopSignal => {
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

  const state: LiveTrialExecutionState = {
    contractFailures: {
      fallback: 0,
      failed: 0
    },
    embeddingDimensions: null,
    actualEmbeddingModel: null,
    embeddingModelConflict: false,
    embeddingGenerationIds: new Set<string>()
  };

  const executeTrial = createLiveTrialExecutor({
    bus,
    resolvedConfig,
    personaMap,
    protocolMap,
    embeddingMaxChars,
    hasDecisionContract,
    contractFailurePolicy: options.contractFailurePolicy,
    shouldStop,
    abortSignal: options.shutdown?.signal,
    state
  });

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

      const results = await runBatchWithWorkers({
        entries: batchEntries,
        workerCount,
        shouldStop,
        execute: executeTrial
      });

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

    let provenance: EmbeddingsProvenance;
    let arrowPath: string | undefined;
    const provenanceMeta = {
      requestedEmbeddingModel: resolvedConfig.measurement.embedding_model,
      actualEmbeddingModel: state.actualEmbeddingModel,
      generationIds: Array.from(state.embeddingGenerationIds),
      embedTextStrategy: resolvedConfig.measurement.embed_text_strategy,
      normalization: EMBED_TEXT_NORMALIZATION
    };
    if (state.embeddingDimensions === null) {
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
        actual_embedding_model: provenanceMeta.actualEmbeddingModel ?? null,
        generation_ids: provenanceMeta.generationIds.length > 0 ? provenanceMeta.generationIds : undefined,
        embed_text_strategy: provenanceMeta.embedTextStrategy,
        normalization: provenanceMeta.normalization
      };
    } else {
      const finalizeResult = await finalizeEmbeddingsToArrow({
        runDir: options.runDir,
        dimensions: state.embeddingDimensions,
        debugJsonlPath: options.embeddingsJsonlPath,
        provenance: provenanceMeta
      });
      provenance = finalizeResult.provenance;
      arrowPath =
        provenance.status === "arrow_generated"
          ? resolve(options.runDir, "embeddings.arrow")
          : undefined;
    }

    if (!options.debugEnabled && provenance.status !== "jsonl_fallback") {
      if (existsSync(options.embeddingsJsonlPath)) {
        rmSync(options.embeddingsJsonlPath, { force: true });
      }
      const debugDir = resolve(options.runDir, "debug");
      if (existsSync(debugDir) && readdirSync(debugDir).length === 0) {
        rmSync(debugDir, { recursive: true, force: true });
      }
      if (provenance.status === "arrow_generated") {
        provenance = { ...provenance, debug_jsonl_present: false };
      }
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
      contractFailures: {
        fallback: state.contractFailures.fallback,
        failed: state.contractFailures.failed,
        total: state.contractFailures.fallback + state.contractFailures.failed
      },
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
