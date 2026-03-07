import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import type { ErrorObject, ValidateFunction, Options } from "ajv";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { ArbiterResolvedConfig } from "../generated/config.types.js";
import type { ArbiterRunManifest } from "../generated/manifest.types.js";
import type { ArbiterQuestion } from "../generated/question.types.js";
import type { ArbiterTrialRecord } from "../generated/trial.types.js";
import type { ArbiterTrialPlanRecord } from "../generated/trial-plan.types.js";
import type { ArbiterParsedOutputRecord } from "../generated/parsed-output.types.js";
import type { ArbiterDebugEmbeddingJSONLRecord } from "../generated/embedding.types.js";
import type { ArbiterEmbeddingsProvenance } from "../generated/embeddings-provenance.types.js";
import type { ArbiterInstanceAnalysisRecord } from "../generated/instance-analysis.types.js";
import type { ArbiterLadderComparisonSummary } from "../generated/ladder-comparison.types.js";
import type { ArbiterMonitoringRecord } from "../generated/monitoring.types.js";
import type { ArbiterAggregates } from "../generated/aggregates.types.js";
import type { ArbiterModelCatalog } from "../generated/catalog.types.js";
import type { ArbiterPromptManifest } from "../generated/prompt-manifest.types.js";
import type { ArbiterDecisionContractManifest } from "../generated/contract-manifest.types.js";
import type { ArbiterDecisionContractPreset } from "../generated/decision-contract.types.js";
import type { ArbiterOnlineGroupingState } from "../generated/group-state.types.js";
import type { ArbiterOnlineGroupAssignmentRecord } from "../generated/group-assignment.types.js";
import type { ArbiterProtocolSpec } from "../generated/protocol.types.js";
import type { ArbiterDebateDecisionContract } from "../generated/debate-decision-contract.types.js";
import {
  SCHEMA_DIR,
  SCHEMA_REGISTRY,
  type SchemaValidatorName
} from "./schema-registry.js";

const loadSchema = (fileName: string): unknown => {
  const raw = readFileSync(join(SCHEMA_DIR, fileName), "utf8");
  return JSON.parse(raw) as unknown;
};

const Ajv2020Ctor = Ajv2020 as unknown as new (opts?: Options) => {
  compile: <T>(schema: unknown) => ValidateFunction<T>;
};

const ajv = new Ajv2020Ctor({
  allErrors: true,
  strict: true,
  validateSchema: true,
  $data: true
});

const applyFormats = addFormats as unknown as (instance: unknown) => void;
applyFormats(ajv);

const compiledValidators = Object.fromEntries(
  SCHEMA_REGISTRY.map((entry) => [entry.validatorExport, ajv.compile(loadSchema(entry.schemaFile))])
) as Record<SchemaValidatorName, ValidateFunction<unknown>>;

export const validateConfig =
  compiledValidators.validateConfig as ValidateFunction<ArbiterResolvedConfig>;
export const validateManifest =
  compiledValidators.validateManifest as ValidateFunction<ArbiterRunManifest>;
export const validateQuestion =
  compiledValidators.validateQuestion as ValidateFunction<ArbiterQuestion>;
export const validateTrial =
  compiledValidators.validateTrial as ValidateFunction<ArbiterTrialRecord>;
export const validateTrialPlan =
  compiledValidators.validateTrialPlan as ValidateFunction<ArbiterTrialPlanRecord>;
export const validateParsedOutput =
  compiledValidators.validateParsedOutput as ValidateFunction<ArbiterParsedOutputRecord>;
export const validateEmbedding =
  compiledValidators.validateEmbedding as ValidateFunction<ArbiterDebugEmbeddingJSONLRecord>;
export const validateEmbeddingsProvenance =
  compiledValidators.validateEmbeddingsProvenance as ValidateFunction<ArbiterEmbeddingsProvenance>;
export const validateInstanceAnalysis =
  compiledValidators.validateInstanceAnalysis as ValidateFunction<ArbiterInstanceAnalysisRecord>;
export const validateLadderComparison =
  compiledValidators.validateLadderComparison as ValidateFunction<ArbiterLadderComparisonSummary>;
export const validateMonitoring =
  compiledValidators.validateMonitoring as ValidateFunction<ArbiterMonitoringRecord>;
export const validateAggregates =
  compiledValidators.validateAggregates as ValidateFunction<ArbiterAggregates>;
export const validateCatalog =
  compiledValidators.validateCatalog as ValidateFunction<ArbiterModelCatalog>;
export const validatePromptManifest =
  compiledValidators.validatePromptManifest as ValidateFunction<ArbiterPromptManifest>;
export const validateContractManifest =
  compiledValidators.validateContractManifest as ValidateFunction<ArbiterDecisionContractManifest>;
export const validateDecisionContract =
  compiledValidators.validateDecisionContract as ValidateFunction<ArbiterDecisionContractPreset>;
export const validateGroupState =
  compiledValidators.validateGroupState as ValidateFunction<ArbiterOnlineGroupingState>;
export const validateGroupAssignment =
  compiledValidators.validateGroupAssignment as ValidateFunction<ArbiterOnlineGroupAssignmentRecord>;
export const validateProtocolSpec =
  compiledValidators.validateProtocolSpec as ValidateFunction<ArbiterProtocolSpec>;
export const validateDebateDecisionContract =
  compiledValidators.validateDebateDecisionContract as ValidateFunction<ArbiterDebateDecisionContract>;

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
