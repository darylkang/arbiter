import type { ArbiterTrialRecord } from "../generated/trial.types.js";

export const deriveFailureStatus = (input: {
  timeoutExhausted: boolean;
  modelUnavailable: boolean;
}): ArbiterTrialRecord["status"] => {
  if (input.timeoutExhausted) {
    return "timeout_exhausted";
  }
  if (input.modelUnavailable) {
    return "model_unavailable";
  }
  return "error";
};
