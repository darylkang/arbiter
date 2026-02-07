import type { ArbiterResolvedConfig } from "../generated/config.types.js";
import type { RunPolicySnapshot } from "../config/policy.js";
import { generateTrialPlan, type TrialPlanEntry } from "./planner.js";

const deepFreeze = <T>(value: T): T => {
  if (value === null || typeof value !== "object") {
    return value;
  }
  const record = value as Record<string, unknown>;
  Object.values(record).forEach((nested) => {
    deepFreeze(nested);
  });
  return Object.freeze(value);
};

export type CompiledRunPlan = Readonly<{
  runId: string;
  runDir: string;
  resolvedConfig: ArbiterResolvedConfig;
  plan: ReadonlyArray<Readonly<TrialPlanEntry>>;
  planSha256: string;
  policy: RunPolicySnapshot;
}>;

export const compileRunPlan = (input: {
  runId: string;
  runDir: string;
  resolvedConfig: ArbiterResolvedConfig;
  policy: RunPolicySnapshot;
}): CompiledRunPlan => {
  const clonedConfig = structuredClone(input.resolvedConfig);
  deepFreeze(clonedConfig);

  const generated = generateTrialPlan(clonedConfig);
  const frozenPlan = generated.plan.map((entry) => deepFreeze({ ...entry }));

  return deepFreeze({
    runId: input.runId,
    runDir: input.runDir,
    resolvedConfig: clonedConfig,
    plan: frozenPlan,
    planSha256: generated.planSha256,
    policy: deepFreeze(structuredClone(input.policy))
  });
};
