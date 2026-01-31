import type { ArbiterResolvedConfig } from "../generated/config.types.js";
import type { ArbiterTrialRecord } from "../generated/trial.types.js";
import { canonicalStringify } from "../utils/canonical-json.js";
import { sha256Hex } from "../utils/hash.js";
import { createRngForTrial } from "../utils/seeded-rng.js";

type WeightedItem<T> = { weight: number } & T;

export type TrialPlanEntry = {
  trial_id: number;
  assigned_config: ArbiterTrialRecord["assigned_config"];
};

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

export const generateTrialPlan = (
  config: ArbiterResolvedConfig
): { plan: TrialPlanEntry[]; planSha256: string } => {
  const plan: TrialPlanEntry[] = [];

  for (let trialId = 0; trialId < config.execution.k_max; trialId += 1) {
    const planRng = createRngForTrial(config.run.seed, "plan", trialId);
    const decodeRng = createRngForTrial(config.run.seed, "decode", trialId);

    const model = sampleWeighted(config.sampling.models, planRng);
    const persona = sampleWeighted(config.sampling.personas, planRng);
    const protocol = sampleWeighted(config.sampling.protocols, planRng);
    const decode = resolveDecodeParams(config.sampling.decode, decodeRng);

    plan.push({
      trial_id: trialId,
      assigned_config: {
        model: model.model,
        persona: persona.persona,
        protocol: protocol.protocol,
        decode
      }
    });
  }

  const planSha256 = sha256Hex(canonicalStringify(plan));
  return { plan, planSha256 };
};
