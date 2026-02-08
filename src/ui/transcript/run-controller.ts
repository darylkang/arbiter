import { existsSync } from "node:fs";

import { EventBus } from "../../events/event-bus.js";
import { runLiveService, runMockService } from "../../run/run-service.js";
import { createEventWarningSink } from "../../utils/warnings.js";
import { createUiRunLifecycleHooks } from "../run-lifecycle-hooks.js";
import { appendTranscript, appendWarningOnce, beginRun } from "./reducer.js";
import type { AppState, RunMode } from "./state.js";
import { attachRunEventHandler } from "./handlers/event-handler.js";
import { attachWarningHandler } from "./handlers/warning-handler.js";
import { renderReceiptForRun } from "./components/receipt-view.js";
import { formatError } from "./error-format.js";
import { listRunDirs, RUNS_DIR_NAME } from "./run-dirs.js";

export type RunController = {
  startRun: (mode: RunMode) => Promise<void>;
  interrupt: () => void;
  dispose: () => void;
};

type RunControllerDeps = {
  configExists: (path: string) => boolean;
  createBus: () => EventBus;
  createWarningSink: (bus: EventBus) => ReturnType<typeof createEventWarningSink>;
  createLifecycleHooks: () => ReturnType<typeof createUiRunLifecycleHooks>;
  runMock: typeof runMockService;
  runLive: typeof runLiveService;
  listRunsCount: () => number;
  renderReceipt: (runDir: string) => string;
  sendSignal: (pid: number, signal: NodeJS.Signals) => void;
};

const resolveRunDir = (value: unknown): string | null => {
  if (!value || typeof value !== "object" || !("runDir" in value)) {
    return null;
  }
  const runDir = Reflect.get(value, "runDir");
  return typeof runDir === "string" && runDir.trim().length > 0 ? runDir : null;
};

const listRunsCount = (): number => {
  return listRunDirs().length;
};

const defaultRunControllerDeps = (): RunControllerDeps => ({
  configExists: existsSync,
  createBus: () => new EventBus(),
  createWarningSink: (bus) => createEventWarningSink(bus),
  createLifecycleHooks: () => createUiRunLifecycleHooks(),
  runMock: runMockService,
  runLive: runLiveService,
  listRunsCount,
  renderReceipt: renderReceiptForRun,
  sendSignal: (pid, signal) => process.kill(pid, signal)
});

export const createRunController = (input: {
  assetRoot: string;
  state: AppState;
  requestRender: () => void;
}, deps?: Partial<RunControllerDeps>): RunController => {
  const resolvedDeps: RunControllerDeps = {
    ...defaultRunControllerDeps(),
    ...deps
  };

  let detachHandlers: (() => void) | null = null;
  let runPromise: Promise<void> | null = null;

  const interrupt = (): void => {
    if (input.state.phase !== "running") {
      return;
    }
    resolvedDeps.sendSignal(process.pid, "SIGINT");
  };

  const dispose = (): void => {
    detachHandlers?.();
    detachHandlers = null;
  };

  const startRun = async (mode: RunMode): Promise<void> => {
    if (runPromise) {
      appendTranscript(input.state, "status", "A run is already active.");
      input.requestRender();
      return;
    }

    if (!resolvedDeps.configExists(input.state.configPath)) {
      appendTranscript(
        input.state,
        "error",
        `Configuration not found at ${input.state.configPath}. Set up a new study first.`
      );
      input.requestRender();
      return;
    }

    if (mode === "live" && !process.env.OPENROUTER_API_KEY) {
      appendTranscript(
        input.state,
        "error",
        "OpenRouter API key not found. Live runs require OPENROUTER_API_KEY."
      );
      input.requestRender();
      return;
    }

    beginRun(input.state, mode);
    appendTranscript(input.state, "status", `Starting ${mode} run.`);
    input.requestRender();

    const bus = resolvedDeps.createBus();

    const runEventUnsub = attachRunEventHandler({
      bus,
      state: input.state,
      onUpdate: input.requestRender,
      onError: (error, eventType) => {
        appendWarningOnce(
          input.state,
          `event-${eventType}`,
          `event handler error for ${eventType}: ${formatError(error)}`,
          "transcript"
        );
        input.requestRender();
      }
    });

    const warningUnsub = attachWarningHandler({
      bus,
      state: input.state,
      onUpdate: input.requestRender,
      onError: (error) => {
        appendWarningOnce(
          input.state,
          "warning-handler",
          `warning handler error: ${formatError(error)}`,
          "transcript"
        );
        input.requestRender();
      }
    });

    detachHandlers = (): void => {
      runEventUnsub();
      warningUnsub();
    };

    const warningSink = resolvedDeps.createWarningSink(bus);
    const hooks = resolvedDeps.createLifecycleHooks();

    runPromise = (async () => {
      try {
        const common = {
          configPath: input.state.configPath,
          assetRoot: input.assetRoot,
          runsDir: RUNS_DIR_NAME,
          debug: false,
          quiet: false,
          bus,
          receiptMode: "writeOnly" as const,
          hooks,
          warningSink,
          forwardWarningEvents: false
        };

        const result =
          mode === "mock" ? await resolvedDeps.runMock(common) : await resolvedDeps.runLive(common);

        const runDir = resolveRunDir(result);
        if (runDir) {
          input.state.runDir = runDir;
          input.state.lastRunDir = runDir;
          input.state.runsCount = resolvedDeps.listRunsCount();
          appendTranscript(input.state, "status", `Artifacts written to ${runDir}.`);
          try {
            appendTranscript(input.state, "receipt", resolvedDeps.renderReceipt(runDir));
          } catch (error) {
            appendWarningOnce(
              input.state,
              "receipt-render",
              `failed to load receipt: ${formatError(error)}`,
              "receipt"
            );
          }
        }
      } catch (error) {
        appendTranscript(input.state, "error", `Run execution failed: ${formatError(error)}`);
        input.state.phase = "post-run";
      } finally {
        try {
          await bus.flush();
        } catch (error) {
          appendWarningOnce(
            input.state,
            "event-bus-flush",
            `event flush error: ${formatError(error)}`,
            "event-bus"
          );
        }
        detachHandlers?.();
        detachHandlers = null;
        runPromise = null;
        input.requestRender();
      }
    })();

    await runPromise;
  };

  return {
    startRun,
    interrupt,
    dispose
  };
};
