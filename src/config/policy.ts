import type { ArbiterResolvedConfig } from "../generated/config.types.js";
import type { ArbiterModelCatalog } from "../generated/catalog.types.js";

export type ContractFailurePolicy = "warn" | "exclude" | "fail";

export type RunPolicySnapshot = {
  strict: boolean;
  allow_free: boolean;
  allow_aliased: boolean;
  contract_failure_policy: ContractFailurePolicy;
};

export type PolicyEvaluation = {
  policy: RunPolicySnapshot;
  warnings: string[];
  errors: string[];
};

const MODEL_FREE_SUFFIX = ":free";

const isFreeModel = (slug: string, catalog: ArbiterModelCatalog): boolean => {
  if (slug.endsWith(MODEL_FREE_SUFFIX)) {
    return true;
  }
  const entry = catalog.models.find((model) => model.slug === slug);
  return entry?.tier === "free";
};

const isAliasedModel = (slug: string, catalog: ArbiterModelCatalog): boolean => {
  const entry = catalog.models.find((model) => model.slug === slug);
  return entry?.is_aliased === true;
};

const isSyntacticSlug = (slug: string): boolean => slug.includes("/");

const computeDiscreteConfigBucketCount = (resolvedConfig: ArbiterResolvedConfig): number => {
  const modelCount = resolvedConfig.sampling.models.length;
  const personaCount = resolvedConfig.sampling.personas.length;

  if (resolvedConfig.protocol.type === "debate") {
    const participants = resolvedConfig.protocol.participants ?? 2;
    return Math.pow(modelCount * personaCount, participants);
  }

  const protocolCount = resolvedConfig.sampling.protocols?.length ?? 0;
  return modelCount * personaCount * protocolCount;
};

export const evaluatePolicy = (input: {
  resolvedConfig: ArbiterResolvedConfig;
  catalog: ArbiterModelCatalog;
  strict: boolean;
  allowFree: boolean;
  allowAliased: boolean;
  contractFailurePolicy: ContractFailurePolicy;
}): PolicyEvaluation => {
  const warnings: string[] = [];
  const errors: string[] = [];

  const { resolvedConfig, catalog } = input;

  const freeModels = resolvedConfig.sampling.models
    .map((model) => model.model)
    .filter((slug) => isFreeModel(slug, catalog));
  const aliasedModels = resolvedConfig.sampling.models
    .map((model) => model.model)
    .filter((slug) => isAliasedModel(slug, catalog));
  const unknownModels = resolvedConfig.sampling.models
    .filter((model) => model.catalog_status === "unknown_to_catalog")
    .map((model) => model.model);
  const invalidSlugs = resolvedConfig.sampling.models
    .map((model) => model.model)
    .filter((slug) => !isSyntacticSlug(slug));

  if (invalidSlugs.length > 0) {
    warnings.push(`Model slugs without provider prefix: ${invalidSlugs.join(", ")}`);
  }

  if (unknownModels.length > 0) {
    warnings.push(`Models not found in catalog: ${unknownModels.join(", ")}`);
  }

  if (freeModels.length > 0) {
    const message = `Free-tier models are rate-limited and may be substituted: ${freeModels.join(", ")}`;
    if (input.strict && !input.allowFree) {
      errors.push(`${message}. Use --allow-free to proceed.`);
    } else {
      warnings.push(message);
    }
  }

  if (aliasedModels.length > 0) {
    const message = `Aliased models may change over time: ${aliasedModels.join(", ")}`;
    if (input.strict && !input.allowAliased) {
      errors.push(`${message}. Use --allow-aliased to proceed.`);
    } else {
      warnings.push(message);
    }
  }

  const discreteBucketCount = computeDiscreteConfigBucketCount(resolvedConfig);

  if (discreteBucketCount > 0) {
    const expectedPerBucket = resolvedConfig.execution.k_max / discreteBucketCount;
    if (expectedPerBucket < 2) {
      const decodeNote = resolvedConfig.sampling.decode
        ? " Decode variation may further thin effective coverage."
        : "";
      warnings.push(
        `Expected trials per discrete sampled configuration is low (${expectedPerBucket.toFixed(
          2
        )} across ${discreteBucketCount} configurations). Consider increasing k_max for stability.${decodeNote}`
      );
    }
  }

  if (resolvedConfig.execution.k_min < resolvedConfig.execution.batch_size) {
    warnings.push(
      "k_min is smaller than batch_size; convergence checks may be delayed until after the first batch."
    );
  }

  return {
    policy: {
      strict: input.strict,
      allow_free: input.allowFree,
      allow_aliased: input.allowAliased,
      contract_failure_policy: input.contractFailurePolicy
    },
    warnings,
    errors
  };
};
