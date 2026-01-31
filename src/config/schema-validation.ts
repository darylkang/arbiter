import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import type { ErrorObject, ValidateFunction, Options } from "ajv";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { ArbiterResolvedConfig } from "../generated/config.types.js";
import type { ArbiterRunManifest } from "../generated/manifest.types.js";
import type { ArbiterQuestion } from "../generated/question.types.js";
import type { ArbiterTrialRecord } from "../generated/trial.types.js";
import type { ArbiterParsedOutputRecord } from "../generated/parsed-output.types.js";
import type { ArbiterDebugEmbeddingJSONLRecord } from "../generated/embedding.types.js";
import type { ArbiterEmbeddingsProvenance } from "../generated/embeddings-provenance.types.js";
import type { ArbiterConvergenceTraceRecord } from "../generated/convergence-trace.types.js";
import type { ArbiterAggregates } from "../generated/aggregates.types.js";
import type { ArbiterModelCatalog } from "../generated/catalog.types.js";
import type { ArbiterPromptManifest } from "../generated/prompt-manifest.types.js";
import type { ArbiterOnlineClusteringState } from "../generated/cluster-state.types.js";
import type { ArbiterOnlineClusterAssignmentRecord } from "../generated/cluster-assignment.types.js";

const schemaDir = join(dirname(fileURLToPath(import.meta.url)), "../../schemas");

const loadSchema = (fileName: string): unknown => {
  const raw = readFileSync(join(schemaDir, fileName), "utf8");
  return JSON.parse(raw) as unknown;
};

const Ajv2020Ctor = Ajv2020 as unknown as new (opts?: Options) => {
  compile: <T>(schema: unknown) => ValidateFunction<T>;
};

const ajv = new Ajv2020Ctor({
  allErrors: true,
  strict: true,
  validateSchema: true
});

const applyFormats = addFormats as unknown as (instance: unknown) => void;
applyFormats(ajv);

export const validateConfig: ValidateFunction<ArbiterResolvedConfig> = ajv.compile(
  loadSchema("config.schema.json")
);
export const validateManifest: ValidateFunction<ArbiterRunManifest> = ajv.compile(
  loadSchema("manifest.schema.json")
);
export const validateQuestion: ValidateFunction<ArbiterQuestion> = ajv.compile(
  loadSchema("question.schema.json")
);
export const validateTrial: ValidateFunction<ArbiterTrialRecord> = ajv.compile(
  loadSchema("trial.schema.json")
);
export const validateParsedOutput: ValidateFunction<ArbiterParsedOutputRecord> =
  ajv.compile(loadSchema("parsed-output.schema.json"));
export const validateEmbedding: ValidateFunction<ArbiterDebugEmbeddingJSONLRecord> = ajv.compile(
  loadSchema("embedding.schema.json")
);
export const validateEmbeddingsProvenance: ValidateFunction<ArbiterEmbeddingsProvenance> =
  ajv.compile(loadSchema("embeddings-provenance.schema.json"));
export const validateConvergenceTrace: ValidateFunction<ArbiterConvergenceTraceRecord> =
  ajv.compile(loadSchema("convergence-trace.schema.json"));
export const validateAggregates: ValidateFunction<ArbiterAggregates> = ajv.compile(
  loadSchema("aggregates.schema.json")
);
export const validateCatalog: ValidateFunction<ArbiterModelCatalog> = ajv.compile(
  loadSchema("catalog.schema.json")
);
export const validatePromptManifest: ValidateFunction<ArbiterPromptManifest> = ajv.compile(
  loadSchema("prompt-manifest.schema.json")
);
export const validateClusterState: ValidateFunction<ArbiterOnlineClusteringState> = ajv.compile(
  loadSchema("cluster-state.schema.json")
);
export const validateClusterAssignment: ValidateFunction<ArbiterOnlineClusterAssignmentRecord> =
  ajv.compile(loadSchema("cluster-assignment.schema.json"));

export const formatAjvErrors = (
  schemaName: string,
  errors: ErrorObject[] | null | undefined
): string[] => {
  if (!errors || errors.length === 0) {
    return [];
  }

  return errors.map((error) => {
    const path = error.instancePath || "";
    const message = error.message ?? "is invalid";
    return `${schemaName}${path}: ${message}`.trim();
  });
};
