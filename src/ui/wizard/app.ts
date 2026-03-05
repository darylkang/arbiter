import { accessSync, constants, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { emitKeypressEvents } from "node:readline";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import type { ArbiterModelCatalog } from "../../generated/catalog.types.js";
import type { ArbiterPromptManifest } from "../../generated/prompt-manifest.types.js";
import type { ArbiterResolvedConfig } from "../../generated/config.types.js";
import { resolveConfig } from "../../config/resolve-config.js";
import { runLiveService, runMockService } from "../../run/run-service.js";
import { listModels } from "../../openrouter/client.js";
import { createConsoleWarningSink } from "../../utils/warnings.js";
import { createUiRunLifecycleHooks } from "../run-lifecycle-hooks.js";
import { UI_COPY, toRunModeLabel, type UiRunMode } from "../copy.js";
import { createStdoutFormatter } from "../fmt.js";
import {
  renderBrandBlock,
  renderRailContent,
  renderRailStep,
  renderSeparator,
  renderStatusStrip,
  truncate,
  type RailStep
} from "../wizard-theme.js";
import {
  listConfigFiles,
  nextCollisionSafeConfigPath,
  loadTemplateConfig,
  readJsonFile,
  writeJsonFile
} from "../../cli/commands.js";

type EntryPath = "existing" | "new";
type RunMode = "live" | "mock";
type ProtocolType = "independent" | "debate_v1";
type TemperatureMode = "single" | "range";
type SeedMode = "random" | "fixed";

type WizardDraft = {
  question: string;
  protocolType: ProtocolType;
  participants: number;
  rounds: number;
  modelSlugs: string[];
  personaIds: string[];
  temperatureMode: TemperatureMode;
  temperatureSingle: number;
  temperatureMin: number;
  temperatureMax: number;
  seedMode: SeedMode;
  fixedSeed: number;
  useAdvancedDefaults: boolean;
  workers: number;
  batchSize: number;
  kMax: number;
  maxTokens: number;
  noveltyThreshold: number;
  noveltyPatience: number;
  kMin: number;
  similarityAdvisoryThreshold: number;
  outputDir: string;
};

type Choice = {
  id: string;
  label: string;
  disabled?: boolean;
  disabledReason?: string;
};

type ReviewAction = "run" | "save" | "revise" | "quit";

type CatalogModel = {
  slug: string;
  display: string;
  provider: string;
  tier: string;
  isAliased: boolean;
};

type PersonaOption = {
  id: string;
  description: string;
};

const SELECT_BACK = "__BACK__";
const SELECT_EXIT = "__EXIT__";

type NavigationSignal = typeof SELECT_BACK | typeof SELECT_EXIT;
type SelectOneResult = string | NavigationSignal;
type SelectManyResult = string[] | NavigationSignal;

type RawKey = {
  name?: string;
  ctrl?: boolean;
  sequence?: string;
};

type StepIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

type StepFrame = {
  version: string;
  currentRailIndex: number;
  completedUntilRailIndex: number;
  runMode: RunMode | null;
  apiKeyPresent: boolean;
  configCount: number;
  contextLabel: string;
  showRunMode: boolean;
  showBrandBlock: boolean;
  activeLabel: string;
  activeLines: string[];
  footerText: string;
  stepSummaries: Partial<Record<number, string>>;
  dimmedRail?: boolean;
};

const RAIL_ITEMS = [
  { label: "Entry Path", railIndex: 0 },
  { label: "Run Mode", railIndex: 1 },
  { label: "Research Question", railIndex: 2 },
  { label: "Protocol", railIndex: 3 },
  { label: "Models", railIndex: 4 },
  { label: "Personas", railIndex: 5 },
  { label: "Decode Params", railIndex: 6 },
  { label: "Advanced Settings", railIndex: 7 },
  { label: "Review and Confirm", railIndex: 8 }
];

const ALT_SCREEN_ENABLE = "\x1b[?1049h";
const ALT_SCREEN_DISABLE = "\x1b[?1049l";

const clearScreen = (): void => {
  output.write("\x1b[2J\x1b[H");
};

const splitLines = (value: string): string[] => value.split("\n").filter((line) => line.length > 0);

const toRailSteps = (input: {
  currentRailIndex: number;
  completedUntilRailIndex: number;
  showRunMode: boolean;
  stepSummaries: Partial<Record<number, string>>;
}): RailStep[] =>
  RAIL_ITEMS.filter((item) => input.showRunMode || item.railIndex !== 1).map((item) => ({
    label: item.label,
    state:
      item.railIndex === input.currentRailIndex
        ? "active"
        : item.railIndex <= input.completedUntilRailIndex
          ? "completed"
          : "pending",
    summary: input.stepSummaries[item.railIndex]
  }));

const renderStepFrame = (input: StepFrame): void => {
  const fmt = createStdoutFormatter();
  const width = fmt.termWidth();
  const parts: string[] = [];
  const railSteps = toRailSteps({
    currentRailIndex: input.currentRailIndex,
    completedUntilRailIndex: input.completedUntilRailIndex,
    showRunMode: input.showRunMode,
    stepSummaries: input.stepSummaries
  });

  clearScreen();

  parts.push(renderStatusStrip(input.contextLabel, 0, width, fmt));
  parts.push(renderSeparator(width, fmt));
  parts.push("");
  if (input.showBrandBlock) {
    parts.push(
      renderBrandBlock(
        input.version,
        input.apiKeyPresent,
        input.runMode as UiRunMode,
        input.configCount,
        fmt
      )
    );
    parts.push("");
  }

  for (const step of railSteps) {
    const isActiveStep = step.state === "active";
    parts.push(renderRailStep(step, fmt, input.dimmedRail === true));
    if (isActiveStep) {
      parts.push(renderRailContent([input.activeLabel, "", ...input.activeLines], fmt));
    }
  }

  parts.push("");
  parts.push(renderSeparator(width, fmt));
  parts.push(input.footerText);
  output.write(`${parts.join("\n")}\n`);
};

const firstEnabledIndex = (choices: Choice[], fallbackIndex: number): number => {
  if (choices.length === 0) {
    return 0;
  }
  const clamped = Math.max(0, Math.min(fallbackIndex, choices.length - 1));
  if (!choices[clamped]?.disabled) {
    return clamped;
  }
  const found = choices.findIndex((choice) => !choice.disabled);
  return found >= 0 ? found : 0;
};

const nextSelectableIndex = (choices: Choice[], currentIndex: number, delta: number): number => {
  if (choices.length === 0) {
    return 0;
  }
  for (let hops = 0; hops < choices.length; hops += 1) {
    const next = (currentIndex + delta * (hops + 1) + choices.length) % choices.length;
    if (!choices[next]?.disabled) {
      return next;
    }
  }
  return currentIndex;
};

const withRawKeyCapture = async <T>(inputControl: {
  render: (errorLine?: string) => void;
  onKey: (str: string, key: RawKey) => { done: true; value: T } | { done: false; error?: string };
}): Promise<T> => {
  const stdin = process.stdin;
  if (!stdin.isTTY) {
    throw new Error("Wizard key-driven input requires a TTY.");
  }

  return new Promise<T>((resolvePromise) => {
    emitKeypressEvents(stdin);
    const wasRaw = Boolean(stdin.isRaw);
    stdin.setRawMode(true);
    stdin.resume();

    let currentError = "";

    const render = (): void => {
      inputControl.render(currentError || undefined);
    };

    const cleanup = (): void => {
      stdin.removeListener("keypress", onKeyPress);
      stdin.setRawMode(wasRaw);
    };

    const onKeyPress = (str: string, key: RawKey): void => {
      const result = inputControl.onKey(str, key);
      if (result.done) {
        cleanup();
        resolvePromise(result.value);
        return;
      }
      currentError = result.error ?? "";
      render();
    };

    stdin.on("keypress", onKeyPress);
    render();
  });
};

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const asNonEmptyArray = <T>(items: T[], label: string): [T, ...T[]] => {
  if (items.length === 0) {
    throw new Error(`${label} must contain at least one item`);
  }
  return items as [T, ...T[]];
};

const readCatalogModels = (assetRoot: string): CatalogModel[] => {
  const catalog = readJsonFile<ArbiterModelCatalog>(
    resolve(assetRoot, "resources/catalog/models.json")
  );
  return catalog.models.map((model) => ({
    slug: model.slug,
    display: model.display_name,
    provider: model.provider,
    tier: model.tier,
    isAliased: model.is_aliased === true
  }));
};

const readPersonaOptions = (assetRoot: string): PersonaOption[] => {
  const manifest = readJsonFile<ArbiterPromptManifest>(
    resolve(assetRoot, "resources/prompts/manifest.json")
  );
  return manifest.entries
    .filter((entry) => entry.type === "participant_persona")
    .map((entry) => ({ id: entry.id, description: entry.description ?? "" }));
};

const formatProtocol = (draft: WizardDraft): string =>
  draft.protocolType === "debate_v1"
    ? `Debate (${draft.participants} participants, ${draft.rounds} rounds)`
    : "Independent";

const loadVersion = (assetRoot: string): string => {
  const pkg = readJsonFile<{ version?: string }>(resolve(assetRoot, "package.json"));
  return pkg.version ?? "0.0.0";
};

const toDecodeSummary = (draft: WizardDraft): string => {
  const tempSummary =
    draft.temperatureMode === "single"
      ? `${draft.temperatureSingle}`
      : `${draft.temperatureMin}-${draft.temperatureMax} (uniform)`;
  const seedSummary = draft.seedMode === "fixed" ? String(draft.fixedSeed) : "random";
  return `temp ${tempSummary}, seed ${seedSummary}`;
};

const summarizeSelection = (values: string[]): string => {
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

const toRailSummaries = (input: {
  draft: WizardDraft;
  currentStep: StepIndex | number;
  entryPath: EntryPath | null;
  selectedConfigPath: string | null;
  runMode: RunMode | null;
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
    summaries[4] = `${summarizeSelection(draft.modelSlugs)} (${draft.modelSlugs.length} selected)`;
  }
  if (input.currentStep >= 4 && draft.personaIds.length > 0) {
    summaries[5] = `${summarizeSelection(draft.personaIds)} (${draft.personaIds.length} selected)`;
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

const buildFrozenRailSummary = (input: {
  draft: WizardDraft;
  selectedConfigPath: string | null;
  entryPath: EntryPath;
  runMode: RunMode;
}): string => {
  const fmt = createStdoutFormatter();
  const summaries = toRailSummaries({
    draft: input.draft,
    currentStep: 7,
    entryPath: input.entryPath,
    selectedConfigPath: input.selectedConfigPath,
    runMode: input.runMode
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

const buildDraftFromConfig = (
  config: ArbiterResolvedConfig,
  fallbacks: {
    modelSlugs: string[];
    personaIds: string[];
  }
): WizardDraft => {
  const temp = config.sampling.decode?.temperature;
  const seed = config.run.seed;

  return {
    question: config.question.text,
    protocolType: config.protocol.type,
    participants: config.protocol.participants ?? 2,
    rounds: config.protocol.rounds ?? 1,
    modelSlugs:
      config.sampling.models.map((model) => model.model).filter((value) => value.length > 0) ||
      fallbacks.modelSlugs,
    personaIds:
      config.sampling.personas.map((persona) => persona.persona).filter((value) => value.length > 0) ||
      fallbacks.personaIds,
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

const buildConfigFromDraft = (input: {
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

const askInteger = async (rl: ReturnType<typeof createInterface>, prompt: string, defaultValue: number, min: number): Promise<number> => {
  while (true) {
    const answer = (await rl.question(`${prompt} [${defaultValue}]: `)).trim();
    if (answer.length === 0) {
      return defaultValue;
    }
    const parsed = Number(answer);
    if (Number.isInteger(parsed) && parsed >= min) {
      return parsed;
    }
    output.write(`Fix required: ${prompt} must be an integer greater than or equal to ${min}.\n`);
  }
};

const askFloat = async (
  rl: ReturnType<typeof createInterface>,
  prompt: string,
  defaultValue: number,
  min: number,
  max: number
): Promise<number> => {
  while (true) {
    const answer = (await rl.question(`${prompt} [${defaultValue}]: `)).trim();
    if (answer.length === 0) {
      return defaultValue;
    }
    const parsed = Number(answer);
    if (Number.isFinite(parsed) && parsed >= min && parsed <= max) {
      return parsed;
    }
    output.write(`Fix required: ${prompt} must be within [${min}, ${max}].\n`);
  }
};

const selectOne = async (
  rl: ReturnType<typeof createInterface>,
  prompt: string,
  choices: Choice[],
  defaultIndex = 0,
  frame?: StepFrame
): Promise<SelectOneResult> => {
  rl.pause();
  let selectedIndex = firstEnabledIndex(choices, defaultIndex);
  const selected = await withRawKeyCapture<SelectOneResult>({
    render: (errorLine) => {
      const lines: string[] = [prompt, ""];
      choices.forEach((choice, index) => {
        const marker = index === selectedIndex ? "▸ " : "  ";
        const selectedGlyph = index === selectedIndex ? "●" : "○";
        lines.push(`${marker}${selectedGlyph} ${choice.label}`);
      });
      const disabledReasons = choices
        .filter((choice) => choice.disabled && typeof choice.disabledReason === "string")
        .map((choice) => choice.disabledReason as string);
      if (disabledReasons.length > 0) {
        lines.push("");
        lines.push(...disabledReasons);
      }
      if (errorLine) {
        lines.push("");
        lines.push(errorLine);
      }
      if (frame) {
        renderStepFrame({
          ...frame,
          activeLines: [...frame.activeLines, ...lines],
          footerText: "↑/↓ move · Enter select · Esc back"
        });
      } else {
        clearScreen();
        output.write(`${lines.join("\n")}\n`);
      }
    },
    onKey: (_str, key) => {
      if (key.ctrl && key.name === "c") {
        return { done: true, value: SELECT_EXIT };
      }
      if (key.name === "up") {
        selectedIndex = nextSelectableIndex(choices, selectedIndex, -1);
        return { done: false };
      }
      if (key.name === "down") {
        selectedIndex = nextSelectableIndex(choices, selectedIndex, 1);
        return { done: false };
      }
      if (key.name === "escape") {
        return { done: true, value: SELECT_BACK };
      }
      if (key.name === "return" || key.sequence === "\r") {
        const choice = choices[selectedIndex];
        if (!choice || choice.disabled) {
          return {
            done: false,
            error: choice?.disabledReason ?? UI_COPY.disabledOption
          };
        }
        return { done: true, value: choice.id };
      }
      return { done: false };
    }
  });
  rl.resume();
  return selected;
};

const selectMany = async (
  rl: ReturnType<typeof createInterface>,
  prompt: string,
  choices: Choice[],
  defaults: string[],
  emptySelectionError = "Fix required: select at least one option.",
  frame?: StepFrame
): Promise<SelectManyResult> => {
  rl.pause();
  const selectedIds = new Set(defaults);
  let selectedIndex = firstEnabledIndex(choices, 0);
  const resolved = await withRawKeyCapture<SelectManyResult>({
    render: (errorLine) => {
      const lines: string[] = [prompt, ""];
      choices.forEach((choice, index) => {
        const cursor = index === selectedIndex ? "▸ " : "  ";
        const checked = selectedIds.has(choice.id) ? "■" : "□";
        lines.push(`${cursor}${checked} ${choice.label}`);
      });
      if (errorLine) {
        lines.push("");
        lines.push(errorLine);
      }
      if (frame) {
        renderStepFrame({
          ...frame,
          activeLines: [...frame.activeLines, ...lines],
          footerText: "↑/↓ move · Space toggle · Enter confirm · Esc back"
        });
      } else {
        clearScreen();
        output.write(`${lines.join("\n")}\n`);
      }
    },
    onKey: (_str, key) => {
      if (key.ctrl && key.name === "c") {
        return { done: true, value: SELECT_EXIT };
      }
      if (key.name === "up") {
        selectedIndex = nextSelectableIndex(choices, selectedIndex, -1);
        return { done: false };
      }
      if (key.name === "down") {
        selectedIndex = nextSelectableIndex(choices, selectedIndex, 1);
        return { done: false };
      }
      if (key.name === "escape") {
        return { done: true, value: SELECT_BACK };
      }
      if (key.name === "space") {
        const choice = choices[selectedIndex];
        if (choice && !choice.disabled) {
          if (selectedIds.has(choice.id)) {
            selectedIds.delete(choice.id);
          } else {
            selectedIds.add(choice.id);
          }
        }
        return { done: false };
      }
      if (key.name === "return" || key.sequence === "\r") {
        if (selectedIds.size === 0) {
          return { done: false, error: emptySelectionError };
        }
        return { done: true, value: Array.from(selectedIds) };
      }
      return { done: false };
    }
  });
  rl.resume();
  return resolved;
};

const askMultilineQuestion = async (
  rl: ReturnType<typeof createInterface>,
  initial: string,
  frame: StepFrame
): Promise<string | NavigationSignal> => {
  rl.pause();
  let buffer = initial;
  const resolved = await withRawKeyCapture<string | NavigationSignal>({
    render: (errorLine) => {
      const lines = [
        "Include all relevant context. Arbiter samples responses to characterize distributional behavior.",
        "Question",
        "Type your question and press Enter to continue.",
        "",
        buffer.length === 0 ? "(start typing)" : buffer,
        "",
        `Characters: ${buffer.length}`
      ];
      if (errorLine) {
        lines.push("");
        lines.push(errorLine);
      }
      renderStepFrame({
        ...frame,
        activeLines: [...frame.activeLines, ...lines],
        footerText: "Enter continue · Esc back"
      });
    },
    onKey: (str, key) => {
      if (key.ctrl && key.name === "c") {
        return { done: true, value: SELECT_EXIT };
      }
      if (key.name === "escape") {
        return { done: true, value: SELECT_BACK };
      }

      const submitRequested =
        key.name === "return" ||
        key.sequence === "\r" ||
        key.sequence === "\n";

      if (submitRequested) {
        const question = buffer.trim();
        if (question.length === 0) {
          return { done: false, error: "Fix required: enter a research question to continue." };
        }
        return { done: true, value: question };
      }

      if (key.name === "backspace" || key.sequence === "\x7f") {
        if (buffer.length > 0) {
          buffer = buffer.slice(0, -1);
        }
        return { done: false };
      }

      if (str && !key.ctrl && str >= " " && str !== "\x7f") {
        buffer += str;
        return { done: false };
      }

      return { done: false };
    }
  });
  rl.resume();
  return resolved;
};

const ensureOutputDirWritable = (runsDir: string): void => {
  const absolute = resolve(process.cwd(), runsDir);
  mkdirSync(absolute, { recursive: true });
  accessSync(absolute, constants.W_OK);
};

const validateConfigResolvable = (input: {
  config: ArbiterResolvedConfig;
  assetRoot: string;
}): void => {
  const tempRoot = mkdtempSync(resolve(tmpdir(), "arbiter-wizard-preflight-"));
  const tempConfigPath = resolve(tempRoot, "arbiter.config.json");
  try {
    writeJsonFile(tempConfigPath, input.config);
    resolveConfig({
      configPath: tempConfigPath,
      configRoot: tempRoot,
      assetRoot: input.assetRoot
    });
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
};

const runPreflight = async (input: {
  config: ArbiterResolvedConfig;
  assetRoot: string;
  runMode: RunMode;
  action: ReviewAction;
}): Promise<string[]> => {
  const warnings: string[] = [];

  validateConfigResolvable({
    config: input.config,
    assetRoot: input.assetRoot
  });

  ensureOutputDirWritable(input.config.output.runs_dir);

  const selectedModels = input.config.sampling.models.map((model) => model.model);
  if (selectedModels.some((model) => model.endsWith(":free"))) {
    warnings.push("Free-tier models may be rate-limited or unavailable; not recommended for publishable research.");
  }

  if (input.action === "run" && input.runMode === "live") {
    if (!process.env.OPENROUTER_API_KEY) {
      throw new Error("Live mode requires OPENROUTER_API_KEY.");
    }
    await listModels();
  }

  if (input.action === "save" && input.runMode === "live" && !process.env.OPENROUTER_API_KEY) {
    warnings.push("Live mode requires OPENROUTER_API_KEY to run; config saved but not executed.");
  }

  return warnings;
};

const buildReviewLines = (input: {
  draft: WizardDraft;
  runMode: RunMode;
  selectedConfigPath: string | null;
  isExistingPath: boolean;
}): string[] => {
  const { draft, runMode, selectedConfigPath, isExistingPath } = input;
  const lines = [
    "Review settings, run checks, and choose how to proceed.",
    "",
    "Preflight",
    "✓ Schema validation",
    "✓ Output path writable",
    runMode === "mock" ? "⚠ Live connectivity check (skipped in Mock mode)" : "✓ Live connectivity check",
    "",
    "Config Summary",
    `Question: ${truncate(draft.question.trim(), 80)}`,
    `Protocol: ${formatProtocol(draft)}`,
    `Models: ${draft.modelSlugs.length} selected`,
    `Personas: ${draft.personaIds.length} selected`,
    `Decode Params: ${toDecodeSummary(draft)}`,
    `Run mode: ${toRunModeLabel(runMode)}`,
    `Output dir: ${draft.outputDir}`
  ];
  if (isExistingPath && selectedConfigPath) {
    lines.push(`Source config: ${selectedConfigPath}`);
  }
  return lines;
};

const runStudy = async (input: {
  runMode: RunMode;
  configPath: string;
  assetRoot: string;
  stackPrefixText?: string;
}): Promise<void> => {
  const hooks = createUiRunLifecycleHooks({
    dashboard: true,
    stackPrefixText: input.stackPrefixText
  });
  const warningSink = createConsoleWarningSink();
  const common = {
    configPath: input.configPath,
    assetRoot: input.assetRoot,
    debug: false,
    quiet: false,
    hooks,
    warningSink,
    forwardWarningEvents: false,
    receiptMode: "auto" as const
  };

  if (input.runMode === "live") {
    await runLiveService(common);
  } else {
    await runMockService(common);
  }
};

const chooseConfigFile = async (
  rl: ReturnType<typeof createInterface>,
  configs: string[],
  frame: StepFrame
): Promise<string | null> => {
  if (configs.length === 1) {
    return resolve(process.cwd(), configs[0]);
  }

  const selected = await selectOne(
    rl,
    "Select a config file",
    configs.map((name) => ({ id: name, label: name })),
    0,
    frame
  );
  if (selected === SELECT_EXIT || selected === SELECT_BACK) {
    return null;
  }
  return resolve(process.cwd(), selected);
};

export const launchWizardTUI = async (options?: { assetRoot?: string }): Promise<void> => {
  const assetRoot = options?.assetRoot ?? process.cwd();
  const version = loadVersion(assetRoot);
  const modelOptions = readCatalogModels(assetRoot);
  const personaOptions = readPersonaOptions(assetRoot);
  const configFiles = listConfigFiles();
  const apiKeyPresent = Boolean(process.env.OPENROUTER_API_KEY);

  const rl = createInterface({ input, output });
  let interactiveScreenEnabled = false;
  const enterInteractiveScreen = (): void => {
    if (output.isTTY && !interactiveScreenEnabled) {
      output.write(ALT_SCREEN_ENABLE);
      interactiveScreenEnabled = true;
    }
  };
  const leaveInteractiveScreen = (): void => {
    if (interactiveScreenEnabled) {
      output.write(ALT_SCREEN_DISABLE);
      interactiveScreenEnabled = false;
    }
  };
  const exitWizard = (message: string): void => {
    leaveInteractiveScreen();
    output.write(`${message}\n`);
  };

  try {
    enterInteractiveScreen();
    renderStepFrame({
      version,
      currentRailIndex: 0,
      completedUntilRailIndex: -1,
      runMode: null,
      apiKeyPresent,
      configCount: configFiles.length,
      contextLabel: "onboarding",
      showRunMode: false,
      showBrandBlock: true,
      activeLabel: "Entry Path",
      activeLines: ["Choose how to start"],
      footerText: "↑/↓ move · Enter select · Esc back",
      stepSummaries: {}
    });

    let entryPath: EntryPath | null = null;
    let runMode: RunMode | null = null;
    while (!entryPath || !runMode) {
      const step0Frame: StepFrame = {
        version,
        currentRailIndex: 0,
        completedUntilRailIndex: -1,
        runMode: null,
        apiKeyPresent,
        configCount: configFiles.length,
        contextLabel: "onboarding",
        showRunMode: false,
        showBrandBlock: true,
        activeLabel: "Entry Path",
        activeLines: [],
        footerText: "↑/↓ move · Enter select · Esc back",
        stepSummaries: {}
      };
      const entryChoice = await selectOne(
        rl,
        "Choose how to start",
        [
          {
            id: "existing",
            label:
              configFiles.length === 0
                ? "Run existing config (unavailable)"
                : "Run existing config",
            disabled: configFiles.length === 0,
            disabledReason: UI_COPY.runExistingUnavailable
          },
          {
            id: "new",
            label: "Create new study (guided wizard)"
          }
        ],
        configFiles.length === 0 ? 1 : 0,
        step0Frame
      );
      if (entryChoice === SELECT_EXIT || entryChoice === SELECT_BACK) {
        exitWizard("Wizard exited.");
        return;
      }
      entryPath = entryChoice as EntryPath;

      const entrySummary =
        entryPath === "existing"
          ? `Run existing config${configFiles.length > 0 ? "" : " (unavailable)"}`
          : "Create new study";

      const runChoice = await selectOne(
        rl,
        "Choose run mode",
        [
          {
            id: "live",
            label: !apiKeyPresent ? "Live (OpenRouter) (unavailable)" : "Live (OpenRouter)",
            disabled: !apiKeyPresent,
            disabledReason: UI_COPY.liveModeUnavailable
          },
          { id: "mock", label: "Mock (no API calls)" }
        ],
        apiKeyPresent ? 0 : 1,
        {
          ...step0Frame,
          currentRailIndex: 1,
          completedUntilRailIndex: 0,
          contextLabel: "onboarding / mode",
          showRunMode: true,
          showBrandBlock: false,
          activeLabel: "Run Mode",
          stepSummaries: { 0: entrySummary }
        }
      );
      if (runChoice === SELECT_EXIT) {
        exitWizard("Wizard exited.");
        return;
      }
      if (runChoice === SELECT_BACK) {
        entryPath = null;
        continue;
      }
      runMode = runChoice as RunMode;
    }

    const baseTemplate = loadTemplateConfig(assetRoot, "default") as ArbiterResolvedConfig;
    let selectedConfigPath: string | null = null;
    let sourceConfig: ArbiterResolvedConfig | null = null;
    let draft = buildDraftFromConfig(baseTemplate, {
      modelSlugs: modelOptions.length > 0 ? [modelOptions[0].slug] : [],
      personaIds: personaOptions.length > 0 ? [personaOptions[0].id] : []
    });

    let revised = entryPath === "new";
    let currentStep: 1 | 2 | 3 | 4 | 5 | 6 | 7 = entryPath === "new" ? 1 : 7;

    const buildStepFrame = (
      currentStepIndex: StepIndex,
      completedUntilIndex: number,
      title: string,
      hint?: string
    ): StepFrame => {
      const showRunMode = Boolean(runMode);
      const toRailIndex = (stepIndex: number): number => {
        if (stepIndex === 0) {
          return showRunMode ? 1 : 0;
        }
        return stepIndex + 1;
      };
      const contextLabel = (() => {
        if (currentStepIndex === 0 && !showRunMode) {
          return "onboarding";
        }
        if (currentStepIndex === 0 && showRunMode) {
          return "onboarding / mode";
        }
        if (currentStepIndex === 1) {
          return "setup / question";
        }
        if (currentStepIndex === 2) {
          return "setup / protocol";
        }
        if (currentStepIndex === 3) {
          return "setup / models";
        }
        if (currentStepIndex === 4) {
          return "setup / personas";
        }
        if (currentStepIndex === 5) {
          return "setup / decode";
        }
        if (currentStepIndex === 6) {
          return "setup / advanced";
        }
        return "setup / review";
      })();
      return {
        version,
        currentRailIndex: toRailIndex(currentStepIndex),
        completedUntilRailIndex: completedUntilIndex < 0 ? -1 : toRailIndex(completedUntilIndex),
        runMode,
        apiKeyPresent,
        configCount: configFiles.length,
        contextLabel,
        showRunMode,
        showBrandBlock: currentStepIndex === 0 && !showRunMode,
        activeLabel: title,
        activeLines: hint ? splitLines(hint) : [],
        footerText: "↑/↓ move · Enter select · Esc back",
        stepSummaries: toRailSummaries({
          draft,
          currentStep: currentStepIndex,
          entryPath,
          selectedConfigPath,
          runMode
        })
      };
    };

    if (entryPath === "existing") {
      selectedConfigPath = await chooseConfigFile(rl, configFiles, {
        ...buildStepFrame(0, 0, "Run Mode", "Select a config file"),
        currentRailIndex: 1,
        completedUntilRailIndex: 1,
        contextLabel: "onboarding / mode",
        showRunMode: true,
        showBrandBlock: false,
        activeLabel: "Run Mode"
      });
      if (!selectedConfigPath) {
        exitWizard("Wizard exited.");
        return;
      }
      sourceConfig = readJsonFile<ArbiterResolvedConfig>(selectedConfigPath);
      draft = buildDraftFromConfig(sourceConfig, {
        modelSlugs: modelOptions.length > 0 ? [modelOptions[0].slug] : [],
        personaIds: personaOptions.length > 0 ? [personaOptions[0].id] : []
      });
      currentStep = 7;
    }

    while (true) {
      if (currentStep === 1) {
        const questionInput = await askMultilineQuestion(rl, draft.question, {
          ...buildStepFrame(
            1,
            0,
            "Research Question",
            "Include all relevant context. Arbiter samples responses to characterize distributional behavior."
          )
        });
        if (questionInput === SELECT_EXIT) {
          exitWizard("Wizard exited.");
          return;
        }
        if (questionInput === SELECT_BACK) {
          output.write("Already at first editable step.\n");
          continue;
        }
        draft.question = questionInput;
        currentStep = 2;
        continue;
      }

      if (currentStep === 2) {
        const protocolSelection = await selectOne(
          rl,
          "Step 2 Protocol",
          [
            { id: "independent", label: "Independent" },
            { id: "debate_v1", label: "Debate" }
          ],
          draft.protocolType === "debate_v1" ? 1 : 0,
          buildStepFrame(2, 1, "Protocol", "Select how each trial is structured.")
        );
        if (protocolSelection === SELECT_EXIT) {
          exitWizard("Wizard exited.");
          return;
        }
        if (protocolSelection === SELECT_BACK) {
          currentStep = 1;
          continue;
        }
        draft.protocolType = protocolSelection as ProtocolType;
        if (draft.protocolType === "debate_v1") {
          renderStepFrame({
            ...buildStepFrame(
              2,
              1,
              "Protocol",
              "Each round: all participants speak in order; after R rounds, participant A gives the final response."
            )
          });
          draft.participants = await askInteger(rl, "Participants (P)", draft.participants, 2);
          draft.rounds = await askInteger(rl, "Rounds (R)", draft.rounds, 1);
        }
        currentStep = 3;
        continue;
      }

      if (currentStep === 3) {
        const selectedModels = await selectMany(
          rl,
          "Step 3 Models",
          modelOptions.map((model) => ({
            id: model.slug,
            label: `${model.display} (${model.provider}) [${model.tier}]${model.slug.endsWith(":free") ? " FREE" : ""}`
          })),
          draft.modelSlugs,
          "Fix required: select at least one model.",
          buildStepFrame(3, 2, "Models", "Select one or more models for sampling.")
        );
        if (selectedModels === SELECT_EXIT) {
          exitWizard("Wizard exited.");
          return;
        }
        if (selectedModels === SELECT_BACK) {
          currentStep = 2;
          continue;
        }
        draft.modelSlugs = selectedModels;
        if (draft.modelSlugs.some((model) => model.endsWith(":free"))) {
          output.write(
            "Warning: free-tier models selected. Availability may be limited. Use paid models for publishable research.\n"
          );
        }
        currentStep = 4;
        continue;
      }

      if (currentStep === 4) {
        const selectedPersonas = await selectMany(
          rl,
          "Step 4 Personas",
          personaOptions.map((persona) => ({ id: persona.id, label: `${persona.id} - ${persona.description}` })),
          draft.personaIds,
          "Fix required: select at least one persona.",
          buildStepFrame(4, 3, "Personas", "Select one or more personas for sampling.")
        );
        if (selectedPersonas === SELECT_EXIT) {
          exitWizard("Wizard exited.");
          return;
        }
        if (selectedPersonas === SELECT_BACK) {
          currentStep = 3;
          continue;
        }
        draft.personaIds = selectedPersonas;
        currentStep = 5;
        continue;
      }

      if (currentStep === 5) {
        while (true) {
          const temperatureModeSelection = await selectOne(
            rl,
            "Temperature mode",
            [
              { id: "single", label: "Single value" },
              { id: "range", label: "Range (uniform)" }
            ],
            draft.temperatureMode === "range" ? 1 : 0,
            buildStepFrame(5, 4, "Decode Params", "Set temperature and seed behavior for trial sampling.")
          );
          if (temperatureModeSelection === SELECT_EXIT) {
            exitWizard("Wizard exited.");
            return;
          }
          if (temperatureModeSelection === SELECT_BACK) {
            currentStep = 4;
            break;
          }

          draft.temperatureMode = temperatureModeSelection as TemperatureMode;
          renderStepFrame({
            ...buildStepFrame(
              5,
              4,
              "Decode Params",
              "Set numeric decode values."
            )
          });
          if (draft.temperatureMode === "single") {
            draft.temperatureSingle = await askFloat(rl, "Temperature", draft.temperatureSingle, 0, 2);
          } else {
            draft.temperatureMin = await askFloat(rl, "Temperature min", draft.temperatureMin, 0, 2);
            draft.temperatureMax = await askFloat(rl, "Temperature max", draft.temperatureMax, draft.temperatureMin, 2);
          }

          const seedModeSelection = await selectOne(
            rl,
            "Seed mode",
            [
              { id: "random", label: "Random" },
              { id: "fixed", label: "Fixed seed" }
            ],
            draft.seedMode === "fixed" ? 1 : 0,
            buildStepFrame(5, 4, "Decode Params", "Set temperature and seed behavior for trial sampling.")
          );
          if (seedModeSelection === SELECT_EXIT) {
            exitWizard("Wizard exited.");
            return;
          }
          if (seedModeSelection === SELECT_BACK) {
            continue;
          }
          draft.seedMode = seedModeSelection as SeedMode;
          if (draft.seedMode === "fixed") {
            renderStepFrame({
              ...buildStepFrame(5, 4, "Decode Params", "Set fixed seed.")
            });
            draft.fixedSeed = await askInteger(rl, "Fixed seed", draft.fixedSeed, 0);
          }
          currentStep = 6;
          break;
        }
        continue;
      }

      if (currentStep === 6) {
        const advancedSelection = await selectOne(
          rl,
          "Advanced settings",
          [
            { id: "defaults", label: "Use defaults (recommended)" },
            { id: "custom", label: "Customize" }
          ],
          draft.useAdvancedDefaults ? 0 : 1,
          buildStepFrame(
            6,
            5,
            "Advanced Settings",
            "Use defaults or customize execution and stopping settings."
          )
        );
        if (advancedSelection === SELECT_EXIT) {
          exitWizard("Wizard exited.");
          return;
        }
        if (advancedSelection === SELECT_BACK) {
          currentStep = 5;
          continue;
        }
        draft.useAdvancedDefaults = advancedSelection === "defaults";
        if (draft.useAdvancedDefaults) {
          const defaults = buildDraftFromConfig(baseTemplate, {
            modelSlugs: draft.modelSlugs,
            personaIds: draft.personaIds
          });
          draft.workers = defaults.workers;
          draft.batchSize = defaults.batchSize;
          draft.kMax = defaults.kMax;
          draft.maxTokens = defaults.maxTokens;
          draft.noveltyThreshold = defaults.noveltyThreshold;
          draft.noveltyPatience = defaults.noveltyPatience;
          draft.kMin = defaults.kMin;
          draft.similarityAdvisoryThreshold = defaults.similarityAdvisoryThreshold;
          draft.outputDir = defaults.outputDir;
        } else {
          draft.workers = await askInteger(rl, "Workers", draft.workers, 1);
          draft.batchSize = await askInteger(rl, "Batch size", draft.batchSize, 1);
          draft.kMax = await askInteger(rl, "K_max", draft.kMax, 1);
          draft.maxTokens = await askInteger(rl, "Max tokens per call", draft.maxTokens, 1);
          draft.noveltyThreshold = await askFloat(rl, "Novelty threshold", draft.noveltyThreshold, 0, 1);
          draft.noveltyPatience = await askInteger(rl, "Patience", draft.noveltyPatience, 1);
          draft.kMin = await askInteger(rl, "K_min eligible trials", draft.kMin, 0);
          draft.similarityAdvisoryThreshold = await askFloat(
            rl,
            "Similarity advisory threshold",
            draft.similarityAdvisoryThreshold,
            0,
            1
          );
          const outputDirAnswer = (await rl.question(`Output dir [${draft.outputDir}]: `)).trim();
          if (outputDirAnswer.length > 0) {
            draft.outputDir = outputDirAnswer;
          }
        }
        currentStep = 7;
        continue;
      }

      const baseConfig = sourceConfig ?? baseTemplate;
      const configForReview = buildConfigFromDraft({ baseConfig, draft });
      const reviewLines = buildReviewLines({
        draft,
        runMode,
        selectedConfigPath,
        isExistingPath: entryPath === "existing"
      });

      const actionSelection = await selectOne(
        rl,
        "Review action",
        [
          { id: "run", label: "Run now" },
          { id: "save", label: "Save config and exit" },
          { id: "revise", label: "Revise" },
          { id: "quit", label: "Quit without saving" }
        ],
        0,
        {
          ...buildStepFrame(7, 6, "Review and Confirm"),
          activeLines: reviewLines
        }
      );

      if (actionSelection === SELECT_EXIT) {
        exitWizard("Wizard exited.");
        return;
      }
      if (actionSelection === SELECT_BACK) {
        revised = true;
        currentStep = 6;
        continue;
      }

      const action = actionSelection as ReviewAction;
      if (action === "quit") {
        exitWizard("Wizard exited without saving.");
        return;
      }

      if (action === "revise") {
        revised = true;
        output.write("Returning to Step 1 with your selections preserved.\n");
        currentStep = 1;
        continue;
      }

      const warnings = await runPreflight({
        config: configForReview,
        assetRoot,
        runMode,
        action
      });
      warnings.forEach((warning) => output.write(`${warning}\n`));

      if (action === "save") {
        const saveTarget = nextCollisionSafeConfigPath();
        writeJsonFile(saveTarget, configForReview);
        leaveInteractiveScreen();
        output.write(`Config saved: ${saveTarget}\n`);
        return;
      }

      let configPathToRun: string;
      if (entryPath === "existing" && selectedConfigPath && !revised) {
        configPathToRun = selectedConfigPath;
      } else {
        const saveTarget = nextCollisionSafeConfigPath();
        writeJsonFile(saveTarget, configForReview);
        output.write(`Config saved: ${saveTarget}\n`);
        configPathToRun = saveTarget;
      }

      const stackPrefixText = [
        buildFrozenRailSummary({
          draft,
          selectedConfigPath,
          entryPath,
          runMode
        }),
        "",
        UI_COPY.startingRun,
        ""
      ].join("\n");

      leaveInteractiveScreen();
      clearScreen();
      await runStudy({
        runMode,
        configPath: configPathToRun,
        assetRoot,
        stackPrefixText
      });
      return;
    }
  } finally {
    leaveInteractiveScreen();
    rl.close();
  }
};
