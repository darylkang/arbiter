import { accessSync, constants, mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import type { ArbiterModelCatalog } from "../../generated/catalog.types.js";
import type { ArbiterPromptManifest } from "../../generated/prompt-manifest.types.js";
import type { ArbiterResolvedConfig } from "../../generated/config.types.js";
import { validateConfig } from "../../config/schema-validation.js";
import { runLiveService, runMockService } from "../../run/run-service.js";
import { listModels } from "../../openrouter/client.js";
import { createConsoleWarningSink } from "../../utils/warnings.js";
import { createUiRunLifecycleHooks } from "../run-lifecycle-hooks.js";
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

const WIZARD_STEP_LABELS = [
  "0 Welcome",
  "1 Question",
  "2 Protocol",
  "3 Models",
  "4 Personas",
  "5 Decode",
  "6 Advanced",
  "7 Review"
];

const clearScreen = (): void => {
  output.write("\x1b[2J\x1b[H");
};

const renderStepFrame = (input: {
  currentStepIndex: number;
  completedUntilIndex: number;
  runMode: RunMode | null;
  apiKeyPresent: boolean;
  configCount: number;
  title: string;
  hint?: string;
}): void => {
  clearScreen();
  output.write("ARBITER\n");
  output.write("Strict Linear Wizard\n");
  output.write(
    `Environment: OPENROUTER_API_KEY ${input.apiKeyPresent ? "yes" : "no"} | configs in CWD ${input.configCount}\n`
  );
  output.write(
    `Run mode: ${input.runMode ?? "-"}\n`
  );
  output.write("\nProgress:\n");
  for (let index = 0; index < WIZARD_STEP_LABELS.length; index += 1) {
    const label = WIZARD_STEP_LABELS[index];
    const marker =
      index === input.currentStepIndex
        ? "▶"
        : index <= input.completedUntilIndex
          ? "✓"
          : "·";
    output.write(`  ${marker} ${label}\n`);
  }
  output.write(`\n${input.title}\n`);
  if (input.hint) {
    output.write(`${input.hint}\n`);
  }
  output.write("\n");
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
    output.write(`Enter an integer >= ${min}.\n`);
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
    output.write(`Enter a number in [${min}, ${max}].\n`);
  }
};

const selectOne = async (
  rl: ReturnType<typeof createInterface>,
  prompt: string,
  choices: Choice[],
  defaultIndex = 0
): Promise<string> => {
  output.write(`${prompt}\n`);
  choices.forEach((choice, index) => {
    const disabled = choice.disabled ? " (disabled)" : "";
    output.write(`  ${index + 1}) ${choice.label}${disabled}\n`);
  });

  while (true) {
    const answer = (await rl.question(`Choose [${defaultIndex + 1}]: `)).trim();
    const choiceIndex = answer.length === 0 ? defaultIndex : Number(answer) - 1;
    if (!Number.isInteger(choiceIndex) || choiceIndex < 0 || choiceIndex >= choices.length) {
      output.write("Invalid selection.\n");
      continue;
    }
    const selected = choices[choiceIndex];
    if (selected.disabled) {
      output.write("That option is disabled.\n");
      continue;
    }
    return selected.id;
  }
};

const selectMany = async (
  rl: ReturnType<typeof createInterface>,
  prompt: string,
  choices: Choice[],
  defaults: string[]
): Promise<string[]> => {
  output.write(`${prompt}\n`);
  choices.forEach((choice, index) => {
    const marker = defaults.includes(choice.id) ? "*" : " ";
    output.write(`  ${index + 1}) [${marker}] ${choice.label}\n`);
  });
  output.write("Enter comma-separated numbers (blank keeps defaults).\n");

  while (true) {
    const answer = (await rl.question("Selection: ")).trim();
    if (!answer) {
      if (defaults.length > 0) {
        return defaults;
      }
      output.write("Select at least one option.\n");
      continue;
    }

    const parts = answer
      .split(",")
      .map((part) => part.trim())
      .filter((part) => part.length > 0);
    const indexes = parts.map((part) => Number(part) - 1);
    if (indexes.some((index) => !Number.isInteger(index) || index < 0 || index >= choices.length)) {
      output.write("Invalid selection.\n");
      continue;
    }

    const selectedIds = Array.from(new Set(indexes.map((index) => choices[index].id)));
    if (selectedIds.length === 0) {
      output.write("Select at least one option.\n");
      continue;
    }

    return selectedIds;
  }
};

const askMultilineQuestion = async (
  rl: ReturnType<typeof createInterface>,
  initial: string
): Promise<string> => {
  output.write("Enter your question/context. Submit an empty line to finish.\n");
  if (initial.trim().length > 0) {
    output.write(`Current value (${initial.length} chars): ${initial}\n`);
  }

  const lines: string[] = [];
  while (true) {
    const line = await rl.question("");
    if (line.length === 0) {
      const joined = lines.join("\n").trim();
      if (joined.length === 0) {
        output.write("Question cannot be empty.\n");
        continue;
      }
      return joined;
    }
    lines.push(line);
  }
};

const ensureOutputDirWritable = (runsDir: string): void => {
  const absolute = resolve(process.cwd(), runsDir);
  mkdirSync(absolute, { recursive: true });
  accessSync(absolute, constants.W_OK);
};

const runPreflight = async (input: {
  config: ArbiterResolvedConfig;
  runMode: RunMode;
  action: ReviewAction;
}): Promise<string[]> => {
  const warnings: string[] = [];
  if (!validateConfig(input.config)) {
    const detail = validateConfig.errors?.map((error) => `${error.instancePath} ${error.message}`).join("; ");
    throw new Error(`schema validation failed${detail ? `: ${detail}` : ""}`);
  }

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

const renderReview = (input: {
  draft: WizardDraft;
  runMode: RunMode;
  selectedConfigPath: string | null;
  isExistingPath: boolean;
}): void => {
  const { draft, runMode, selectedConfigPath, isExistingPath } = input;
  output.write("\nStep 7 — Review & Confirm\n");
  output.write(`Question: ${draft.question}\n`);
  output.write(`Protocol: ${formatProtocol(draft)}\n`);
  output.write(`Models: ${draft.modelSlugs.length} selected\n`);
  output.write(`Personas: ${draft.personaIds.length} selected\n`);
  output.write(
    `Decode: ${
      draft.temperatureMode === "single"
        ? `temp ${draft.temperatureSingle}`
        : `temp ${draft.temperatureMin}-${draft.temperatureMax} (uniform)`
    }, seed ${draft.seedMode === "fixed" ? draft.fixedSeed : "random"}\n`
  );
  output.write(`Execution: workers ${draft.workers}, batch ${draft.batchSize}, K_max ${draft.kMax}\n`);
  output.write(`Run mode: ${runMode}\n`);
  output.write(`Output dir: ${draft.outputDir}\n`);
  if (isExistingPath && selectedConfigPath) {
    output.write(`Source config: ${selectedConfigPath}\n`);
  }
};

const runStudy = async (input: {
  runMode: RunMode;
  configPath: string;
  assetRoot: string;
}): Promise<void> => {
  const hooks = createUiRunLifecycleHooks({ dashboard: true });
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
  configs: string[]
): Promise<string> => {
  if (configs.length === 1) {
    return resolve(process.cwd(), configs[0]);
  }

  const selected = await selectOne(
    rl,
    "Select existing config:",
    configs.map((name) => ({ id: name, label: name }))
  );
  return resolve(process.cwd(), selected);
};

export const launchWizardTUI = async (options?: { assetRoot?: string }): Promise<void> => {
  const assetRoot = options?.assetRoot ?? process.cwd();
  const modelOptions = readCatalogModels(assetRoot);
  const personaOptions = readPersonaOptions(assetRoot);
  const configFiles = listConfigFiles();
  const apiKeyPresent = Boolean(process.env.OPENROUTER_API_KEY);

  const rl = createInterface({ input, output });

  try {
    renderStepFrame({
      currentStepIndex: 0,
      completedUntilIndex: -1,
      runMode: null,
      apiKeyPresent,
      configCount: configFiles.length,
      title: "Step 0 — Welcome",
      hint: "Choose entry path and run mode."
    });

    const entryPath = (await selectOne(
      rl,
      "Step 0 — Entry path",
      [
        {
          id: "existing",
          label: "Run existing config",
          disabled: configFiles.length === 0
        },
        {
          id: "new",
          label: "Create new study (guided wizard)"
        }
      ],
      configFiles.length === 0 ? 1 : 0
    )) as EntryPath;

    const runMode = (await selectOne(
      rl,
      "Step 0 — Run mode",
      [
        { id: "live", label: "Live (OpenRouter)", disabled: !apiKeyPresent },
        { id: "mock", label: "Mock (no API calls)" }
      ],
      apiKeyPresent ? 0 : 1
    )) as RunMode;

    const baseTemplate = loadTemplateConfig(assetRoot, "default") as ArbiterResolvedConfig;
    let selectedConfigPath: string | null = null;
    let sourceConfig: ArbiterResolvedConfig | null = null;
    let draft = buildDraftFromConfig(baseTemplate, {
      modelSlugs: modelOptions.length > 0 ? [modelOptions[0].slug] : [],
      personaIds: personaOptions.length > 0 ? [personaOptions[0].id] : []
    });

    let revised = entryPath === "new";
    let shouldRunStepFlow = entryPath === "new";

    if (entryPath === "existing") {
      selectedConfigPath = await chooseConfigFile(rl, configFiles);
      sourceConfig = readJsonFile<ArbiterResolvedConfig>(selectedConfigPath);
      draft = buildDraftFromConfig(sourceConfig, {
        modelSlugs: modelOptions.length > 0 ? [modelOptions[0].slug] : [],
        personaIds: personaOptions.length > 0 ? [personaOptions[0].id] : []
      });
      shouldRunStepFlow = false;
    }

    while (true) {
      if (shouldRunStepFlow) {
        renderStepFrame({
          currentStepIndex: 1,
          completedUntilIndex: 0,
          runMode,
          apiKeyPresent,
          configCount: configFiles.length,
          title: "Step 1 — Research Question",
          hint: "Include relevant context. Arbiter samples responses to characterize distributional behavior."
        });
        draft.question = await askMultilineQuestion(rl, draft.question);

        renderStepFrame({
          currentStepIndex: 2,
          completedUntilIndex: 1,
          runMode,
          apiKeyPresent,
          configCount: configFiles.length,
          title: "Step 2 — Protocol",
          hint: "Choose Independent or Debate."
        });
        const protocol = await selectOne(
          rl,
          "Step 2 — Protocol",
          [
            { id: "independent", label: "Independent" },
            { id: "debate_v1", label: "Debate" }
          ],
          draft.protocolType === "debate_v1" ? 1 : 0
        );
        draft.protocolType = protocol as ProtocolType;
        if (draft.protocolType === "debate_v1") {
          draft.participants = await askInteger(rl, "Participants", draft.participants, 2);
          draft.rounds = await askInteger(rl, "Rounds", draft.rounds, 1);
        }

        renderStepFrame({
          currentStepIndex: 3,
          completedUntilIndex: 2,
          runMode,
          apiKeyPresent,
          configCount: configFiles.length,
          title: "Step 3 — Models",
          hint: "Select one or more models."
        });
        draft.modelSlugs = await selectMany(
          rl,
          "Step 3 — Models",
          modelOptions.map((model) => ({
            id: model.slug,
            label: `${model.display} (${model.provider}) [${model.tier}]${model.slug.endsWith(":free") ? " FREE" : ""}`
          })),
          draft.modelSlugs
        );

        renderStepFrame({
          currentStepIndex: 4,
          completedUntilIndex: 3,
          runMode,
          apiKeyPresent,
          configCount: configFiles.length,
          title: "Step 4 — Personas",
          hint: "Select one or more personas."
        });
        draft.personaIds = await selectMany(
          rl,
          "Step 4 — Personas",
          personaOptions.map((persona) => ({ id: persona.id, label: `${persona.id} - ${persona.description}` })),
          draft.personaIds
        );

        renderStepFrame({
          currentStepIndex: 5,
          completedUntilIndex: 4,
          runMode,
          apiKeyPresent,
          configCount: configFiles.length,
          title: "Step 5 — Decode Params",
          hint: "Configure temperature and seed modes."
        });
        draft.temperatureMode = (await selectOne(
          rl,
          "Step 5 — Temperature mode",
          [
            { id: "single", label: "Single value" },
            { id: "range", label: "Range (uniform)" }
          ],
          draft.temperatureMode === "range" ? 1 : 0
        )) as TemperatureMode;

        if (draft.temperatureMode === "single") {
          draft.temperatureSingle = await askFloat(rl, "Temperature", draft.temperatureSingle, 0, 2);
        } else {
          draft.temperatureMin = await askFloat(rl, "Temperature min", draft.temperatureMin, 0, 2);
          draft.temperatureMax = await askFloat(rl, "Temperature max", draft.temperatureMax, draft.temperatureMin, 2);
        }

        draft.seedMode = (await selectOne(
          rl,
          "Step 5 — Seed mode",
          [
            { id: "random", label: "Random" },
            { id: "fixed", label: "Fixed seed" }
          ],
          draft.seedMode === "fixed" ? 1 : 0
        )) as SeedMode;

        if (draft.seedMode === "fixed") {
          draft.fixedSeed = await askInteger(rl, "Fixed seed", draft.fixedSeed, 0);
        }

        renderStepFrame({
          currentStepIndex: 6,
          completedUntilIndex: 5,
          runMode,
          apiKeyPresent,
          configCount: configFiles.length,
          title: "Step 6 — Advanced Settings",
          hint: "Use defaults or customize execution and stopping settings."
        });
        draft.useAdvancedDefaults =
          (await selectOne(
            rl,
            "Step 6 — Advanced",
            [
              { id: "defaults", label: "Use defaults (recommended)" },
              { id: "custom", label: "Customize" }
            ],
            draft.useAdvancedDefaults ? 0 : 1
          )) === "defaults";

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
      }

      const baseConfig = sourceConfig ?? baseTemplate;
      const configForReview = buildConfigFromDraft({ baseConfig, draft });
      renderStepFrame({
        currentStepIndex: 7,
        completedUntilIndex: 6,
        runMode,
        apiKeyPresent,
        configCount: configFiles.length,
        title: "Step 7 — Review & Confirm",
        hint: "Config is written only on Run now or Save config and exit."
      });
      renderReview({
        draft,
        runMode,
        selectedConfigPath,
        isExistingPath: entryPath === "existing"
      });

      const action = (await selectOne(
        rl,
        "Review action",
        [
          { id: "run", label: "Run now" },
          { id: "save", label: "Save config and exit" },
          { id: "revise", label: "Revise" },
          { id: "quit", label: "Quit without saving" }
        ]
      )) as ReviewAction;

      if (action === "quit") {
        output.write("Wizard exited without saving.\n");
        return;
      }

      if (action === "revise") {
        revised = true;
        shouldRunStepFlow = true;
        continue;
      }

      const warnings = await runPreflight({ config: configForReview, runMode, action });
      warnings.forEach((warning) => output.write(`warning: ${warning}\n`));

      if (action === "save") {
        const saveTarget = nextCollisionSafeConfigPath();
        writeJsonFile(saveTarget, configForReview);
        output.write(`Saved config: ${saveTarget}\n`);
        return;
      }

      let configPathToRun: string;
      if (entryPath === "existing" && selectedConfigPath && !revised) {
        configPathToRun = selectedConfigPath;
      } else {
        const saveTarget = nextCollisionSafeConfigPath();
        writeJsonFile(saveTarget, configForReview);
        output.write(`Saved config: ${saveTarget}\n`);
        configPathToRun = saveTarget;
      }

      await runStudy({
        runMode,
        configPath: configPathToRun,
        assetRoot
      });
      return;
    }
  } finally {
    rl.close();
  }
};
