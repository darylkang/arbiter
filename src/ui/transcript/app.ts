import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
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
import type { AppState, OverlayItem, OverlayState, ProfileId, RunMode } from "./state.js";
import { createInitialState } from "./state.js";
import { createTranscriptLayout } from "./layout.js";
import { createOverlayComponent } from "./components/overlay.js";
import { executeCommandInput, listSlashCommands } from "./commands/registry.js";
import type { CommandContext } from "./commands/types.js";
import { renderReceiptForRun } from "./components/receipt-view.js";
import { formatError } from "./error-format.js";

const DEFAULT_CONFIG_PATH = "arbiter.config.json";

type ProfileDefinition = {
  id: ProfileId;
  template: string;
  label: string;
  description: string;
  warning?: string;
};

const PROFILES: ProfileDefinition[] = [
  {
    id: "quickstart",
    template: "quickstart_independent",
    label: "quickstart",
    description: "single-model baseline with advisor stopping"
  },
  {
    id: "heterogeneity",
    template: "heterogeneity_mix",
    label: "heterogeneity",
    description: "multi-model and multi-persona profile"
  },
  {
    id: "debate",
    template: "debate_v1",
    label: "debate",
    description: "proposer-critic-revision protocol"
  },
  {
    id: "free",
    template: "free_quickstart",
    label: "free",
    description: "free-tier onboarding profile",
    warning:
      "free-tier models are useful for prototyping; use pinned paid models for research-grade studies"
  }
];

const listRunDirs = (): string[] => {
  try {
    const runRoot = resolve(process.cwd(), "runs");
    const entries = readdirSync(runRoot, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => resolve(runRoot, entry.name))
      .sort()
      .reverse();
  } catch (error) {
    const maybeCode = (error as { code?: unknown }).code;
    if (maybeCode !== "ENOENT") {
      console.warn(`[arbiter:tui] failed to list run directories: ${formatError(error)}`);
    }
    return [];
  }
};

const isDirectoryPath = (path: string): boolean => {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
};

const resolveRunDirArg = (state: AppState, runDirArg?: string): string | null => {
  if (runDirArg && runDirArg.trim().length > 0) {
    const candidate = runDirArg.trim();
    const absolute = resolve(process.cwd(), candidate);
    if (isDirectoryPath(absolute)) {
      return absolute;
    }
    const underRuns = resolve(process.cwd(), "runs", candidate);
    if (isDirectoryPath(underRuns)) {
      return underRuns;
    }
    return null;
  }

  if (state.lastRunDir && isDirectoryPath(state.lastRunDir)) {
    return state.lastRunDir;
  }

  const all = listRunDirs();
  return all.length > 0 ? all[0] : null;
};

const writeTemplateConfig = (
  assetRoot: string,
  profile: ProfileDefinition,
  question: string,
  targetPath: string
): void => {
  const templatePath = resolve(assetRoot, "templates", `${profile.template}.config.json`);
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

  const recent = state.warnings.slice(-5);
  appendStatus(state, `warnings (${state.warnings.length}):`);
  recent.forEach((warning) => {
    appendTranscript(
      state,
      "warning",
      `${warning.source ? `[${warning.source}] ` : ""}${warning.message}`,
      warning.recorded_at
    );
  });
};

const createProfileItems = (): OverlayItem[] =>
  PROFILES.map((profile) => ({
    id: profile.id,
    label: profile.label,
    description: profile.description
  }));

export const launchTranscriptTUI = async (options?: { assetRoot?: string }): Promise<void> => {
  const assetRoot = options?.assetRoot ?? getAssetRoot();
  const state = createInitialState({
    configPath: resolve(process.cwd(), DEFAULT_CONFIG_PATH),
    hasApiKey: Boolean(process.env.OPENROUTER_API_KEY),
    hasConfig: existsSync(resolve(process.cwd(), DEFAULT_CONFIG_PATH)),
    runsCount: listRunDirs().length
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

  const selectRunDir = async (runDirArg?: string): Promise<string | null> => {
    const resolvedRunDir = resolveRunDirArg(state, runDirArg);
    if (resolvedRunDir) {
      state.runDir = resolvedRunDir;
      state.lastRunDir = resolvedRunDir;
      requestRender();
      return resolvedRunDir;
    }

    const runDirs = listRunDirs();
    if (runDirs.length === 0) {
      appendError(state, "no run directories found in ./runs");
      requestRender();
      return null;
    }

    const items = runDirs.map((runDir) => ({
      id: runDir,
      label: runDir.replace(`${resolve(process.cwd(), "runs")}/`, ""),
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

  const finalizeIntake = (inputProfileId: ProfileId, runMode: RunMode | "none"): void => {
    const flow = state.newFlow;
    const question = flow?.question?.trim();
    if (!question) {
      appendError(state, "missing question text in intake flow");
      state.newFlow = null;
      state.phase = "idle";
      requestRender();
      return;
    }

    const profile = PROFILES.find((entry) => entry.id === inputProfileId);
    if (!profile) {
      appendError(state, `unknown profile id: ${inputProfileId}`);
      state.newFlow = null;
      state.phase = "idle";
      requestRender();
      return;
    }

    try {
      writeTemplateConfig(assetRoot, profile, question, state.configPath);
      state.hasConfig = true;
      state.question = question;
      state.profileId = profile.id;
      state.newFlow = null;
      state.phase = "idle";
      appendStatus(state, `config written: ${state.configPath}`);
      appendStatus(state, `profile: ${profile.label} | question: ${question}`);
      if (profile.warning) {
        appendTranscript(state, "warning", profile.warning);
      }
      requestRender();

      if (runMode === "live" && !state.hasApiKey) {
        appendError(state, "OPENROUTER_API_KEY is missing; run /run mock or set the key");
        requestRender();
        return;
      }

      if (runMode === "mock" || runMode === "live") {
        void runController.startRun(runMode);
      }
    } catch (error) {
      appendError(state, `failed to write config: ${formatError(error)}`);
      state.newFlow = null;
      state.phase = "idle";
      requestRender();
    }
  };

  const openModeOverlay = (profileId: ProfileId): void => {
    state.overlay = {
      kind: "select",
      title: "select run mode",
      items: [
        { id: "mock", label: "run mock now", description: "no external api calls" },
        {
          id: "live",
          label: "run live now",
          description: "uses OPENROUTER_API_KEY and real model calls"
        },
        { id: "none", label: "save only", description: "write config and return to transcript" }
      ],
      selectedIndex: 0,
      onSelect: (item) => {
        state.overlay = null;
        finalizeIntake(profileId, item.id as RunMode | "none");
      },
      onCancel: () => {
        state.overlay = null;
        state.newFlow = null;
        state.phase = "idle";
        appendStatus(state, "intake cancelled");
        requestRender();
      }
    };
    requestRender();
  };

  const openProfileOverlay = (): void => {
    state.overlay = {
      kind: "select",
      title: "select profile",
      items: createProfileItems(),
      selectedIndex: 0,
      onSelect: (item) => {
        state.overlay = null;
        const profileId = item.id as ProfileId;
        state.profileId = profileId;
        if (state.newFlow) {
          state.newFlow.profileId = profileId;
          state.newFlow.stage = "select_mode";
        }
        openModeOverlay(profileId);
      },
      onCancel: () => {
        state.overlay = null;
        state.newFlow = null;
        state.phase = "idle";
        appendStatus(state, "intake cancelled");
        requestRender();
      }
    };
    requestRender();
  };

  const startNewFlow = (): void => {
    if (state.phase === "running") {
      appendStatus(state, "run in progress. wait for completion before /new");
      requestRender();
      return;
    }

    state.phase = "intake";
    state.newFlow = { stage: "await_question" };
    appendSystem(state, "new study intake started. enter your research question, then press enter");
    requestRender();
  };

  const handlePlainInput = (value: string): void => {
    if (state.newFlow?.stage === "await_question") {
      state.newFlow.question = value;
      state.newFlow.stage = "select_profile";
      state.question = value;
      appendStatus(state, "question recorded. choose a profile");
      openProfileOverlay();
      return;
    }

    appendStatus(state, "input noted. use slash commands (try /help)");
    requestRender();
  };

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
    startNewFlow,
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
      handlePlainInput(trimmed);
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
