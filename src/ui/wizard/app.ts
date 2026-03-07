import type { ArbiterResolvedConfig } from "../../generated/config.types.js";
import { runLiveService, runMockService } from "../../run/run-service.js";
import { createConsoleWarningSink } from "../../utils/warnings.js";
import { createUiRunLifecycleHooks } from "../run-lifecycle-hooks.js";
import { UI_COPY } from "../copy.js";
import { createStdoutFormatter } from "../fmt.js";
import { renderSeparator } from "../wizard-theme.js";
import {
  listConfigFiles,
  nextCollisionSafeConfigPath,
  loadTemplateConfig,
  writeJsonFile
} from "../../cli/commands.js";
import {
  buildDraftFromConfig,
  buildFrozenRailSummary,
  toRailSummaries
} from "./draft.js";
import { createWizardFrameManager } from "./frame-manager.js";
import { loadWizardOptions } from "./resources.js";
import { getWizardTerminalSupport } from "../tui-constraints.js";
import {
  createWizardControllers,
  type WizardFlowState,
  type WizardStage,
  type WizardStepResult
} from "./steps.js";
import {
  type RunMode,
  type StepFrame,
  type StepIndex
} from "./types.js";

const splitLines = (value: string): string[] => value.split("\n").filter((line) => line.length > 0);

const runStudy = async (input: {
  runMode: RunMode;
  configPath: string;
  assetRoot: string;
  stackPrefixText?: string;
  modelDisplayBySlug?: Map<string, string>;
}): Promise<void> => {
  const fmt = createStdoutFormatter();
  const hooks = createUiRunLifecycleHooks({
    dashboard: true,
    stackPrefixText: input.stackPrefixText,
    modelDisplayBySlug: input.modelDisplayBySlug
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
  const frameManager = createWizardFrameManager();
  const terminalSupport = getWizardTerminalSupport(process.stdout);
  if (process.stdout.isTTY && !terminalSupport.ok) {
    frameManager.exit(UI_COPY.wizardTerminalTooSmall);
    return;
  }
  const { version, modelOptions, personaOptions } = loadWizardOptions(assetRoot);
  const modelLabelBySlug = new Map(modelOptions.map((model) => [model.slug, model.display]));
  const personaLabelById = new Map(personaOptions.map((persona) => [persona.id, persona.display]));
  const configFilesResolved = listConfigFiles();
  const apiKeyPresent = Boolean(process.env.OPENROUTER_API_KEY);

  try {
    frameManager.enter();

    const baseTemplate = loadTemplateConfig(assetRoot, "default") as ArbiterResolvedConfig;
    const state: WizardFlowState = {
      draft: {
        ...buildDraftFromConfig(baseTemplate, {
          modelSlugs: modelOptions.length > 0 ? [modelOptions[0].slug] : [],
          personaIds: personaOptions.length > 0 ? [personaOptions[0].id] : []
        }),
        question: ""
      },
      runMode: null,
      entryPath: null,
      selectedConfigPath: null,
      revised: false,
      baseTemplate,
      sourceConfig: null
    };
    let currentStage: WizardStage = "entry";

    const buildStepFrame = (
      currentStepIndex: StepIndex,
      completedUntilIndex: number,
      title: string,
      hint?: string
    ): StepFrame => {
      const showRunMode = Boolean(state.runMode);
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
        runMode: state.runMode,
        apiKeyPresent,
        configCount: configFilesResolved.length,
        contextLabel,
        showRunMode,
        activeLabel: title,
        activeLines: hint ? splitLines(hint) : [],
        footerText: "↑/↓ move · Enter select · Esc back",
        stepSummaries: toRailSummaries({
          draft: state.draft,
          currentStep: currentStepIndex,
          entryPath: state.entryPath,
          selectedConfigPath: state.selectedConfigPath,
          runMode: state.runMode,
          modelLabels: modelLabelBySlug,
          personaLabels: personaLabelById
        })
      };
    };
    const controllers = createWizardControllers({
      assetRoot,
      version,
      apiKeyPresent,
      configFiles: configFilesResolved,
      configCount: configFilesResolved.length,
      modelOptions,
      personaOptions,
      modelLabels: modelLabelBySlug,
      personaLabels: personaLabelById,
      buildStepFrame,
      renderStepFrame: frameManager.render
    });

    while (true) {
      const result: WizardStepResult = await controllers[currentStage](state);

      if (result.kind === "exit") {
        frameManager.exit(result.message);
        return;
      }

      if (result.kind === "goto") {
        state.revised = result.revised ?? state.revised;
        currentStage = result.step;
        continue;
      }

      frameManager.printLines(result.warnings);

      if (result.kind === "save") {
        const saveTarget = nextCollisionSafeConfigPath();
        writeJsonFile(saveTarget, result.config);
        frameManager.printLine(`Config saved: ${saveTarget}`);
        return;
      }

      if (!state.entryPath || !state.runMode) {
        throw new Error("Run requested before wizard state was fully initialized.");
      }

      let configPathToRun: string;
      if (state.entryPath === "existing" && state.selectedConfigPath && !result.revised) {
        configPathToRun = state.selectedConfigPath;
      } else {
        const saveTarget = nextCollisionSafeConfigPath();
        writeJsonFile(saveTarget, result.config);
        frameManager.printLine(`Config saved: ${saveTarget}`);
        configPathToRun = saveTarget;
      }

      const fmt = createStdoutFormatter();
      const stackPrefixText = [
        buildFrozenRailSummary({
          draft: state.draft,
          selectedConfigPath: state.selectedConfigPath,
          entryPath: state.entryPath,
          runMode: state.runMode,
          modelLabels: modelLabelBySlug,
          personaLabels: personaLabelById
        }),
        "",
        renderSeparator(fmt.termWidth(), fmt),
        fmt.muted(UI_COPY.startingRun),
        ""
      ].join("\n");

      frameManager.leave();
      frameManager.clearScreen();
      await runStudy({
        runMode: state.runMode,
        configPath: configPathToRun,
        assetRoot,
        stackPrefixText,
        modelDisplayBySlug: modelLabelBySlug
      });
      return;
    }
  } finally {
    frameManager.leave();
  }
};
