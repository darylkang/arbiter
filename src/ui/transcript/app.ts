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
import type { AppState, OverlayState, RunMode } from "./state.js";
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
import { withSpinner } from "./spinner.js";

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
    appendStatus(state, "Warnings: none.");
    return;
  }

  appendStatus(state, `Warnings (${state.warnings.length}):`);
  state.warnings.forEach((warning) => {
    appendTranscript(
      state,
      "warning",
      `${warning.source ? `[${warning.source}] ` : ""}${warning.message}`,
      warning.recorded_at
    );
  });
};

type LaunchAction = "run-current" | "new-study" | "quit";
type PostRunAction = "report" | "verify" | "new-study" | "quit";

const isLaunchAction = (value: string): value is LaunchAction =>
  value === "run-current" || value === "new-study" || value === "quit";

const isPostRunAction = (value: string): value is PostRunAction =>
  value === "report" || value === "verify" || value === "new-study" || value === "quit";

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
  let renderScheduled = false;

  const requestRender = (): void => {
    if (renderScheduled) {
      return;
    }
    renderScheduled = true;
    setImmediate(() => {
      renderScheduled = false;
      layout.sync(state);
      syncOverlay();
      tui.requestRender();
    });
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
        state.overlay.onCancel();
        requestRender();
        return;
      }

      if (intakeFlow.handleEscape()) {
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
          "Interrupt requested. Waiting for in-flight trials to finish."
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

    if (overlayState === state.overlay && tui.hasOverlay()) {
      return;
    }

    if (tui.hasOverlay()) {
      tui.hideOverlay();
    }

    const overlayComponent = createOverlayComponent(state.overlay, () => {
      requestRender();
    });
    overlayState = state.overlay;
    tui.showOverlay(overlayComponent.component, resolveOverlayOptions());
    tui.setFocus(overlayComponent.focusTarget);
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
      appendError(state, "No run directories found in ./runs.");
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
        title: "Select run directory",
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
          appendStatus(state, "Run selection cancelled.");
          requestRender();
          resolveSelection(null);
        }
      };
      requestRender();
    });
  };

  const selectLaunchAction = async (): Promise<LaunchAction | null> =>
    new Promise((resolveSelection) => {
      state.overlay = {
        kind: "select",
        title: "Choose how to continue",
        items: [
          {
            id: "run-current",
            label: "Run with current configuration",
            description: "Start a mock run with the existing config"
          },
          {
            id: "new-study",
            label: "Set up a new study",
            description: "Create a new configuration through guided setup"
          },
          {
            id: "quit",
            label: "Quit"
          }
        ],
        selectedIndex: 0,
        onSelect: (item) => {
          if (!isLaunchAction(item.id)) {
            appendError(state, `Invalid launch action: ${item.id}.`);
            requestRender();
            return;
          }
          state.overlay = null;
          requestRender();
          resolveSelection(item.id);
        },
        onCancel: () => {
          appendStatus(state, "Choose an option to continue.");
          requestRender();
        }
      };
      requestRender();
    });

  const selectPostRunAction = async (): Promise<PostRunAction | null> => {
    const items =
      state.runDir.trim().length > 0
        ? [
            {
              id: "report",
              label: "View report",
              description: "Open a concise run report"
            },
            {
              id: "verify",
              label: "Verify run",
              description: "Validate run artifacts and invariants"
            },
            {
              id: "new-study",
              label: "Start new study",
              description: "Begin guided setup for another run"
            },
            { id: "quit", label: "Quit" }
          ]
        : [
            {
              id: "new-study",
              label: "Start new study",
              description: "Begin guided setup for another run"
            },
            { id: "quit", label: "Quit" }
          ];

    return new Promise((resolveSelection) => {
      state.overlay = {
        kind: "select",
        title: "Choose next action",
        items,
        selectedIndex: 0,
        onSelect: (item) => {
          if (!isPostRunAction(item.id)) {
            appendError(state, `Invalid post-run action: ${item.id}.`);
            requestRender();
            return;
          }
          state.overlay = null;
          requestRender();
          resolveSelection(item.id);
        },
        onCancel: () => {
          appendStatus(state, "Choose the next action to continue.");
          requestRender();
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
      const receipt = await withSpinner({
        tui,
        label: "Loading receipt...",
        work: async () => renderReceiptForRun(runDir)
      });
      appendTranscript(state, "receipt", receipt);
    } catch (error) {
      appendError(state, `Failed to render receipt: ${formatError(error)}`);
    }
    requestRender();
  };

  const showReport = async (runDirArg?: string): Promise<void> => {
    const runDir = await selectRunDir(runDirArg);
    if (!runDir) {
      return;
    }
    try {
      const report = await withSpinner({
        tui,
        label: "Generating report...",
        work: async () => formatReportText(buildReportModel(runDir, 3))
      });
      appendTranscript(state, "report", report);
    } catch (error) {
      appendError(state, `Failed to build report: ${formatError(error)}`);
    }
    requestRender();
  };

  const showVerify = async (runDirArg?: string): Promise<void> => {
    const runDir = await selectRunDir(runDirArg);
    if (!runDir) {
      return;
    }
    try {
      const verify = await withSpinner({
        tui,
        label: "Verifying run...",
        work: async () => formatVerifyReport(verifyRunDir(runDir))
      });
      appendTranscript(state, "verify", verify);
    } catch (error) {
      appendError(state, `Failed to verify run: ${formatError(error)}`);
    }
    requestRender();
  };

  const analyzeRun = async (runDirArg?: string): Promise<void> => {
    const runDir = await selectRunDir(runDirArg);
    if (!runDir) {
      return;
    }
    appendStatus(state, `Analyzing ${runDir}.`);
    await showVerify(runDir);
    await showReport(runDir);
  };

  const showWarnings = async (): Promise<void> => {
    renderWarningsBlock(state);
    requestRender();
  };

  const showPostRunActions = async (): Promise<void> => {
    if (state.phase !== "post-run") {
      return;
    }

    let done = false;
    while (!done && state.phase === "post-run") {
      const action = await selectPostRunAction();
      if (!action) {
        continue;
      }

      switch (action) {
        case "report":
          await showReport(state.runDir || undefined);
          break;
        case "verify":
          await showVerify(state.runDir || undefined);
          break;
        case "new-study":
          intakeFlow.startNewFlow();
          done = true;
          break;
        case "quit":
          shutdown();
          done = true;
          break;
        default:
          break;
      }
    }
  };

  const startRun = async (mode: RunMode): Promise<void> => {
    await runController.startRun(mode);
    if (state.phase === "post-run") {
      await showPostRunActions();
    }
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
    startRun,
    setInputText: (value) => {
      layout.editor.setText(value);
    }
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
    startRun,
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

  appendSystem(state, "Welcome to Arbiter.");

  tui.addChild(layout.root);
  layout.sync(state);
  layout.focusInput();
  tui.start();

  if (state.hasConfig) {
    void (async () => {
      const action = await selectLaunchAction();
      if (!action) {
        return;
      }

      switch (action) {
        case "run-current":
          await startRun("mock");
          break;
        case "new-study":
          intakeFlow.startNewFlow();
          break;
        case "quit":
          shutdown();
          break;
        default:
          break;
      }
    })();
  } else {
    intakeFlow.startNewFlow();
  }

  await done;
};
