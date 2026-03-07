import type { EventBus } from "../events/event-bus.js";
import type { EventPayloadMap } from "../events/types.js";
import type { RunLifecycleContext, RunLifecycleHooks } from "../run/lifecycle-hooks.js";
import { UI_COPY } from "./copy.js";
import { createStdoutFormatter } from "./fmt.js";
import type { DashboardVM, ReceiptVM } from "./runtime-view-models.js";
import {
  applyDashboardEmbeddingRecorded,
  applyDashboardMonitoring,
  applyDashboardRunCompleted,
  applyDashboardRunFailed,
  applyDashboardRunStarted,
  applyDashboardTrialCompleted,
  applyDashboardTrialPlanned,
  applyDashboardWorkerStatus,
  buildDashboardViewModel,
  createDashboardState,
  shouldAnimateDashboard,
  tickDashboardState,
  type DashboardState
} from "./runtime/dashboard-vm.js";
import { buildDashboardTooSmallText, buildRunDashboardText } from "./runtime/dashboard-render.js";
import {
  computeLiveRegionLayout,
  countRenderedRows
} from "./runtime/live-region.js";
import {
  buildReceiptDisplayText,
  buildReceiptDisplayTextFromRunDir,
  buildReceiptViewModel,
  readReceiptText
} from "./runtime/receipt-render.js";
import { MIN_DASHBOARD_ROWS, getDashboardTerminalSupport } from "./tui-constraints.js";

const CURSOR_HIDE = "\x1b[?25l";
const CURSOR_SHOW = "\x1b[?25h";

const shouldRenderDashboard = (enabled: boolean): boolean =>
  enabled && Boolean(process.stdout.isTTY);

class RunDashboardMonitor {
  private readonly bus: EventBus;
  private readonly snapshot: DashboardState;
  private readonly unsubs: Array<() => void> = [];
  private readonly prefixText: string | null;
  private animationTimer: NodeJS.Timeout | null = null;
  private lastFrameRows = 0;
  private cursorHidden = false;

  constructor(context: RunLifecycleContext, modelDisplayBySlug?: Map<string, string>, prefixText?: string) {
    this.bus = context.bus;
    this.prefixText = prefixText?.trim().length ? prefixText.replace(/\n+$/, "") : null;
    this.snapshot = createDashboardState({
      runId: context.runId,
      mode: context.mode,
      modelDisplayBySlug,
      resolvedConfig: context.resolvedConfig
    });
  }

  attach(): void {
    this.hideCursor();
    this.unsubs.push(
      this.bus.subscribeSafe("run.started", (payload) => this.onRunStarted(payload)),
      this.bus.subscribeSafe("trial.planned", (payload) => this.onTrialPlanned(payload)),
      this.bus.subscribeSafe("trial.completed", (payload) => this.onTrialCompleted(payload)),
      this.bus.subscribeSafe("embedding.recorded", (payload) => this.onEmbeddingRecorded(payload)),
      this.bus.subscribeSafe("worker.status", (payload) => this.onWorkerStatus(payload)),
      this.bus.subscribeSafe("monitoring.record", (payload) => this.onMonitoring(payload)),
      this.bus.subscribeSafe("batch.completed", () => this.render()),
      this.bus.subscribeSafe("run.completed", (payload) => this.onRunCompleted(payload)),
      this.bus.subscribeSafe("run.failed", () => this.onRunFailed())
    );
    this.startAnimationLoop();
  }

  detach(): void {
    this.stopAnimationLoop();
    this.unsubs.splice(0).forEach((unsubscribe) => unsubscribe());
    this.clearLiveFrame();
    this.showCursor();
  }

  buildFinalSnapshot(columns = Math.max(1, process.stdout.columns ?? 80)): string {
    return buildRunDashboardText(buildDashboardViewModel(this.snapshot, Date.now()), {
      width: columns
    }).replace(/\n+$/, "");
  }

  private startAnimationLoop(): void {
    if (this.animationTimer) {
      return;
    }
    this.animationTimer = setInterval(() => {
      if (shouldAnimateDashboard(this.snapshot)) {
        this.render();
      }
    }, 120);
  }

  private stopAnimationLoop(): void {
    if (!this.animationTimer) {
      return;
    }
    clearInterval(this.animationTimer);
    this.animationTimer = null;
  }

  private hideCursor(): void {
    if (this.cursorHidden) {
      return;
    }
    process.stdout.write(CURSOR_HIDE);
    this.cursorHidden = true;
  }

  private showCursor(): void {
    if (!this.cursorHidden) {
      return;
    }
    process.stdout.write(CURSOR_SHOW);
    this.cursorHidden = false;
  }

  private clearLiveFrame(): void {
    if (this.lastFrameRows <= 0) {
      return;
    }
    process.stdout.write(`\x1b[${this.lastFrameRows}A`);
    process.stdout.write("\x1b[J");
    this.lastFrameRows = 0;
  }

  private onRunStarted(payload: EventPayloadMap["run.started"]): void {
    applyDashboardRunStarted(this.snapshot, payload);
    this.render();
  }

  private onTrialCompleted(payload: EventPayloadMap["trial.completed"]): void {
    applyDashboardTrialCompleted(this.snapshot, payload);
  }

  private onTrialPlanned(payload: EventPayloadMap["trial.planned"]): void {
    applyDashboardTrialPlanned(this.snapshot, payload);
  }

  private onEmbeddingRecorded(payload: EventPayloadMap["embedding.recorded"]): void {
    applyDashboardEmbeddingRecorded(this.snapshot, payload);
  }

  private onWorkerStatus(payload: EventPayloadMap["worker.status"]): void {
    applyDashboardWorkerStatus(this.snapshot, payload);
  }

  private onMonitoring(payload: EventPayloadMap["monitoring.record"]): void {
    applyDashboardMonitoring(this.snapshot, payload);
  }

  private onRunCompleted(payload: EventPayloadMap["run.completed"]): void {
    applyDashboardRunCompleted(this.snapshot, payload);
    this.render();
  }

  private onRunFailed(): void {
    applyDashboardRunFailed(this.snapshot);
    this.render();
  }

  private render(): void {
    tickDashboardState(this.snapshot);
    const terminalColumns = Math.max(1, process.stdout.columns ?? 80);
    const terminalRows = Math.max(2, process.stdout.rows ?? 24);
    const currentPrefixRows = this.prefixText ? countRenderedRows(this.prefixText, terminalColumns) : 0;
    const layout = computeLiveRegionLayout(terminalRows, currentPrefixRows, MIN_DASHBOARD_ROWS);
    const support = getDashboardTerminalSupport(process.stdout);
    const frameText = support.ok
      ? buildRunDashboardText(buildDashboardViewModel(this.snapshot, Date.now()), {
          width: terminalColumns,
          maxRows: layout.liveRows
        }).replace(/\n+$/, "")
      : buildDashboardTooSmallText(terminalColumns, createStdoutFormatter()).replace(/\n+$/, "");

    if (this.lastFrameRows > 0) {
      process.stdout.write(`\x1b[${this.lastFrameRows}A`);
    }
    process.stdout.write("\x1b[J");
    process.stdout.write(frameText);
    this.lastFrameRows = countRenderedRows(frameText, terminalColumns);
  }
}

export {
  buildDashboardViewModel,
  buildRunDashboardText,
  buildReceiptViewModel,
  buildReceiptDisplayText
};

export const createUiRunLifecycleHooks = (input?: {
  dashboard?: boolean;
  stackPrefixText?: string;
  modelDisplayBySlug?: Map<string, string>;
}): RunLifecycleHooks => {
  const dashboardEnabled = shouldRenderDashboard(Boolean(input?.dashboard));
  const stackPrefixText = input?.stackPrefixText?.replace(/\n+$/, "");
  let monitor: RunDashboardMonitor | null = null;
  let usePlainReceipt = false;
  let dashboardTooSmallWarned = false;

  const composeFinalTranscript = (parts: Array<string | null | undefined>): string => {
    const segments = parts
      .map((part) => part?.replace(/\n+$/, ""))
      .filter((part): part is string => Boolean(part && part.length > 0));
    if (segments.length === 0) {
      return "";
    }
    return `${segments.join("\n")}\n`;
  };

  return {
    onRunSetup: (context): void => {
      if (!dashboardEnabled) {
        return;
      }
      const terminalSupport = getDashboardTerminalSupport(process.stdout);
      if (!terminalSupport.ok) {
        usePlainReceipt = true;
        process.stdout.write(`${UI_COPY.dashboardTerminalTooSmall}\n`);
        dashboardTooSmallWarned = true;
        return;
      }
      usePlainReceipt = false;
      monitor = new RunDashboardMonitor(context, input?.modelDisplayBySlug, stackPrefixText);
      monitor.attach();
    },
    onRunFinally: async (context): Promise<void> => {
      const finalDashboardText = monitor?.buildFinalSnapshot(Math.max(1, process.stdout.columns ?? 80)) ?? null;
      if (monitor) {
        monitor.detach();
        monitor = null;
      }

      if ((!dashboardEnabled && !usePlainReceipt) || context.receiptMode === "skip") {
        return;
      }

      const receiptText = readReceiptText(context.runDir);
      if (usePlainReceipt) {
        const transcript = composeFinalTranscript([
          dashboardTooSmallWarned ? null : UI_COPY.dashboardTerminalTooSmall,
          receiptText
        ]);
        if (transcript.length > 0) {
          process.stdout.write(transcript);
          return;
        }
        if (receiptText) {
          process.stdout.write(receiptText);
          return;
        }
        context.warningSink.warn("receipt.txt missing after run completion", "receipt");
        return;
      }

      const receiptDisplayText = buildReceiptDisplayTextFromRunDir(context.runDir);
      if (receiptDisplayText) {
        process.stdout.write(composeFinalTranscript([finalDashboardText, receiptDisplayText]));
        return;
      }

      if (!receiptText) {
        context.warningSink.warn("receipt.txt missing after run completion", "receipt");
        return;
      }

      process.stdout.write(
        composeFinalTranscript([finalDashboardText, `${UI_COPY.receiptHeader}\n${receiptText}`])
      );
    }
  };
};
