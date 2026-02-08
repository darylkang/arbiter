import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type {
  AdvancedPresetId,
  DecodePresetId,
  GuidedSetupState,
  ProtocolChoice,
  RunModeSelection
} from "./state.js";

type PromptManifestEntry = {
  id: string;
  type: string;
  description?: string;
};

type PromptManifestFile = {
  entries?: PromptManifestEntry[];
};

type CatalogModel = {
  slug: string;
  display_name?: string;
  notes?: string;
  tier?: string;
};

type CatalogFile = {
  models?: CatalogModel[];
};

export type PersonaOption = {
  id: string;
  label: string;
  description: string;
};

export type ModelOption = {
  slug: string;
  label: string;
  description: string;
};

export type DecodePreset = {
  id: DecodePresetId;
  label: string;
  description: string;
  temperature: number;
  topP: number;
  maxTokens: number;
  seed: number;
};

export type AdvancedPreset = {
  id: AdvancedPresetId;
  label: string;
  description: string;
  kMax: number;
  workers: number;
  batchSize: number;
};

export type ProtocolOption = {
  id: ProtocolChoice;
  label: string;
  description: string;
};

export type WizardOptions = {
  personas: PersonaOption[];
  models: ModelOption[];
  decodePresets: DecodePreset[];
  advancedPresets: AdvancedPreset[];
  protocols: ProtocolOption[];
};

const FALLBACK_PERSONAS: PersonaOption[] = [
  {
    id: "persona_neutral",
    label: "Neutral",
    description: "Balanced baseline with no additional framing"
  },
  {
    id: "persona_skeptical",
    label: "Skeptical",
    description: "Emphasizes critique and counterarguments"
  },
  {
    id: "persona_precise",
    label: "Precise",
    description: "Prioritizes definitions and clear assumptions"
  }
];

const FALLBACK_MODELS: ModelOption[] = [
  {
    slug: "openai/gpt-4o-mini-2024-07-18",
    label: "GPT-4o Mini (2024-07-18)",
    description: "Pinned baseline model"
  },
  {
    slug: "anthropic/claude-sonnet-4",
    label: "Claude Sonnet 4",
    description: "High-quality reasoning model"
  },
  {
    slug: "google/gemini-2.0-flash-001",
    label: "Gemini 2.0 Flash 001",
    description: "Pinned fast-response model"
  }
];

const DECODE_PRESETS: DecodePreset[] = [
  {
    id: "balanced",
    label: "Balanced",
    description: "General-purpose decoding for baseline studies",
    temperature: 0.7,
    topP: 0.95,
    maxTokens: 512,
    seed: 424242
  },
  {
    id: "focused",
    label: "Focused",
    description: "Lower variance for tighter answer distributions",
    temperature: 0.3,
    topP: 0.9,
    maxTokens: 512,
    seed: 424242
  },
  {
    id: "exploratory",
    label: "Exploratory",
    description: "Higher variance for broader response diversity",
    temperature: 0.9,
    topP: 0.98,
    maxTokens: 768,
    seed: 424242
  }
];

const ADVANCED_PRESETS: AdvancedPreset[] = [
  {
    id: "quick",
    label: "Quick",
    description: "Fast sanity-check run",
    kMax: 20,
    workers: 4,
    batchSize: 2
  },
  {
    id: "standard",
    label: "Standard",
    description: "Balanced depth and runtime",
    kMax: 50,
    workers: 8,
    batchSize: 4
  },
  {
    id: "thorough",
    label: "Thorough",
    description: "Larger run budget for stronger coverage",
    kMax: 100,
    workers: 16,
    batchSize: 8
  }
];

const PROTOCOL_OPTIONS: ProtocolOption[] = [
  {
    id: "independent",
    label: "Independent",
    description: "Single-pass responses without adversarial critique"
  },
  {
    id: "debate_v1",
    label: "Debate",
    description: "Proposer-critic protocol with revision"
  }
];

export const DEFAULT_WIZARD_OPTIONS: WizardOptions = {
  personas: FALLBACK_PERSONAS,
  models: FALLBACK_MODELS,
  decodePresets: DECODE_PRESETS,
  advancedPresets: ADVANCED_PRESETS,
  protocols: PROTOCOL_OPTIONS
};

const readJson = <T>(path: string): T | null => {
  try {
    const raw = readFileSync(path, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

const titleCase = (value: string): string => {
  return value
    .split(/[_\-\s]+/)
    .filter((token) => token.length > 0)
    .map((token) => token.slice(0, 1).toUpperCase() + token.slice(1))
    .join(" ");
};

const buildPersonaOptions = (manifest: PromptManifestFile | null): PersonaOption[] => {
  const entries = manifest?.entries?.filter((entry) => entry.type === "participant_persona") ?? [];
  if (entries.length === 0) {
    return FALLBACK_PERSONAS;
  }
  return entries.map((entry) => ({
    id: entry.id,
    label: titleCase(entry.id.replace(/^persona_/, "")),
    description: entry.description?.trim() || "Persona prompt"
  }));
};

const buildModelOptions = (catalog: CatalogFile | null): ModelOption[] => {
  const models = catalog?.models ?? [];
  if (models.length === 0) {
    return FALLBACK_MODELS;
  }

  return models
    .filter((model) => typeof model.slug === "string" && model.slug.trim().length > 0)
    .map((model) => {
      const tier = model.tier ? ` • ${model.tier}` : "";
      return {
        slug: model.slug,
        label: model.display_name?.trim() || model.slug,
        description: `${model.slug}${tier}${model.notes ? ` • ${model.notes}` : ""}`
      };
    });
};

export const loadWizardOptions = (assetRoot: string): WizardOptions => {
  const manifestPath = resolve(assetRoot, "resources/prompts/manifest.json");
  const catalogPath = resolve(assetRoot, "resources/catalog/models.json");

  const manifest = readJson<PromptManifestFile>(manifestPath);
  const catalog = readJson<CatalogFile>(catalogPath);

  return {
    personas: buildPersonaOptions(manifest),
    models: buildModelOptions(catalog),
    decodePresets: DECODE_PRESETS,
    advancedPresets: ADVANCED_PRESETS,
    protocols: PROTOCOL_OPTIONS
  };
};

const resolveDecodePreset = (presetId: DecodePresetId): DecodePreset => {
  return DECODE_PRESETS.find((preset) => preset.id === presetId) ?? DECODE_PRESETS[0];
};

const resolveAdvancedPreset = (presetId: AdvancedPresetId): AdvancedPreset => {
  return ADVANCED_PRESETS.find((preset) => preset.id === presetId) ?? ADVANCED_PRESETS[1];
};

export const createDefaultGuidedSetup = (
  options: WizardOptions,
  runMode: RunModeSelection = "mock"
): GuidedSetupState => {
  const decode = resolveDecodePreset("balanced");
  const advanced = resolveAdvancedPreset("standard");

  const defaultPersona =
    options.personas.find((persona) => persona.id === "persona_neutral")?.id ??
    options.personas[0]?.id ??
    FALLBACK_PERSONAS[0].id;
  const defaultModel =
    options.models[0]?.slug ?? FALLBACK_MODELS[0].slug;

  return {
    stage: "question",
    question: "",
    decodePreset: decode.id,
    temperature: decode.temperature,
    topP: decode.topP,
    maxTokens: decode.maxTokens,
    seed: decode.seed,
    personaIds: [defaultPersona],
    modelSlugs: [defaultModel],
    protocol: "independent",
    debateVariant: "standard",
    advancedPreset: advanced.id,
    kMax: advanced.kMax,
    workers: advanced.workers,
    batchSize: advanced.batchSize,
    runMode
  };
};

export const getDecodePreset = (presetId: DecodePresetId): DecodePreset => {
  return resolveDecodePreset(presetId);
};

export const getAdvancedPreset = (presetId: AdvancedPresetId): AdvancedPreset => {
  return resolveAdvancedPreset(presetId);
};
