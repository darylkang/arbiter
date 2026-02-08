import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { ProcessTerminal, TUI } from "@mariozechner/pi-tui";

import { buildReportModel, formatReportText } from "../../tools/report-run.js";
import { formatVerifyReport, verifyRunDir } from "../../tools/verify-run.js";
import { getAssetRoot } from "../../utils/asset-root.js";
import { appendTranscript } from "./reducer.js";
import { createRunController } from "./run-controller.js";
import type { AppState, OverlayItem, OverlayState, ProfileId, RunMode } from "./state.js";
import { createInitialState } from "./state.js";
import { createTranscriptLayout } from "./layout.js";
import { createOverlayComponent } from "./components/overlay.js";
import { executeCommandInput } from "./commands/registry.js";
import type { CommandContext } from "./commands/types.js";
import { renderReceiptForRun } from "./components/receipt-view.js";

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
  } catch {
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
    tui.showOverlay(component, {
      width: "74%",
      maxHeight: "65%",
      anchor: "center"
    });
    tui.setFocus(component);
  };

  const withRunDir = (
    runDirArg: string | undefined,
    onResolved: (runDir: string) => void
  ): void => {
    const resolvedRunDir = resolveRunDirArg(state, runDirArg);
    if (resolvedRunDir) {
      state.runDir = resolvedRunDir;
      state.lastRunDir = resolvedRunDir;
      onResolved(resolvedRunDir);
      requestRender();
      return;
    }

    const runDirs = listRunDirs();
    if (runDirs.length === 0) {
      appendError(state, "no run directories found in ./runs");
      requestRender();
      return;
    }

    const items = runDirs.map((runDir) => ({
      id: runDir,
      label: runDir.replace(`${resolve(process.cwd(), "runs")}/`, ""),
      description: runDir
    }));

    state.overlay = {
      kind: "select",
      title: "select run directory",
      items,
      selectedIndex: 0,
      onSelect: (item) => {
        state.overlay = null;
        state.runDir = item.id;
        state.lastRunDir = item.id;
        onResolved(item.id);
        requestRender();
      },
      onCancel: () => {
        state.overlay = null;
        appendStatus(state, "run selection cancelled");
        requestRender();
      }
    };
    requestRender();
  };

  const showReceipt = (runDirArg?: string): void => {
    withRunDir(runDirArg, (runDir) => {
      try {
        appendTranscript(state, "receipt", renderReceiptForRun(runDir));
      } catch (error) {
        appendError(state, `failed to render receipt: ${error instanceof Error ? error.message : String(error)}`);
      }
    });
  };

  const showReport = (runDirArg?: string): void => {
    withRunDir(runDirArg, (runDir) => {
      try {
        const report = formatReportText(buildReportModel(runDir, 3));
        appendTranscript(state, "report", report);
      } catch (error) {
        appendError(state, `failed to build report: ${error instanceof Error ? error.message : String(error)}`);
      }
    });
  };

  const showVerify = (runDirArg?: string): void => {
    withRunDir(runDirArg, (runDir) => {
      try {
        const verify = formatVerifyReport(verifyRunDir(runDir));
        appendTranscript(state, "verify", verify);
      } catch (error) {
        appendError(state, `failed to verify run: ${error instanceof Error ? error.message : String(error)}`);
      }
    });
  };

  const analyzeRun = (runDirArg?: string): void => {
    withRunDir(runDirArg, (runDir) => {
      appendStatus(state, `analyzing ${runDir}`);
      showVerify(runDir);
      showReport(runDir);
    });
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
      appendError(state, `failed to write config: ${error instanceof Error ? error.message : String(error)}`);
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

    if (value.trim().toLowerCase() === "w") {
      state.warningsExpanded = !state.warningsExpanded;
      renderWarningsBlock(state);
      requestRender();
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
