import { existsSync, readdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";

import type { EmbeddingsProvenance } from "../artifacts/embeddings-provenance.js";
import { DEFAULT_EMBEDDING_MAX_CHARS } from "../config/defaults.js";
import type { EventBus } from "../events/event-bus.js";
import type { ArbiterResolvedConfig } from "../generated/config.types.js";
import { generateTrialPlan, type TrialPlanEntry } from "../planning/planner.js";
import { runBatchWithWorkers } from "./batch-executor.js";
import type { RunnerStopSignal, TrialExecutor } from "./trial-executor.js";

type StopReason = "k_max_reached" | "user_interrupt" | "converged";

type ContractFailureState = {
  contractFailures: {
    fallback: number;
    failed: number;
  };
  embeddingGenerationIds: Set<string>;
};

type ExecutorContext<State extends ContractFailureState> = {
  bus: EventBus;
  resolvedConfig: ArbiterResolvedConfig;
  embeddingMaxChars: number;
  hasDecisionContract: boolean;
  contractFailurePolicy?: "warn" | "exclude" | "fail";
  shouldStop: () => RunnerStopSignal;
  abortSignal?: AbortSignal;
  state: State;
};

type FinalizeContext<State extends ContractFailureState> = {
  runDir: string;
  resolvedConfig: ArbiterResolvedConfig;
  embeddingsJsonlPath: string;
  state: State;
  eligible: number;
};

type FinalizeResult = {
  provenance: EmbeddingsProvenance;
  embeddingsArrowPath?: string;
};

type RunOrchestrationOptions<State extends ContractFailureState> = {
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
  createState: () => State;
  createExecutor: (context: ExecutorContext<State>) => TrialExecutor;
  finalizeEmbeddings: (context: FinalizeContext<State>) => Promise<FinalizeResult>;
};

export type RunOrchestrationResult = {
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
};

const toRunFailureCode = (error: unknown): string | undefined => {
  if (!error || typeof error !== "object") {
    return undefined;
  }
  const code = (error as { code?: unknown }).code;
  if (typeof code !== "string") {
    return undefined;
  }
  const trimmed = code.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const cleanupDebugArtifacts = (input: {
  debugEnabled: boolean;
  provenance: EmbeddingsProvenance;
  embeddingsJsonlPath: string;
  runDir: string;
}): EmbeddingsProvenance => {
  let provenance = input.provenance;
  if (input.debugEnabled || provenance.status === "jsonl_fallback") {
    return provenance;
  }

  if (existsSync(input.embeddingsJsonlPath)) {
    rmSync(input.embeddingsJsonlPath, { force: true });
  }
  const debugDir = resolve(input.runDir, "debug");
  if (existsSync(debugDir) && readdirSync(debugDir).length === 0) {
    rmSync(debugDir, { recursive: true, force: true });
  }

  if (provenance.status === "arrow_generated") {
    provenance = { ...provenance, debug_jsonl_present: false };
  }
  return provenance;
};

export const runOrchestration = async <State extends ContractFailureState>(
  options: RunOrchestrationOptions<State>
): Promise<RunOrchestrationResult> => {
  const { bus, resolvedConfig } = options;
  const runId = resolvedConfig.run.run_id;
  const startedAt = new Date().toISOString();
  const embeddingMaxChars =
    resolvedConfig.measurement.embedding_max_chars ?? DEFAULT_EMBEDDING_MAX_CHARS;
  const hasDecisionContract = Boolean(resolvedConfig.protocol.decision_contract);
  const planData = options.precomputedPlan ?? generateTrialPlan(resolvedConfig);
  const plan = planData.plan;
  const planSha256 = planData.planSha256;

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
  let stopReason: StopReason = "k_max_reached";
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

  const state = options.createState();
  const executeTrial = options.createExecutor({
    bus,
    resolvedConfig,
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
      await bus.flush();

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

    let { provenance, embeddingsArrowPath } = await options.finalizeEmbeddings({
      runDir: options.runDir,
      resolvedConfig,
      embeddingsJsonlPath: options.embeddingsJsonlPath,
      state,
      eligible
    });
    provenance = cleanupDebugArtifacts({
      debugEnabled: options.debugEnabled,
      provenance,
      embeddingsJsonlPath: options.embeddingsJsonlPath,
      runDir: options.runDir
    });

    bus.emit({ type: "embeddings.finalized", payload: { provenance } });
    await bus.flush();

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
    await bus.flush();

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
      embeddingsArrowPath
    };
  } catch (error) {
    const completedAt = new Date().toISOString();
    const message = error instanceof Error ? error.message : String(error);
    bus.emit({
      type: "run.failed",
      payload: {
        run_id: runId,
        completed_at: completedAt,
        error: message,
        error_code: toRunFailureCode(error)
      }
    });
    await bus.flush();
    throw error;
  }
};
