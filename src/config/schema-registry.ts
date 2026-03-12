import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

export const SCHEMA_DIR = resolve(PROJECT_ROOT, "schemas");
export const GENERATED_DIR = resolve(PROJECT_ROOT, "src/generated");
export const GENERATED_BANNER = "/* This file is generated. Do not edit. */";

export const SCHEMA_REGISTRY = [
  {
    schemaFile: "common.schema.json",
    generatedTypeFile: "common.types.ts",
    validatorExport: "validateCommonSchema",
    family: "shared"
  },
  {
    schemaFile: "config.schema.json",
    generatedTypeFile: "config.types.ts",
    validatorExport: "validateConfig",
    family: "config"
  },
  {
    schemaFile: "manifest.schema.json",
    generatedTypeFile: "manifest.types.ts",
    validatorExport: "validateManifest",
    family: "artifacts"
  },
  {
    schemaFile: "question.schema.json",
    generatedTypeFile: "question.types.ts",
    validatorExport: "validateQuestion",
    family: "config"
  },
  {
    schemaFile: "trial.schema.json",
    generatedTypeFile: "trial.types.ts",
    validatorExport: "validateTrial",
    family: "artifacts"
  },
  {
    schemaFile: "trial-plan.schema.json",
    generatedTypeFile: "trial-plan.types.ts",
    validatorExport: "validateTrialPlan",
    family: "artifacts"
  },
  {
    schemaFile: "parsed-output.schema.json",
    generatedTypeFile: "parsed-output.types.ts",
    validatorExport: "validateParsedOutput",
    family: "artifacts"
  },
  {
    schemaFile: "embedding.schema.json",
    generatedTypeFile: "embedding.types.ts",
    validatorExport: "validateEmbedding",
    family: "artifacts"
  },
  {
    schemaFile: "embeddings-provenance.schema.json",
    generatedTypeFile: "embeddings-provenance.types.ts",
    validatorExport: "validateEmbeddingsProvenance",
    family: "artifacts"
  },
  {
    schemaFile: "instance-analysis.schema.json",
    generatedTypeFile: "instance-analysis.types.ts",
    validatorExport: "validateInstanceAnalysis",
    family: "analysis"
  },
  {
    schemaFile: "ladder-comparison.schema.json",
    generatedTypeFile: "ladder-comparison.types.ts",
    validatorExport: "validateLadderComparison",
    family: "analysis"
  },
  {
    schemaFile: "monitoring.schema.json",
    generatedTypeFile: "monitoring.types.ts",
    validatorExport: "validateMonitoring",
    family: "monitoring"
  },
  {
    schemaFile: "aggregates.schema.json",
    generatedTypeFile: "aggregates.types.ts",
    validatorExport: "validateAggregates",
    family: "monitoring"
  },
  {
    schemaFile: "group-state.schema.json",
    generatedTypeFile: "group-state.types.ts",
    validatorExport: "validateGroupState",
    family: "monitoring"
  },
  {
    schemaFile: "group-assignment.schema.json",
    generatedTypeFile: "group-assignment.types.ts",
    validatorExport: "validateGroupAssignment",
    family: "monitoring"
  },
  {
    schemaFile: "catalog.schema.json",
    generatedTypeFile: "catalog.types.ts",
    validatorExport: "validateCatalog",
    family: "resources"
  },
  {
    schemaFile: "persona-catalog.schema.json",
    generatedTypeFile: "persona-catalog.types.ts",
    validatorExport: "validatePersonaCatalog",
    family: "resources"
  },
  {
    schemaFile: "prompt-manifest.schema.json",
    generatedTypeFile: "prompt-manifest.types.ts",
    validatorExport: "validatePromptManifest",
    family: "resources"
  },
  {
    schemaFile: "template-manifest.schema.json",
    generatedTypeFile: "template-manifest.types.ts",
    validatorExport: "validateTemplateManifest",
    family: "resources"
  },
  {
    schemaFile: "contract-manifest.schema.json",
    generatedTypeFile: "contract-manifest.types.ts",
    validatorExport: "validateContractManifest",
    family: "resources"
  },
  {
    schemaFile: "decision-contract.schema.json",
    generatedTypeFile: "decision-contract.types.ts",
    validatorExport: "validateDecisionContract",
    family: "resources"
  },
  {
    schemaFile: "protocol.schema.json",
    generatedTypeFile: "protocol.types.ts",
    validatorExport: "validateProtocolSpec",
    family: "config"
  },
  {
    schemaFile: "debate-decision-contract.schema.json",
    generatedTypeFile: "debate-decision-contract.types.ts",
    validatorExport: "validateDebateDecisionContract",
    family: "resources"
  }
] as const;

export type SchemaRegistryEntry = (typeof SCHEMA_REGISTRY)[number];
export type SchemaValidatorName = SchemaRegistryEntry["validatorExport"];

export const SCHEMA_FILE_NAMES: Set<string> = new Set(
  SCHEMA_REGISTRY.map((entry) => entry.schemaFile)
);
export const GENERATED_TYPE_FILE_NAMES: Set<string> = new Set(
  SCHEMA_REGISTRY.map((entry) => entry.generatedTypeFile)
);
