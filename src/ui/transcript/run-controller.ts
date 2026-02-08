import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

import { EventBus } from "../../events/event-bus.js";
import { runLiveService, runMockService } from "../../run/run-service.js";
import { createEventWarningSink } from "../../utils/warnings.js";
import { createUiRunLifecycleHooks } from "../run-lifecycle-hooks.js";
import { appendTranscript, appendWarningOnce, beginRun } from "./reducer.js";
import type { AppState, RunMode } from "./state.js";
import { attachRunEventHandler } from "./handlers/event-handler.js";
import { attachWarningHandler } from "./handlers/warning-handler.js";
import { renderReceiptForRun } from "./components/receipt-view.js";

export type RunController = {
  startRun: (mode: RunMode) => Promise<void>;
  interrupt: () => void;
  dispose: () => void;
};

const resolveRunDir = (value: unknown): string | null => {
  if (!value || typeof value !== "object") {
    return null;
  }
  const runDir = (value as { runDir?: unknown }).runDir;
  return typeof runDir === "string" && runDir.trim().length > 0 ? runDir : null;
};

const listRunsCount = (): number => {
  try {
    const entries = readdirSync(resolve(process.cwd(), "runs"), { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).length;
  } catch {
    return 0;
  }
};

export const createRunController = (input: {
  assetRoot: string;
  state: AppState;
  requestRender: () => void;
}): RunController => {
  let activeBus: EventBus | null = null;
  let detachHandlers: (() => void) | null = null;
  let runPromise: Promise<void> | null = null;

  const interrupt = (): void => {
    if (input.state.phase !== "running") {
      return;
    }
    process.kill(process.pid, "SIGINT");
  };

  const dispose = (): void => {
    detachHandlers?.();
    detachHandlers = null;
    activeBus = null;
  };

  const startRun = async (mode: RunMode): Promise<void> => {
    if (runPromise) {
      appendTranscript(input.state, "status", "a run is already active");
      input.requestRender();
      return;
    }

    if (!existsSync(input.state.configPath)) {
      appendTranscript(input.state, "error", "missing arbiter.config.json. run /new first");
      input.requestRender();
      return;
    }

    if (mode === "live" && !process.env.OPENROUTER_API_KEY) {
      appendTranscript(input.state, "error", "OPENROUTER_API_KEY missing. use /run mock or set the key");
      input.requestRender();
      return;
    }

    beginRun(input.state, mode);
    appendTranscript(input.state, "status", `starting ${mode} run...`);
    input.requestRender();

    const bus = new EventBus();
    activeBus = bus;

    const runEventUnsub = attachRunEventHandler({
      bus,
      state: input.state,
      onUpdate: input.requestRender,
      onError: (error, eventType) => {
        const message = error instanceof Error ? error.message : String(error);
        appendWarningOnce(
          input.state,
          `event-${eventType}`,
          `event handler error for ${eventType}: ${message}`,
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
        const message = error instanceof Error ? error.message : String(error);
        appendWarningOnce(
          input.state,
          "warning-handler",
          `warning handler error: ${message}`,
          "transcript"
        );
        input.requestRender();
      }
    });

    detachHandlers = (): void => {
      runEventUnsub();
      warningUnsub();
    };

    const warningSink = createEventWarningSink(bus);
    const hooks = createUiRunLifecycleHooks();

    runPromise = (async () => {
      try {
        const common = {
          configPath: input.state.configPath,
          assetRoot: input.assetRoot,
          runsDir: "runs",
          debug: false,
          quiet: false,
          bus,
          receiptMode: "writeOnly" as const,
          hooks,
          warningSink,
          forwardWarningEvents: false
        };

        const result =
          mode === "mock" ? await runMockService(common) : await runLiveService(common);

        const runDir = resolveRunDir(result);
        if (runDir) {
          input.state.runDir = runDir;
          input.state.lastRunDir = runDir;
          input.state.runsCount = listRunsCount();
          appendTranscript(input.state, "status", `artifacts written: ${runDir}`);
          try {
            appendTranscript(input.state, "receipt", renderReceiptForRun(runDir));
          } catch (error) {
            appendWarningOnce(
              input.state,
              "receipt-render",
              `failed to load receipt: ${error instanceof Error ? error.message : String(error)}`,
              "receipt"
            );
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        appendTranscript(input.state, "error", `run execution failed: ${message}`);
        input.state.phase = "post-run";
      } finally {
        try {
          await bus.flush();
        } catch (error) {
          appendWarningOnce(
            input.state,
            "event-bus-flush",
            `event flush error: ${error instanceof Error ? error.message : String(error)}`,
            "event-bus"
          );
        }
        detachHandlers?.();
        detachHandlers = null;
        activeBus = null;
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
