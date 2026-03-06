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
import { chooseConfigFile, selectOne } from "./controls.js";
import {
  buildDraftFromConfig,
  buildFrozenRailSummary,
  toRailSummaries
} from "./draft.js";
import { loadWizardOptions } from "./resources.js";
import { createWizardStepControllers, type WizardStepResult } from "./steps.js";
import {
  RAIL_ITEMS,
  SELECT_BACK,
  SELECT_EXIT,
  type EntryPath,
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
    const stepControllers = createWizardStepControllers({
      assetRoot,
      modelOptions,
      personaOptions,
      buildStepFrame,
      renderStepFrame
    });

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
      const result: WizardStepResult = await stepControllers[currentStep]({
        draft,
        runMode,
        entryPath,
        selectedConfigPath,
        revised,
        baseTemplate,
        sourceConfig
      });

      if (result.kind === "exit") {
        exitWizard(result.message);
        return;
      }

      if (result.kind === "goto") {
        revised = result.revised ?? revised;
        currentStep = result.step;
        continue;
      }

      result.warnings.forEach((warning: string) => output.write(`${warning}\n`));

      if (result.kind === "save") {
        const saveTarget = nextCollisionSafeConfigPath();
        writeJsonFile(saveTarget, result.config);
        leaveInteractiveScreen();
        output.write(`Config saved: ${saveTarget}\n`);
        return;
      }

      let configPathToRun: string;
      if (entryPath === "existing" && selectedConfigPath && !result.revised) {
        configPathToRun = selectedConfigPath;
      } else {
        const saveTarget = nextCollisionSafeConfigPath();
        writeJsonFile(saveTarget, result.config);
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
