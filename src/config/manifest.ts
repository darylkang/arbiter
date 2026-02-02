import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { ArbiterResolvedConfig } from "../generated/config.types.js";
import type { ArbiterRunManifest } from "../generated/manifest.types.js";
import { canonicalStringify } from "../utils/canonical-json.js";
import { sha256Hex } from "../utils/hash.js";
import { DEFAULT_STOP_POLICY } from "./defaults.js";

export interface ManifestInputs {
  runId: string;
  resolvedConfig: ArbiterResolvedConfig;
  catalogVersion: string;
  catalogSha256: string;
  promptManifestSha256: string;
  hashAlgorithm?: "sha256";
  now?: Date;
  packageJsonPath?: string;
}

const readPackageVersion = (packageJsonPath: string): string => {
  const raw = readFileSync(packageJsonPath, "utf8");
  const parsed = JSON.parse(raw) as { version?: string };
  return parsed.version ?? "0.0.0";
};

export const buildResolveManifest = (inputs: ManifestInputs): ArbiterRunManifest => {
  const now = inputs.now ?? new Date();
  const timestamp = now.toISOString();
  const hashAlgorithm = inputs.hashAlgorithm ?? "sha256";
  const configSha256 = sha256Hex(canonicalStringify(inputs.resolvedConfig));
  const packageJsonPath = resolve(inputs.packageJsonPath ?? "package.json");
  const arbiterVersion = readPackageVersion(packageJsonPath);

  const stopPolicy = inputs.resolvedConfig.execution.stop_policy ?? DEFAULT_STOP_POLICY;

  return {
    schema_version: "1.0.0",
    arbiter_version: arbiterVersion,
    run_id: inputs.runId,
    started_at: timestamp,
    completed_at: timestamp,
    timestamps: {
      started_at: timestamp,
      completed_at: timestamp
    },
    stop_reason: "completed",
    stopping_mode: "resolve_only",
    incomplete: false,
    k_attempted: 0,
    k_eligible: 0,
    k_min: inputs.resolvedConfig.execution.k_min,
    k_min_count_rule: inputs.resolvedConfig.execution.k_min_count_rule,
    stop_policy: {
      novelty_epsilon: stopPolicy.novelty_epsilon,
      similarity_threshold: stopPolicy.similarity_threshold,
      patience: stopPolicy.patience,
      k_min_eligible: inputs.resolvedConfig.execution.k_min
    },
    hash_algorithm: hashAlgorithm,
    config_sha256: configSha256,
    model_catalog_version: inputs.catalogVersion,
    model_catalog_sha256: inputs.catalogSha256,
    prompt_manifest_sha256: inputs.promptManifestSha256,
    provenance: {
      arbiter_version: arbiterVersion,
      config_sha256: configSha256,
      model_catalog_version: inputs.catalogVersion,
      model_catalog_sha256: inputs.catalogSha256,
      prompt_manifest_sha256: inputs.promptManifestSha256,
      hash_algorithm: hashAlgorithm
    },
    artifacts: {
      entries: [
        { path: "config.resolved.json" },
        { path: "manifest.json" },
        { path: "trials.jsonl", record_count: 0 },
        { path: "parsed.jsonl", record_count: 0 },
        { path: "convergence_trace.jsonl", record_count: 0 },
        { path: "embeddings.provenance.json" },
        { path: "aggregates.json" }
      ]
    }
  };
};
