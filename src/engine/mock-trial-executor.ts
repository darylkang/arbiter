import { createRngForTrial } from "../utils/seeded-rng.js";
import type { TrialPlanEntry } from "../planning/planner.js";
import { executeMockDebateTrial } from "../protocols/debate-v1/mock-trial.js";
import { executeMockIndependentTrial } from "../protocols/independent/mock-trial.js";
import type { TrialExecutor } from "./trial-executor.js";
import type { MockTrialExecutionContext } from "./mock-trial-context.js";

export type {
  MockTrialExecutionContext,
  MockTrialExecutionState
} from "./mock-trial-context.js";

export type CreateMockTrialExecutorOptions = MockTrialExecutionContext;

export const createMockTrialExecutor = (
  context: CreateMockTrialExecutorOptions
): TrialExecutor => {
  return async (entry: TrialPlanEntry) => {
    if (context.delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, context.delayMs));
    }

    const embedRng = createRngForTrial(context.resolvedConfig.run.seed, "embedding", entry.trial_id);

    if (entry.protocol === "debate_v1") {
      return executeMockDebateTrial({ context, entry, embedRng });
    }

    return executeMockIndependentTrial({ context, entry, embedRng });
  };
};
