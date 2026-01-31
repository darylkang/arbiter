import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import type { ArbiterResolvedConfig } from "../generated/config.types.js";
import type { ArbiterModelCatalog } from "../generated/catalog.types.js";
import type { ArbiterPromptManifest } from "../generated/prompt-manifest.types.js";
import { canonicalStringify } from "../utils/canonical-json.js";
import { sha256Hex } from "../utils/hash.js";

export interface SnapshotInputs {
  resolvedConfig: ArbiterResolvedConfig;
  catalog: ArbiterModelCatalog;
  promptManifest: ArbiterPromptManifest;
  catalogSha256: string;
  promptManifestSha256: string;
  runsDir?: string;
}

export interface SnapshotResult {
  runDir: string;
  runId: string;
  configHash: string;
  files: {
    configResolved: string;
    catalogSnapshot: string;
    promptManifestSnapshot: string;
  };
}

const asNonEmptyArray = <T>(items: T[], label: string): [T, ...T[]] => {
  if (items.length === 0) {
    throw new Error(`Expected non-empty array for ${label}`);
  }
  return items as [T, ...T[]];
};

const formatTimestampUtc = (date: Date): string => {
  const pad = (value: number): string => value.toString().padStart(2, "0");
  return [
    date.getUTCFullYear(),
    pad(date.getUTCMonth() + 1),
    pad(date.getUTCDate())
  ].join("") +
    "-" +
    [pad(date.getUTCHours()), pad(date.getUTCMinutes()), pad(date.getUTCSeconds())].join("");
};

const writeJson = (path: string, data: unknown): void => {
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
};

export const writeRunSnapshots = (inputs: SnapshotInputs): SnapshotResult => {
  const runsDir = resolve(inputs.runsDir ?? "runs");
  const canonicalConfig = canonicalStringify(inputs.resolvedConfig);
  const configHash = sha256Hex(canonicalConfig);
  const runId = configHash.slice(0, 8);

  const timestamp = formatTimestampUtc(new Date());
  const runDir = resolve(runsDir, `arb-${timestamp}-${runId}`);

  mkdirSync(runDir, { recursive: true });

  const requestedSlugs = inputs.resolvedConfig.sampling.models.map((model) => model.model);
  const catalogModels = inputs.catalog.models.filter((model) =>
    requestedSlugs.includes(model.slug)
  );
  const unknownModelSlugs = requestedSlugs.filter(
    (slug) => !inputs.catalog.models.some((model) => model.slug === slug)
  );

  const syntheticUnknownModels = unknownModelSlugs.map((slug) => ({
    slug,
    display_name: slug,
    provider: "unknown",
    context_window: null,
    is_aliased: null,
    notes: "unknown_to_catalog"
  }));

  const catalogSnapshot: ArbiterModelCatalog = {
    schema_version: inputs.catalog.schema_version,
    catalog_version: inputs.catalog.catalog_version,
    catalog_stage: inputs.catalog.catalog_stage,
    metadata_complete: inputs.catalog.metadata_complete,
    hash_algorithm: "sha256",
    model_catalog_sha256: inputs.catalogSha256,
    unknown_model_slugs: unknownModelSlugs.length > 0 ? unknownModelSlugs : undefined,
    models: asNonEmptyArray(
      [...catalogModels, ...syntheticUnknownModels],
      "catalog snapshot models"
    )
  };

  const promptIds = new Set<string>([
    ...inputs.resolvedConfig.sampling.personas.map((persona) => persona.persona),
    ...inputs.resolvedConfig.sampling.protocols.map((protocol) => protocol.protocol),
    ...(inputs.resolvedConfig.sampling.instruments ?? []).map(
      (instrument) => instrument.instrument
    )
  ]);

  const promptManifestEntries = inputs.promptManifest.entries.filter((entry) =>
    promptIds.has(entry.id)
  );

  const promptManifestSnapshot: ArbiterPromptManifest = {
    schema_version: inputs.promptManifest.schema_version,
    hash_algorithm: inputs.promptManifest.hash_algorithm,
    prompt_bank_stage: inputs.promptManifest.prompt_bank_stage,
    prompt_manifest_sha256: inputs.promptManifestSha256,
    entries: asNonEmptyArray(promptManifestEntries, "prompt manifest entries")
  };

  const configResolvedPath = resolve(runDir, "config.resolved.json");
  const catalogSnapshotPath = resolve(runDir, "catalog_snapshot.json");
  const promptManifestSnapshotPath = resolve(runDir, "prompt_manifest_snapshot.json");

  writeJson(configResolvedPath, inputs.resolvedConfig);
  writeJson(catalogSnapshotPath, catalogSnapshot);
  writeJson(promptManifestSnapshotPath, promptManifestSnapshot);

  return {
    runDir,
    runId,
    configHash,
    files: {
      configResolved: configResolvedPath,
      catalogSnapshot: catalogSnapshotPath,
      promptManifestSnapshot: promptManifestSnapshotPath
    }
  };
};
