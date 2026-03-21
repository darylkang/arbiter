import type { ArbiterResolvedConfig } from "../../generated/config.types.js";
import { UI_COPY } from "../copy.js";
import { createStdoutFormatter } from "../fmt.js";
import { toRunModeLabel, type UiRunMode } from "../copy.js";
import {
  renderBrandBlock,
  renderRailStep,
  renderSeparator,
  renderStageHeader,
  truncate,
  type RailStep
} from "../wizard-theme.js";
import { RAIL_ITEMS, type EntryPath, type RunMode, type WizardDraft } from "./types.js";

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const asNonEmptyArray = <T>(items: T[], label: string): [T, ...T[]] => {
  if (items.length === 0) {
    throw new Error(`${label} must contain at least one item`);
  }
  return items as [T, ...T[]];
};

export const formatProtocol = (draft: WizardDraft): string =>
  draft.protocolType === "debate_v1"
    ? `Debate (${draft.participants} participants, ${draft.rounds} rounds)`
    : "Independent";

export const toDecodeSummary = (draft: WizardDraft): string => {
  const tempSummary =
    draft.temperatureMode === "single"
      ? `${draft.temperatureSingle}`
      : `${draft.temperatureMin}-${draft.temperatureMax} (uniform)`;
  const seedSummary = draft.seedMode === "fixed" ? String(draft.fixedSeed) : "random";
  return `temp ${tempSummary}, seed ${seedSummary}`;
};

export const summarizeSelection = (values: string[]): string => {
  if (values.length === 0) {
    return "none";
  }
  const visible = values.slice(0, 2);
  const hidden = values.length - visible.length;
  if (hidden <= 0) {
    return visible.join(", ");
  }
  return `${visible.join(", ")} +${hidden} more`;
};

const summarizeDisplaySelection = (
  values: string[],
  labels?: Map<string, string>
): string =>
  summarizeSelection(values.map((value) => labels?.get(value) ?? value));

const formatReviewRow = (key: string, value: string): string => `${key.padEnd(18)}${value}`;

export const toRailSummaries = (input: {
  draft: WizardDraft;
  currentStep: number;
  entryPath: EntryPath | null;
  selectedConfigPath: string | null;
  runMode: RunMode | null;
  modelLabels?: Map<string, string>;
  personaLabels?: Map<string, string>;
}): Partial<Record<number, string>> => {
  const summaries: Partial<Record<number, string>> = {};
  const { draft } = input;

  if (input.entryPath) {
    if (input.entryPath === "existing") {
      const filename = input.selectedConfigPath
        ? input.selectedConfigPath.split("/").at(-1) ?? "config"
        : "config";
      summaries[0] = `Run existing config (${filename})`;
    } else {
      summaries[0] = "Create new study";
    }
  }
  if (input.runMode) {
    summaries[1] = toRunModeLabel(input.runMode);
  }
  if (input.currentStep >= 1) {
    const trimmed = draft.question.trim();
    if (trimmed.length > 0) {
      summaries[2] = `"${truncate(trimmed, 42)}" (${trimmed.length} chars)`;
    }
  }
  if (input.currentStep >= 2) {
    summaries[3] =
      draft.protocolType === "debate_v1"
        ? `Debate (${draft.participants}P, ${draft.rounds}R)`
        : "Independent";
  }
  if (input.currentStep >= 3 && draft.modelSlugs.length > 0) {
    summaries[4] = `${summarizeDisplaySelection(draft.modelSlugs, input.modelLabels)} (${draft.modelSlugs.length} selected)`;
  }
  if (input.currentStep >= 4 && draft.personaIds.length > 0) {
    summaries[5] = `${summarizeDisplaySelection(draft.personaIds, input.personaLabels)} (${draft.personaIds.length} selected)`;
  }
  if (input.currentStep >= 5) {
    summaries[6] = toDecodeSummary(draft);
  }
  if (input.currentStep >= 6) {
    summaries[7] = draft.useAdvancedDefaults
      ? "defaults"
      : `workers ${draft.workers}, K_max ${draft.kMax}, batch ${draft.batchSize}`;
  }
  return summaries;
};

export const buildFrozenRailSummary = (input: {
  draft: WizardDraft;
  selectedConfigPath: string | null;
  entryPath: EntryPath;
  runMode: RunMode;
  modelLabels?: Map<string, string>;
  personaLabels?: Map<string, string>;
}): string => {
  const fmt = createStdoutFormatter();
  const summaries = toRailSummaries({
    draft: input.draft,
    currentStep: 7,
    entryPath: input.entryPath,
    selectedConfigPath: input.selectedConfigPath,
    runMode: input.runMode,
    modelLabels: input.modelLabels,
    personaLabels: input.personaLabels
  });
  const lines: string[] = [];
  const frozenSteps: RailStep[] = RAIL_ITEMS.filter((item) => item.railIndex <= 7).map((item) => ({
    label: item.label,
    state: "completed",
    summary: summaries[item.railIndex]
  }));
  for (const step of frozenSteps) {
    lines.push(renderRailStep(step, fmt, true));
  }
  return lines.join("\n");
};

export const buildFrozenTranscriptPrefix = (input: {
  version: string;
  apiKeyPresent: boolean;
  configCount: number;
  contextLabel: string;
  draft: WizardDraft;
  selectedConfigPath: string | null;
  entryPath: EntryPath;
  runMode: RunMode;
  modelLabels?: Map<string, string>;
  personaLabels?: Map<string, string>;
}): string => {
  const fmt = createStdoutFormatter();
  const width = fmt.termWidth();

  return [
    renderBrandBlock(
      input.version,
      input.apiKeyPresent,
      input.runMode,
      input.configCount,
      width,
      fmt,
      "expanded"
    ),
    "",
    renderStageHeader(UI_COPY.setupHeader, 0, width, fmt),
    "",
    buildFrozenRailSummary({
      draft: input.draft,
      selectedConfigPath: input.selectedConfigPath,
      entryPath: input.entryPath,
      runMode: input.runMode,
      modelLabels: input.modelLabels,
      personaLabels: input.personaLabels
    }),
    "",
    fmt.muted(UI_COPY.startingRun)
  ].join("\n");
};

export const buildDraftFromConfig = (
  config: ArbiterResolvedConfig,
  fallbacks: {
    modelSlugs: string[];
    personaIds: string[];
  }
): WizardDraft => {
  const temp = config.sampling.decode?.temperature;
  const seed = config.run.seed;
  const resolvedModelSlugs = config.sampling.models
    .map((model) => model.model)
    .filter((value) => value.length > 0);
  const resolvedPersonaIds = config.sampling.personas
    .map((persona) => persona.persona)
    .filter((value) => value.length > 0);

  return {
    question: config.question.text,
    protocolType: config.protocol.type,
    participants: config.protocol.participants ?? 2,
    rounds: config.protocol.rounds ?? 1,
    modelSlugs: resolvedModelSlugs.length > 0 ? resolvedModelSlugs : fallbacks.modelSlugs,
    personaIds: resolvedPersonaIds.length > 0 ? resolvedPersonaIds : fallbacks.personaIds,
    temperatureMode:
      typeof temp === "number" || temp === undefined
        ? "single"
        : "range",
    temperatureSingle: typeof temp === "number" ? temp : 0.7,
    temperatureMin: typeof temp === "object" && temp !== null ? temp.min : 0.3,
    temperatureMax: typeof temp === "object" && temp !== null ? temp.max : 1.0,
    seedMode: typeof seed === "number" ? "fixed" : "random",
    fixedSeed: typeof seed === "number" ? seed : 42,
    useAdvancedDefaults: false,
    workers: config.execution.workers,
    batchSize: config.execution.batch_size,
    kMax: config.execution.k_max,
    maxTokens: typeof config.sampling.decode?.max_tokens === "number" ? config.sampling.decode.max_tokens : 2048,
    noveltyThreshold: config.execution.stop_policy?.novelty_epsilon ?? 0.1,
    noveltyPatience: config.execution.stop_policy?.patience ?? 2,
    kMin: config.execution.k_min,
    similarityAdvisoryThreshold: config.execution.stop_policy?.similarity_threshold ?? 0.85,
    outputDir: config.output.runs_dir
  };
};

export const buildConfigFromDraft = (input: {
  baseConfig: ArbiterResolvedConfig;
  draft: WizardDraft;
}): ArbiterResolvedConfig => {
  const config = clone(input.baseConfig);
  const { draft } = input;

  config.question.text = draft.question;
  config.sampling.models = asNonEmptyArray(
    draft.modelSlugs.map((slug) => ({ model: slug, weight: 1 })),
    "sampling.models"
  );
  config.sampling.personas = asNonEmptyArray(
    draft.personaIds.map((personaId) => ({ persona: personaId, weight: 1 })),
    "sampling.personas"
  );
  config.sampling.protocols = [
    {
      protocol: "protocol_independent_v1_system",
      weight: 1
    }
  ];
  config.protocol.type = draft.protocolType;
  config.protocol.participants = draft.protocolType === "debate_v1" ? draft.participants : undefined;
  config.protocol.rounds = draft.protocolType === "debate_v1" ? draft.rounds : undefined;

  config.sampling.decode = {
    ...(config.sampling.decode ?? {}),
    temperature:
      draft.temperatureMode === "single"
        ? draft.temperatureSingle
        : { min: draft.temperatureMin, max: draft.temperatureMax },
    max_tokens: draft.maxTokens
  };

  config.run.seed = draft.seedMode === "fixed" ? draft.fixedSeed : `random-${Date.now()}`;

  config.execution.workers = draft.workers;
  config.execution.batch_size = draft.batchSize;
  config.execution.k_max = draft.kMax;
  config.execution.k_min = draft.kMin;
  config.execution.stop_policy = {
    novelty_epsilon: draft.noveltyThreshold,
    similarity_threshold: draft.similarityAdvisoryThreshold,
    patience: draft.noveltyPatience
  };

  config.output.runs_dir = draft.outputDir;
  return config;
};

export const buildReviewLines = (input: {
  draft: WizardDraft;
  runMode: RunMode;
  selectedConfigPath: string | null;
  isExistingPath: boolean;
  modelLabels?: Map<string, string>;
  personaLabels?: Map<string, string>;
}): string[] => {
  const { draft, runMode, selectedConfigPath, isExistingPath, modelLabels, personaLabels } = input;
  const lines = [
    "Review settings, run checks, and choose how to proceed.",
    "",
    "Preflight",
    "✓ Schema validation",
    "✓ Output path writable",
    runMode === "mock"
      ? "⚠ Live connectivity check (skipped in Mock mode)"
      : "⚠ Live connectivity check occurs at run start",
    "",
    "Config Summary",
    formatReviewRow("Question", `"${truncate(draft.question.trim(), 72)}"`),
    formatReviewRow("Protocol", formatProtocol(draft)),
    formatReviewRow(
      "Models",
      `${summarizeDisplaySelection(draft.modelSlugs, modelLabels)} (${draft.modelSlugs.length} selected)`
    ),
    formatReviewRow(
      "Personas",
      `${summarizeDisplaySelection(draft.personaIds, personaLabels)} (${draft.personaIds.length} selected)`
    ),
    formatReviewRow("Decode Params", toDecodeSummary(draft)),
    formatReviewRow("Run mode", toRunModeLabel(runMode as UiRunMode)),
    formatReviewRow("Output dir", draft.outputDir)
  ];
  if (isExistingPath && selectedConfigPath) {
    lines.push(formatReviewRow("Source config", selectedConfigPath));
  }
  return lines;
};
