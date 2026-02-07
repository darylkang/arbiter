import type { TrialPlanEntry } from "../planning/planner.js";

export type TrialEmbeddingResult =
  | { status: "success"; vector: number[] }
  | { status: "failed" | "skipped" };

export type TrialExecutionResult = {
  trial_id: number;
  embedding: TrialEmbeddingResult;
};

export type TrialExecutor = (entry: TrialPlanEntry) => Promise<TrialExecutionResult>;

export type RunnerStopSignal = {
  stop: boolean;
  reason?: "user_interrupt" | "converged";
};
