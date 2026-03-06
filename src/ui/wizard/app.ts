import { stdout as output } from "node:process";

import type { ArbiterResolvedConfig } from "../../generated/config.types.js";
import { runLiveService, runMockService } from "../../run/run-service.js";
import { createConsoleWarningSink } from "../../utils/warnings.js";
import { createUiRunLifecycleHooks } from "../run-lifecycle-hooks.js";
import { UI_COPY } from "../copy.js";
import { createStdoutFormatter } from "../fmt.js";
import {
  renderBrandBlock,
  renderRailContent,
  renderRailStep,
  renderSeparator,
  renderStatusStrip,
  type RailStep
} from "../wizard-theme.js";
import {
  listConfigFiles,
  nextCollisionSafeConfigPath,
  loadTemplateConfig,
  readJsonFile,
  writeJsonFile
} from "../../cli/commands.js";
import { askMultilineQuestion, chooseConfigFile, selectMany, selectOne } from "./controls.js";
import {
  buildConfigFromDraft,
  buildDraftFromConfig,
  buildFrozenRailSummary,
  buildReviewLines,
  toRailSummaries
} from "./draft.js";
import {
  configureAdvancedSettings,
  configureDebateProtocol,
  configureDecodeParams,
  runPreflight
} from "./flows.js";
import { loadWizardOptions } from "./resources.js";
import {
  RAIL_ITEMS,
  SELECT_BACK,
  SELECT_EXIT,
  type EntryPath,
  type ProtocolType,
  type ReviewAction,
  type RunMode,
  type StepFrame,
  type StepIndex
} from "./types.js";

const ALT_SCREEN_ENABLE = "\x1b[?1049h";
const ALT_SCREEN_DISABLE = "\x1b[?1049l";
const CURSOR_HIDE = "\x1b[?25l";
const CURSOR_SHOW = "\x1b[?25h";

const clearScreen = (): void => {
  output.write("\x1b[H\x1b[J");
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
  parts.push(
    renderBrandBlock(
      input.version,
      input.apiKeyPresent,
      input.runMode,
      input.configCount,
      fmt
    )
  );
  parts.push("");

  for (const step of railSteps) {
    const isActiveStep = step.state === "active";
    parts.push(renderRailStep(step, fmt, input.dimmedRail === true));
    if (isActiveStep) {
      parts.push(renderRailContent(input.activeLines, fmt));
    }
  }

  parts.push("");
  parts.push(renderSeparator(width, fmt));
  parts.push(input.footerText);
  output.write(`${parts.join("\n")}\n`);
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

export const launchWizardTUI = async (options?: { assetRoot?: string }): Promise<void> => {
  const assetRoot = options?.assetRoot ?? process.cwd();
  const { version, modelOptions, personaOptions } = loadWizardOptions(assetRoot);
  const configFiles = listConfigFiles();
  const apiKeyPresent = Boolean(process.env.OPENROUTER_API_KEY);

  let interactiveScreenEnabled = false;
  const enterInteractiveScreen = (): void => {
    if (output.isTTY && !interactiveScreenEnabled) {
      output.write(ALT_SCREEN_ENABLE);
      output.write(CURSOR_HIDE);
      interactiveScreenEnabled = true;
    }
  };
  const leaveInteractiveScreen = (): void => {
    if (interactiveScreenEnabled) {
      output.write(CURSOR_SHOW);
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
        activeLabel: "Entry Path",
        activeLines: [],
        footerText: "↑/↓ move · Enter select · Esc back",
        stepSummaries: {}
      };

      const entryChoice = await selectOne({
        prompt: "Choose how to start",
        choices: [
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
        defaultIndex: configFiles.length === 0 ? 1 : 0,
        frame: step0Frame,
        renderStepFrame
      });
      if (entryChoice === SELECT_EXIT || entryChoice === SELECT_BACK) {
        exitWizard("Wizard exited.");
        return;
      }
      entryPath = entryChoice as EntryPath;

      const entrySummary = entryPath === "existing" ? "Run existing config" : "Create new study";

      const runChoice = await selectOne({
        prompt: "Choose run mode",
        choices: [
          {
            id: "live",
            label: !apiKeyPresent ? "Live (OpenRouter) (unavailable)" : "Live (OpenRouter)",
            disabled: !apiKeyPresent,
            disabledReason: UI_COPY.liveModeUnavailable
          },
          { id: "mock", label: "Mock (no API calls)" }
        ],
        defaultIndex: apiKeyPresent ? 0 : 1,
        frame: {
          ...step0Frame,
          currentRailIndex: 1,
          completedUntilRailIndex: 0,
          contextLabel: "onboarding / mode",
          showRunMode: true,
          activeLabel: "Run Mode",
          stepSummaries: { 0: entrySummary }
        },
        renderStepFrame
      });
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
      selectedConfigPath = await chooseConfigFile({
        configs: configFiles,
        frame: {
          ...buildStepFrame(0, 0, "Run Mode", "Select a config file"),
          currentRailIndex: 1,
          completedUntilRailIndex: 1,
          contextLabel: "onboarding / mode",
          showRunMode: true,
          activeLabel: "Run Mode"
        },
        renderStepFrame
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
        const questionInput = await askMultilineQuestion({
          initial: draft.question,
          frame: buildStepFrame(1, 0, "Research Question"),
          renderStepFrame
        });
        if (questionInput === SELECT_EXIT) {
          exitWizard("Wizard exited.");
          return;
        }
        if (questionInput === SELECT_BACK) {
          continue;
        }
        draft.question = questionInput;
        currentStep = 2;
        continue;
      }

      if (currentStep === 2) {
        const protocolSelection = await selectOne({
          prompt: "Protocol",
          choices: [
            { id: "independent", label: "Independent" },
            { id: "debate_v1", label: "Debate" }
          ],
          defaultIndex: draft.protocolType === "debate_v1" ? 1 : 0,
          frame: buildStepFrame(2, 1, "Protocol", "Select how each trial is structured."),
          renderStepFrame
        });
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
          const debateConfigResult = await configureDebateProtocol({
            draft,
            buildStepFrame,
            renderStepFrame
          });
          if (debateConfigResult === SELECT_EXIT) {
            exitWizard("Wizard exited.");
            return;
          }
          if (debateConfigResult === SELECT_BACK) {
            continue;
          }
        }
        currentStep = 3;
        continue;
      }

      if (currentStep === 3) {
        const selectedModels = await selectMany({
          prompt: "Models",
          choices: modelOptions.map((model) => ({
            id: model.slug,
            label: `${model.slug} ${model.slug.endsWith(":free") ? "[free]" : "[paid]"}${
              model.slug.includes("mini") || model.slug.includes("flash")
                ? " [fast]"
                : !model.slug.endsWith(":free")
                  ? " [stable]"
                  : ""
            }`
          })),
          defaults: draft.modelSlugs,
          emptySelectionError: "Fix required: select at least one model.",
          frame: buildStepFrame(3, 2, "Models", "Select one or more models for sampling."),
          extraLines: (selected) =>
            Array.from(selected).some((slug) => slug.endsWith(":free"))
              ? [
                  "Warning: free-tier models selected. Availability may be limited. Use paid models for publishable research."
                ]
              : [],
          renderStepFrame
        });
        if (selectedModels === SELECT_EXIT) {
          exitWizard("Wizard exited.");
          return;
        }
        if (selectedModels === SELECT_BACK) {
          currentStep = 2;
          continue;
        }
        draft.modelSlugs = selectedModels;
        currentStep = 4;
        continue;
      }

      if (currentStep === 4) {
        const selectedPersonas = await selectMany({
          prompt: "Personas",
          choices: personaOptions.map((persona) => ({ id: persona.id, label: `${persona.id} - ${persona.description}` })),
          defaults: draft.personaIds,
          emptySelectionError: "Fix required: select at least one persona.",
          frame: buildStepFrame(4, 3, "Personas", "Select one or more personas for sampling."),
          renderStepFrame
        });
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
        const decodeResult = await configureDecodeParams({
          draft,
          buildStepFrame,
          renderStepFrame
        });
        if (decodeResult === SELECT_EXIT) {
          exitWizard("Wizard exited.");
          return;
        }
        if (decodeResult === SELECT_BACK) {
          currentStep = 4;
          continue;
        }
        currentStep = 6;
        continue;
      }

      if (currentStep === 6) {
        const defaults = buildDraftFromConfig(baseTemplate, {
          modelSlugs: draft.modelSlugs,
          personaIds: draft.personaIds
        });
        const advancedResult = await configureAdvancedSettings({
          draft,
          defaults,
          buildStepFrame,
          renderStepFrame
        });
        if (advancedResult === SELECT_EXIT) {
          exitWizard("Wizard exited.");
          return;
        }
        if (advancedResult === SELECT_BACK) {
          currentStep = 5;
          continue;
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

      const actionSelection = await selectOne({
        prompt: "Review action",
        choices: [
          { id: "run", label: "Run now" },
          { id: "save", label: "Save config and exit" },
          { id: "revise", label: "Revise" },
          { id: "quit", label: "Quit without saving" }
        ],
        defaultIndex: 0,
        frame: {
          ...buildStepFrame(7, 6, "Review and Confirm"),
          activeLines: reviewLines
        },
        renderStepFrame
      });

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
  }
};
