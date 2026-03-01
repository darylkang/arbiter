import { readFileSync } from "node:fs";

import type { RunStartedPayload } from "../events/types.js";
import { DEFAULT_STOP_POLICY } from "../config/defaults.js";
import type { RunPolicySnapshot } from "../config/policy.js";
import type { ArbiterResolvedConfig } from "../generated/config.types.js";
import type { ArbiterRunManifest } from "../generated/manifest.types.js";
import { canonicalStringify } from "../utils/canonical-json.js";
import { sha256Hex } from "../utils/hash.js";
import type { EmbeddingsProvenance } from "./embeddings-provenance.js";

export type ArtifactCounts = {
  trialPlan: number;
  trials: number;
  monitoring: number;
  embeddings: number;
  embeddingSuccess: number;
  embeddingFailed: number;
  embeddingSkipped: number;
  groupAssignments: number;
};

export const readPackageVersion = (packageJsonPath: string): string => {
  const raw = readFileSync(packageJsonPath, "utf8");
  const parsed = JSON.parse(raw) as { version?: string };
  return parsed.version ?? "0.0.0";
};

export const buildInitialManifest = (input: {
  payload: RunStartedPayload;
  resolvedConfig: ArbiterResolvedConfig;
  catalogVersion: string;
  catalogSha256: string;
  promptManifestSha256: string;
  packageJsonPath: string;
  policy?: RunPolicySnapshot;
}): ArbiterRunManifest => {
  const { payload, resolvedConfig } = input;
  const configSha256 = sha256Hex(canonicalStringify(payload.resolved_config));
  const arbiterVersion = readPackageVersion(input.packageJsonPath);
  const stopPolicy = resolvedConfig.execution.stop_policy ?? DEFAULT_STOP_POLICY;

  const manifest: ArbiterRunManifest = {
    schema_version: "1.0.0",
    arbiter_version: arbiterVersion,
    run_id: payload.run_id,
    started_at: payload.started_at,
    completed_at: payload.started_at,
    timestamps: {
      started_at: payload.started_at,
      completed_at: payload.started_at
    },
    stop_reason: "completed",
    stopping_mode: resolvedConfig.execution.stop_mode,
    incomplete: false,
    k_attempted: 0,
    k_eligible: 0,
    k_min: resolvedConfig.execution.k_min,
    k_min_count_rule: resolvedConfig.execution.k_min_count_rule,
    stop_policy: {
      novelty_epsilon: stopPolicy.novelty_epsilon,
      similarity_threshold: stopPolicy.similarity_threshold,
      patience: stopPolicy.patience,
      k_min_eligible: resolvedConfig.execution.k_min
    },
    hash_algorithm: "sha256",
    config_sha256: configSha256,
    plan_sha256: payload.plan_sha256,
    k_planned: payload.k_planned,
    model_catalog_version: input.catalogVersion,
    model_catalog_sha256: input.catalogSha256,
    prompt_manifest_sha256: input.promptManifestSha256,
    provenance: {
      arbiter_version: arbiterVersion,
      config_sha256: configSha256,
      plan_sha256: payload.plan_sha256,
      model_catalog_version: input.catalogVersion,
      model_catalog_sha256: input.catalogSha256,
      prompt_manifest_sha256: input.promptManifestSha256,
      hash_algorithm: "sha256"
    },
    artifacts: { entries: [] }
  };

  if (input.policy) {
    manifest.policy = input.policy;
  }

  return manifest;
};

export const buildArtifactEntries = (input: {
  debugEnabled: boolean;
  clusteringEnabled: boolean;
  counts: ArtifactCounts;
  embeddingsProvenance: EmbeddingsProvenance | null;
  extraArtifacts: Iterable<{ path: string; record_count?: number }>;
}): Array<{ path: string; record_count?: number; note?: string }> => {
  const entries: Array<{ path: string; record_count?: number; note?: string }> = [
    { path: "config.source.json" },
    { path: "config.resolved.json" },
    { path: "manifest.json" },
    { path: "trial_plan.jsonl", record_count: input.counts.trialPlan },
    { path: "trials.jsonl", record_count: input.counts.trials },
    { path: "monitoring.jsonl", record_count: input.counts.monitoring },
    { path: "receipt.txt" }
  ];

  if (input.embeddingsProvenance?.status === "arrow_generated") {
    entries.push({ path: "embeddings.arrow" });
  }

  if (input.debugEnabled || input.embeddingsProvenance?.status === "jsonl_fallback") {
    entries.push({
      path: "embeddings.jsonl",
      record_count: input.counts.embeddings
    });
  }

  if (input.clusteringEnabled) {
    entries.push({
      path: "groups/assignments.jsonl",
      record_count: input.counts.groupAssignments
    });
    entries.push({ path: "groups/state.json" });
  }

  for (const entry of input.extraArtifacts) {
    entries.push(entry);
  }

  return entries;
};

export const applyContractFailurePolicy = (input: {
  manifest: ArbiterRunManifest;
  resolvedConfig: ArbiterResolvedConfig;
  policy?: RunPolicySnapshot;
  contractParseCounts: {
    fallback: number;
    failed: number;
  };
}): void => {
  if (!input.policy) {
    return;
  }
  if (!input.resolvedConfig.protocol.decision_contract) {
    return;
  }
  if (input.policy.contract_failure_policy !== "fail") {
    return;
  }

  const failures = input.contractParseCounts.fallback + input.contractParseCounts.failed;
  if (failures === 0) {
    return;
  }

  input.manifest.stop_reason = "error";
  input.manifest.incomplete = true;
  const message = `Contract parse failures: fallback=${input.contractParseCounts.fallback}, failed=${input.contractParseCounts.failed}`;
  input.manifest.notes = input.manifest.notes
    ? `${input.manifest.notes}; ${message}`
    : message;
};
