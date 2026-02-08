import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  CombinedAutocompleteProvider,
  ProcessTerminal,
  TUI,
  type OverlayOptions,
  type SlashCommand
} from "@mariozechner/pi-tui";

import { buildReportModel, formatReportText } from "../../tools/report-run.js";
import { formatVerifyReport, verifyRunDir } from "../../tools/verify-run.js";
import { getAssetRoot } from "../../utils/asset-root.js";
import { appendTranscript } from "./reducer.js";
import { createRunController } from "./run-controller.js";
import type { AppState, OverlayState } from "./state.js";
import { createInitialState } from "./state.js";
import { createTranscriptLayout } from "./layout.js";
import { createOverlayComponent } from "./components/overlay.js";
import { executeCommandInput, listSlashCommands } from "./commands/registry.js";
import type { CommandContext } from "./commands/types.js";
import { renderReceiptForRun } from "./components/receipt-view.js";
import { formatError } from "./error-format.js";
import { listRunDirs, resolveRunDirArg, toRunDirLabel } from "./run-dirs.js";
import { createIntakeFlowController } from "./intake-flow.js";
import type { ProfileDefinition } from "./profiles.js";

const DEFAULT_CONFIG_PATH = "arbiter.config.json";

const writeTemplateConfigFile = (
  assetRoot: string,
  templateName: string,
  question: string,
  targetPath: string
): void => {
  const templatePath = resolve(assetRoot, "templates", `${templateName}.config.json`);
  const raw = readFileSync(templatePath, "utf8");
  const template = JSON.parse(raw) as Record<string, unknown>;
  const questionBlock = (template.question ?? {}) as Record<string, unknown>;
  questionBlock.text = question;
  template.question = questionBlock;
  writeFileSync(targetPath, `${JSON.stringify(template, null, 2)}\n`, "utf8");
};

const appendSystem = (state: AppState, message: string): void => {
  appendTranscript(state, "system", message);
};

const appendStatus = (state: AppState, message: string): void => {
  appendTranscript(state, "status", message);
};

const appendError = (state: AppState, message: string): void => {
  appendTranscript(state, "error", message);
};

const renderWarningsBlock = (state: AppState): void => {
  if (state.warnings.length === 0) {
    appendStatus(state, "warnings: none");
    return;
  }

  appendStatus(state, `warnings (${state.warnings.length}):`);
  state.warnings.forEach((warning) => {
    appendTranscript(
      state,
      "warning",
      `${warning.source ? `[${warning.source}] ` : ""}${warning.message}`,
      warning.recorded_at
    );
  });
};

export const launchTranscriptTUI = async (options?: { assetRoot?: string }): Promise<void> => {
  const assetRoot = options?.assetRoot ?? getAssetRoot();
  const startupWarnings: string[] = [];
  const initialRunDirs = listRunDirs({
    onError: (message) => startupWarnings.push(message)
  });
  const state = createInitialState({
    configPath: resolve(process.cwd(), DEFAULT_CONFIG_PATH),
    hasApiKey: Boolean(process.env.OPENROUTER_API_KEY),
    hasConfig: existsSync(resolve(process.cwd(), DEFAULT_CONFIG_PATH)),
    runsCount: initialRunDirs.length
  });
  startupWarnings.forEach((message) => {
    appendTranscript(state, "warning", message);
  });

  const tui = new TUI(new ProcessTerminal());

  let resolveExit: (() => void) | null = null;
  const done = new Promise<void>((resolvePromise) => {
    resolveExit = resolvePromise;
  });

  let overlayState: OverlayState | null = null;

  const requestRender = (): void => {
    layout.sync(state);
    syncOverlay();
    tui.requestRender();
  };

  const runController = createRunController({
    assetRoot,
    state,
    requestRender
  });

  const slashCommands: SlashCommand[] = listSlashCommands().map((command) => ({
    name: command.name,
    description: command.description
  }));

  const shutdown = (): void => {
    runController.dispose();
    while (tui.hasOverlay()) {
      tui.hideOverlay();
    }
    tui.stop();
    resolveExit?.();
  };

  const layout = createTranscriptLayout({
    tui,
    onSubmit: (value) => {
      void handleSubmit(value);
    },
    onEscape: () => {
      if (state.overlay) {
        state.overlay = null;
        requestRender();
        return;
      }
      layout.editor.setText("");
      requestRender();
    },
    onCtrlC: () => {
      if (state.phase === "running") {
        runController.interrupt();
        appendTranscript(
          state,
          "warning",
          "interrupt requested. waiting for in-flight trials to finish"
        );
        requestRender();
        return;
      }
      shutdown();
    }
  });

  layout.editor.setAutocompleteProvider(new CombinedAutocompleteProvider(slashCommands));

  const resolveOverlayOptions = (): OverlayOptions => {
    const termWidth = Math.max(24, tui.terminal.columns);
    const termHeight = Math.max(12, tui.terminal.rows);
    const width = Math.max(24, Math.min(84, termWidth - 2, Math.floor(termWidth * 0.74)));
    const maxHeight = Math.max(8, Math.min(26, termHeight - 4, Math.floor(termHeight * 0.65)));
    return {
      width,
      maxHeight,
      anchor: "center"
    };
  };

  const syncOverlay = (): void => {
    if (!state.overlay && overlayState) {
      overlayState = null;
      if (tui.hasOverlay()) {
        tui.hideOverlay();
      }
      layout.focusInput();
      return;
    }

    if (!state.overlay) {
      return;
    }

    if (overlayState) {
      if (tui.hasOverlay()) {
        tui.hideOverlay();
      }
      overlayState = null;
    }

    const component = createOverlayComponent(state.overlay, () => {
      requestRender();
    });
    overlayState = state.overlay;
    tui.showOverlay(component, resolveOverlayOptions());
    tui.setFocus(component);
  };

  const reportRunDirError = (message: string): void => {
    appendTranscript(state, "warning", message);
  };

  const selectRunDir = async (runDirArg?: string): Promise<string | null> => {
    const resolvedRunDir = resolveRunDirArg(state, runDirArg);
    if (resolvedRunDir) {
      state.runDir = resolvedRunDir;
      state.lastRunDir = resolvedRunDir;
      requestRender();
      return resolvedRunDir;
    }

    const runDirs = listRunDirs({
      onError: reportRunDirError
    });
    if (runDirs.length === 0) {
      appendError(state, "no run directories found in ./runs");
      requestRender();
      return null;
    }

    const items = runDirs.map((runDir) => ({
      id: runDir,
      label: toRunDirLabel(runDir),
      description: runDir
    }));

    return new Promise((resolveSelection) => {
      state.overlay = {
        kind: "select",
        title: "select run directory",
        items,
        selectedIndex: 0,
        onSelect: (item) => {
          state.overlay = null;
          state.runDir = item.id;
          state.lastRunDir = item.id;
          requestRender();
          resolveSelection(item.id);
        },
        onCancel: () => {
          state.overlay = null;
          appendStatus(state, "run selection cancelled");
          requestRender();
          resolveSelection(null);
        }
      };
      requestRender();
    });
  };

  const showReceipt = async (runDirArg?: string): Promise<void> => {
    const runDir = await selectRunDir(runDirArg);
    if (!runDir) {
      return;
    }
    try {
      appendTranscript(state, "receipt", renderReceiptForRun(runDir));
    } catch (error) {
      appendError(state, `failed to render receipt: ${formatError(error)}`);
    }
    requestRender();
  };

  const showReport = async (runDirArg?: string): Promise<void> => {
    const runDir = await selectRunDir(runDirArg);
    if (!runDir) {
      return;
    }
    try {
      const report = formatReportText(buildReportModel(runDir, 3));
      appendTranscript(state, "report", report);
    } catch (error) {
      appendError(state, `failed to build report: ${formatError(error)}`);
    }
    requestRender();
  };

  const showVerify = async (runDirArg?: string): Promise<void> => {
    const runDir = await selectRunDir(runDirArg);
    if (!runDir) {
      return;
    }
    try {
      const verify = formatVerifyReport(verifyRunDir(runDir));
      appendTranscript(state, "verify", verify);
    } catch (error) {
      appendError(state, `failed to verify run: ${formatError(error)}`);
    }
    requestRender();
  };

  const analyzeRun = async (runDirArg?: string): Promise<void> => {
    const runDir = await selectRunDir(runDirArg);
    if (!runDir) {
      return;
    }
    appendStatus(state, `analyzing ${runDir}`);
    await showVerify(runDir);
    await showReport(runDir);
  };

  const showWarnings = async (): Promise<void> => {
    renderWarningsBlock(state);
    requestRender();
  };

  const intakeFlow = createIntakeFlowController({
    state,
    requestRender,
    appendSystem: (message) => appendSystem(state, message),
    appendStatus: (message) => appendStatus(state, message),
    appendError: (message) => appendError(state, message),
    appendWarning: (message) => appendTranscript(state, "warning", message),
    writeTemplateConfig: (profile: ProfileDefinition, question: string) => {
      writeTemplateConfigFile(assetRoot, profile.template, question, state.configPath);
    },
    startRun: async (mode) => runController.startRun(mode)
  });

  const commandContext: CommandContext = {
    state,
    appendSystem: (message) => {
      appendSystem(state, message);
      requestRender();
    },
    appendError: (message) => {
      appendError(state, message);
      requestRender();
    },
    appendStatus: (message) => {
      appendStatus(state, message);
      requestRender();
    },
    requestRender,
    exit: shutdown,
    startRun: async (mode) => {
      await runController.startRun(mode);
    },
    startNewFlow: intakeFlow.startNewFlow,
    showWarnings,
    showReport,
    showVerify,
    showReceipt,
    analyzeRun
  };

  const handleSubmit = async (value: string): Promise<void> => {
    const trimmed = value.trim();
    layout.editor.setText("");

    if (!trimmed) {
      requestRender();
      return;
    }

    appendTranscript(state, "user", trimmed);
    requestRender();

    const handled = await executeCommandInput({
      value: trimmed,
      context: commandContext
    });

    if (!handled) {
      intakeFlow.handlePlainInput(trimmed);
    }
  };

  appendSystem(state, "welcome to arbiter transcript runtime");
  appendSystem(state, "type /new to start a study, or /help for command reference");

  tui.addChild(layout.root);
  layout.sync(state);
  layout.focusInput();
  tui.start();

  await done;
};
