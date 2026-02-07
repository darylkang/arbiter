import type { TrialPlanEntry } from "../planning/planner.js";
import { executeLiveDebateTrial } from "../protocols/debate-v1/live-trial.js";
import { executeLiveIndependentTrial } from "../protocols/independent/live-trial.js";
import type { TrialExecutor } from "./trial-executor.js";
import type { LiveTrialExecutionContext } from "./live-trial-context.js";

export type {
  LiveTrialExecutionContext,
  LiveTrialExecutionState,
  PersonaEntry,
  ProtocolEntry
} from "./live-trial-context.js";

export type CreateLiveTrialExecutorOptions = LiveTrialExecutionContext;

export const createLiveTrialExecutor = (
  context: CreateLiveTrialExecutorOptions
): TrialExecutor => {
  return async (entry: TrialPlanEntry) => {
    if (entry.protocol === "debate_v1") {
      return executeLiveDebateTrial({ context, entry });
    }

    return executeLiveIndependentTrial({ context, entry });
  };
};
