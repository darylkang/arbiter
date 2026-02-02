import { resolve } from "node:path";

import type { ArbiterResolvedConfig } from "../generated/config.types.js";
import type { ArbiterRunManifest } from "../generated/manifest.types.js";
import type { ArbiterAggregates } from "../generated/aggregates.types.js";
import type { ArbiterModelCatalog } from "../generated/catalog.types.js";
import type { ArbiterPromptManifest } from "../generated/prompt-manifest.types.js";
import { writeJsonAtomic, touchFile } from "./io.js";
import { buildResolveOnlyProvenance } from "./embeddings-provenance.js";

export interface ResolveArtifactsOptions {
  runDir: string;
  resolvedConfig: ArbiterResolvedConfig;
  manifest: ArbiterRunManifest;
  catalog?: ArbiterModelCatalog;
  promptManifest?: ArbiterPromptManifest;
  catalogSha256?: string;
  promptManifestSha256?: string;
  debug?: boolean;
}

export interface ResolveArtifactsResult {
  configResolvedPath: string;
  manifestPath: string;
  embeddingsProvenancePath: string;
  aggregatesPath: string;
  jsonlPaths: {
    trials: string;
    parsed: string;
    convergenceTrace: string;
  };
  embeddingsArrowPath: string;
  debugPaths?: {
    embeddingsJsonl: string;
    catalogSnapshot?: string;
    promptManifestSnapshot?: string;
  };
}

export const writeResolveArtifacts = (
  options: ResolveArtifactsOptions
): ResolveArtifactsResult => {
  const configResolvedPath = resolve(options.runDir, "config.resolved.json");
  const manifestPath = resolve(options.runDir, "manifest.json");
  const trialsPath = resolve(options.runDir, "trials.jsonl");
  const parsedPath = resolve(options.runDir, "parsed.jsonl");
  const convergencePath = resolve(options.runDir, "convergence_trace.jsonl");
  const embeddingsArrowPath = resolve(options.runDir, "embeddings.arrow");
  const embeddingsProvenancePath = resolve(options.runDir, "embeddings.provenance.json");
  const aggregatesPath = resolve(options.runDir, "aggregates.json");

  writeJsonAtomic(configResolvedPath, options.resolvedConfig);
  writeJsonAtomic(manifestPath, options.manifest);

  touchFile(trialsPath);
  touchFile(parsedPath);
  touchFile(convergencePath);

  const aggregates: ArbiterAggregates = {
    schema_version: "1.0.0",
    k_attempted: 0,
    k_eligible: 0,
    novelty_rate: null,
    mean_max_sim_to_prior: null,
    cluster_count: null,
    entropy: null
  };

  writeJsonAtomic(aggregatesPath, aggregates);

  const embeddingsProvenance = buildResolveOnlyProvenance(undefined, {
    requestedEmbeddingModel: options.resolvedConfig.measurement.embedding_model,
    embedTextStrategy: options.resolvedConfig.measurement.embed_text_strategy,
    normalization: "newline_to_lf+trim_trailing"
  });
  writeJsonAtomic(embeddingsProvenancePath, embeddingsProvenance);

  const result: ResolveArtifactsResult = {
    configResolvedPath,
    manifestPath,
    embeddingsProvenancePath,
    aggregatesPath,
    jsonlPaths: {
      trials: trialsPath,
      parsed: parsedPath,
      convergenceTrace: convergencePath
    },
    embeddingsArrowPath
  };

  if (options.debug) {
    const debugDir = resolve(options.runDir, "debug");
    const embeddingsJsonl = resolve(debugDir, "embeddings.jsonl");
    touchFile(embeddingsJsonl);
    result.debugPaths = { embeddingsJsonl };

    if (options.catalog && options.promptManifest) {
      const catalogSnapshotPath = resolve(debugDir, "catalog_snapshot.json");
      const promptSnapshotPath = resolve(debugDir, "prompt_manifest_snapshot.json");
      const catalogSnapshot: ArbiterModelCatalog = {
        ...options.catalog,
        hash_algorithm: "sha256",
        model_catalog_sha256: options.catalogSha256
      };
      const promptSnapshot: ArbiterPromptManifest = {
        ...options.promptManifest,
        prompt_manifest_sha256: options.promptManifestSha256
      };

      writeJsonAtomic(catalogSnapshotPath, catalogSnapshot);
      writeJsonAtomic(promptSnapshotPath, promptSnapshot);

      result.debugPaths.catalogSnapshot = catalogSnapshotPath;
      result.debugPaths.promptManifestSnapshot = promptSnapshotPath;
    }
  }

  return result;
};
