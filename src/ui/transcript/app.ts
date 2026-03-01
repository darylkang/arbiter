import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  CombinedAutocompleteProvider,
  ProcessTerminal,
  TUI,
  type SlashCommand
} from "@mariozechner/pi-tui";

import { buildReportModel, formatReportText } from "../../tools/report-run.js";
import { formatVerifyReport, verifyRunDir } from "../../tools/verify-run.js";
import { getAssetRoot } from "../../utils/asset-root.js";
import { appendStageBlock, appendTranscript } from "./reducer.js";
import { createRunController } from "./run-controller.js";
import type { AppState, RunMode } from "./state.js";
import { createInitialState } from "./state.js";
import { createTranscriptLayout } from "./layout.js";
import { executeCommandInput, listSlashCommands } from "./commands/registry.js";
import type { CommandContext } from "./commands/types.js";
import { renderReceiptForRun } from "./components/receipt-view.js";
import { formatError } from "./error-format.js";
import { listRunDirs, resolveRunDirArg, toRunDirLabel } from "./run-dirs.js";
import { createIntakeFlowController } from "./intake-flow.js";
import { withSpinner } from "./spinner.js";
import { loadWizardOptions } from "./wizard-options.js";
import { writeGuidedConfig } from "./wizard-config.js";
import { listConfigCandidates, type ConfigCandidate } from "./config-discovery.js";
import { compactPath } from "./path-display.js";

const DEFAULT_CONFIG_PATH = "arbiter.config.json";

type LaunchAction =
  | { type: "quickstart"; mode: RunMode; configPath: string; sourceMode: RunMode | null }
  | { type: "guided-setup"; mode: RunMode }
  | { type: "quit" };
type StartPathAction = "quickstart" | "guided-setup" | "quit";
type QuickstartAction = "start" | "back" | "quit";
type PostRunAction = "report" | "verify" | "open-folder" | "new-study" | "quit";

const readPackageVersion = (assetRoot: string): string => {
  try {
    const pkg = JSON.parse(readFileSync(resolve(assetRoot, "package.json"), "utf8")) as {
      version?: string;
    };
    return pkg.version?.trim() || "0.0.0";
  } catch {
    return "0.0.0";
  }
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

const isStartPathAction = (value: string): value is StartPathAction =>
  value === "quickstart" || value === "guided-setup" || value === "quit";

const isQuickstartAction = (value: string): value is QuickstartAction => {
  return value === "start" || value === "back" || value === "quit";
};

const isPostRunAction = (value: string): value is PostRunAction => {
  return (
    value === "report" ||
    value === "verify" ||
    value === "open-folder" ||
    value === "new-study" ||
    value === "quit"
  );
};

const readConfigMode = (configPath: string): RunMode | null => {
  try {
    const parsed = JSON.parse(readFileSync(configPath, "utf8")) as {
      mode?: unknown;
      run?: { mode?: unknown };
    };
    if (parsed.run?.mode === "mock" || parsed.run?.mode === "live") {
      return parsed.run.mode;
    }
    if (parsed.mode === "mock" || parsed.mode === "live") {
      return parsed.mode;
    }
  } catch {
    // Ignore parse errors here; config discovery handles validity.
  }
  return null;
};

const readConfigQuestion = (configPath: string): string => {
  try {
    const parsed = JSON.parse(readFileSync(configPath, "utf8")) as {
      question?: { text?: unknown };
    };
    const text = parsed.question?.text;
    return typeof text === "string" ? text.trim() : "";
  } catch {
    return "";
  }
};

const runIdFromRunDir = (runDir: string): string | null => {
  const trimmed = runDir.trim();
  if (!trimmed) {
    return null;
  }
  const parts = trimmed.split(/[\\/]/).filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : null;
};

export const launchTranscriptTUI = async (options?: { assetRoot?: string }): Promise<void> => {
  const assetRoot = options?.assetRoot ?? getAssetRoot();
  const startupWarnings: string[] = [];
  const wizardOptions = loadWizardOptions(assetRoot);
  const defaultConfigPath = resolve(process.cwd(), DEFAULT_CONFIG_PATH);
  const initialConfigCandidates = listConfigCandidates({
    onError: (message) => startupWarnings.push(message)
  });
  const initialRunDirs = listRunDirs({
    onError: (message) => startupWarnings.push(message)
  });
  const state = createInitialState({
    version: readPackageVersion(assetRoot),
    configPath: defaultConfigPath,
    defaultConfigPath,
    hasApiKey: Boolean(process.env.OPENROUTER_API_KEY),
    hasConfig: initialConfigCandidates.length > 0,
    configCount: initialConfigCandidates.length,
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

  let renderScheduled = false;

  const requestRender = (): void => {
    if (renderScheduled) {
      return;
    }
    renderScheduled = true;
    setImmediate(() => {
      renderScheduled = false;
      layout.sync(state);
      layout.focusInput();
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

  const refreshConfigCandidates = (): ConfigCandidate[] => {
    const candidates = listConfigCandidates({
      onError: (message) => appendTranscript(state, "warning", message)
    });
    state.hasConfig = candidates.length > 0;
    state.configCount = candidates.length;
    return candidates;
  };

  const selectRunMode = async (): Promise<RunMode | "quit" | null> =>
    new Promise((resolveSelection) => {
      state.overlay = {
        kind: "select",
        title: "Select run mode",
        items: [
          {
            id: "live",
            label: "Live run",
            description: state.hasApiKey
              ? "Use OPENROUTER_API_KEY and real model calls."
              : "Requires OPENROUTER_API_KEY",
            disabled: !state.hasApiKey
          },
          {
            id: "mock",
            label: "Mock run",
            description: "No external API calls."
          },
          { id: "quit", label: "Quit" }
        ],
        selectedIndex: state.hasApiKey ? 0 : 1,
        onSelect: (item) => {
          if (item.disabled) {
            return;
          }
          if (item.id !== "live" && item.id !== "mock" && item.id !== "quit") {
            appendError(state, `Invalid mode action: ${item.id}.`);
            requestRender();
            return;
          }
          state.overlay = null;
          requestRender();
          resolveSelection(item.id);
        },
        onCancel: () => {
          resolveSelection(null);
        }
      };
      requestRender();
    });

  const selectConfigCandidate = async (candidates: ConfigCandidate[]): Promise<ConfigCandidate | null> =>
    new Promise((resolveSelection) => {
      const items = candidates.map((candidate) => ({
        id: candidate.path,
        label: candidate.name,
        description: candidate.valid
          ? (candidate.isDefault ? "Default configuration file." : "Configuration file.")
          : candidate.disabledReason ?? "Invalid configuration file.",
        disabled: !candidate.valid
      }));

      state.overlay = {
        kind: "select",
        title: "Select configuration file",
        items,
        selectedIndex: Math.max(0, items.findIndex((item) => !item.disabled)),
        onSelect: (item) => {
          if (item.disabled) {
            return;
          }
          const match = candidates.find((candidate) => candidate.path === item.id) ?? null;
          state.overlay = null;
          requestRender();
          resolveSelection(match);
        },
        onCancel: () => {
          state.overlay = null;
          requestRender();
          resolveSelection(null);
        }
      };
      requestRender();
    });

  const selectStartPath = async (mode: RunMode, candidates: ConfigCandidate[]): Promise<LaunchAction | null> =>
    new Promise((resolveSelection) => {
      const validCandidates = candidates.filter((candidate) => candidate.valid);
      const quickstartDisabled = validCandidates.length === 0;

      state.overlay = {
        kind: "select",
        title: "Select start path",
        items: [
          {
            id: "quickstart",
            label: "Quick Start",
            description: quickstartDisabled
              ? "Requires a valid configuration file in the working directory."
              : validCandidates.length === 1
                ? `Use ${validCandidates[0].name}.`
                : `Choose from ${validCandidates.length} detected configuration files.`,
            disabled: quickstartDisabled
          },
          {
            id: "guided-setup",
            label: "Setup Wizard",
            description: "Create a new configuration step by step."
          },
          { id: "quit", label: "Quit" }
        ],
        selectedIndex: quickstartDisabled ? 1 : 0,
        onSelect: (item) => {
          if (item.disabled) {
            return;
          }
          if (!isStartPathAction(item.id)) {
            appendError(state, `Invalid start path action: ${item.id}.`);
            requestRender();
            return;
          }

          if (item.id === "quit") {
            state.overlay = null;
            requestRender();
            resolveSelection({ type: "quit" });
            return;
          }

          if (item.id === "guided-setup") {
            state.overlay = null;
            requestRender();
            resolveSelection({ type: "guided-setup", mode });
            return;
          }

          void (async () => {
            let selected: ConfigCandidate | null = null;
            if (candidates.length > 1) {
              selected = await selectConfigCandidate(candidates);
            } else {
              selected = validCandidates[0] ?? null;
            }

            if (!selected) {
              resolveSelection(null);
              return;
            }

            state.overlay = null;
            requestRender();
            resolveSelection({
              type: "quickstart",
              mode,
              configPath: selected.path,
              sourceMode: readConfigMode(selected.path)
            });
          })();
        },
        onCancel: () => {
          state.overlay = null;
          requestRender();
          resolveSelection(null);
        }
      };
      requestRender();
    });

  const selectLaunchAction = async (): Promise<LaunchAction | null> => {
    const candidates = refreshConfigCandidates();
    const selectedMode = await selectRunMode();
    if (!selectedMode) {
      return null;
    }
    if (selectedMode === "quit") {
      return { type: "quit" };
    }

    return await selectStartPath(selectedMode, candidates);
  };

  const reviewQuickstart = async (inputReview: {
    mode: RunMode;
    configPath: string;
    sourceMode: RunMode | null;
  }): Promise<QuickstartAction> =>
    new Promise((resolveSelection) => {
      const sourceModeLabel = inputReview.sourceMode ?? "not specified";
      const overrideLabel =
        inputReview.sourceMode && inputReview.sourceMode !== inputReview.mode
          ? "Launch mode overrides configuration mode for this run."
          : undefined;
      const bodyLines = [
        `Config: ${compactPath(inputReview.configPath)}`,
        `Source config mode: ${sourceModeLabel}`,
        `Effective run mode: ${inputReview.mode}`,
        ...(overrideLabel ? [overrideLabel] : [])
      ];

      state.overlay = {
        kind: "select",
        title: "Review run setup",
        body: bodyLines.join("\n"),
        items: [
          {
            id: "start",
            label: "Start run",
            description: `Run current configuration in ${inputReview.mode} mode`
          },
          { id: "back", label: "Back" },
          { id: "quit", label: "Quit" }
        ],
        selectedIndex: 0,
        onSelect: (item) => {
          if (!isQuickstartAction(item.id)) {
            appendError(state, `Invalid action: ${item.id}.`);
            requestRender();
            return;
          }
          state.overlay = null;
          requestRender();
          resolveSelection(item.id);
        },
        onCancel: () => {
          state.overlay = null;
          requestRender();
          resolveSelection("back");
        }
      };
      requestRender();
    });

  const selectPostRunAction = async (): Promise<PostRunAction | null> => {
    const runId = runIdFromRunDir(state.runDir);
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
              id: "open-folder",
              label: "Open run folder",
              description: "Show the run directory path"
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
        title: "Choose the next action",
        body:
          runId && state.runDir.trim().length > 0
            ? `Run ID: ${runId}\nRun directory: ${compactPath(state.runDir)}`
            : undefined,
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
        work: async () => formatReportText(buildReportModel(runDir))
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
    appendStatus(state, `Analyzing ${compactPath(runDir)}.`);
    await showVerify(runDir);
    await showReport(runDir);
  };

  const showWarnings = async (): Promise<void> => {
    renderWarningsBlock(state);
    requestRender();
  };

  const showRunFolderPath = async (): Promise<void> => {
    if (!state.runDir.trim()) {
      return;
    }

    await new Promise<void>((resolveSelection) => {
      state.overlay = {
        kind: "select",
        title: "Run folder",
        body: state.runDir,
        items: [{ id: "back", label: "Back" }],
        selectedIndex: 0,
        onSelect: () => {
          state.overlay = null;
          requestRender();
          resolveSelection();
        },
        onCancel: () => {
          state.overlay = null;
          requestRender();
          resolveSelection();
        }
      };
      requestRender();
    });
  };

  const showPostRunActions = async (): Promise<void> => {
    if (state.phase !== "post-run") {
      return;
    }

    let doneActions = false;
    while (!doneActions && state.phase === "post-run") {
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
          intakeFlow.startNewFlow("mock");
          doneActions = true;
          break;
        case "open-folder":
          await showRunFolderPath();
          break;
        case "quit":
          shutdown();
          doneActions = true;
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
    wizardOptions,
    requestRender,
    appendSystem: (message) => appendSystem(state, message),
    appendStatus: (message) => appendStatus(state, message),
    appendError: (message) => appendError(state, message),
    appendStageBlock: (title, lines) => appendStageBlock(state, "intake", title, lines),
    writeGuidedConfig: (flow) => {
      writeGuidedConfig({
        outputPath: state.configPath,
        assetRoot,
        flow
      });
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
    startNewFlow: () => intakeFlow.startNewFlow("mock"),
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

  void (async () => {
    let choosing = true;
    while (choosing) {
      const action = await selectLaunchAction();
      if (!action) {
        continue;
      }

      switch (action.type) {
        case "guided-setup":
          intakeFlow.startNewFlow(action.mode);
          choosing = false;
          break;

        case "quickstart": {
          state.configPath = action.configPath;
          state.hasConfig = true;
          state.question = readConfigQuestion(action.configPath);
          const review = await reviewQuickstart({
            mode: action.mode,
            configPath: action.configPath,
            sourceMode: action.sourceMode
          });
          if (review === "start") {
            appendStageBlock(state, "intake", "Intake summary", [
              "Start path: quick start",
              `Configuration: ${compactPath(action.configPath)}`,
              `Source mode: ${action.sourceMode ?? "not specified"}`,
              `Run mode: ${action.mode}`
            ]);
            if (action.sourceMode && action.sourceMode !== action.mode) {
              appendStatus(
                state,
                `Mode override applied for this run: config=${action.sourceMode}, launch=${action.mode}.`
              );
            }
            await startRun(action.mode);
            choosing = false;
          } else if (review === "quit") {
            shutdown();
            choosing = false;
          }
          break;
        }

        case "quit":
          shutdown();
          choosing = false;
          break;
      }
    }
  })();

  await done;
};
