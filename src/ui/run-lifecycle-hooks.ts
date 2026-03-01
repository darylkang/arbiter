import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { EventBus } from "../events/event-bus.js";
import type { EventPayloadMap } from "../events/types.js";
import type { RunLifecycleContext, RunLifecycleHooks } from "../run/lifecycle-hooks.js";

type DashboardSnapshot = {
  runId: string;
  question: string;
  mode: "mock" | "live";
  protocol: string;
  planned: number;
  attempted: number;
  eligible: number;
  workers: number;
  startedAtMs: number;
  usage: {
    prompt: number;
    completion: number;
    total: number;
    cost?: number;
  };
  workerStatus: Map<number, { status: "idle" | "running"; trialId?: number }>;
  noveltyRate: number | null;
  noveltyThreshold: number | null;
  patienceHint: string;
  stopState: string;
};

const shouldRenderDashboard = (enabled: boolean): boolean =>
  enabled && Boolean(process.stdout.isTTY);

const formatDuration = (inputMs: number): string => {
  const totalSeconds = Math.max(0, Math.floor(inputMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) {
    return `${seconds}s`;
  }
  return `${minutes}m ${seconds}s`;
};

const formatEta = (snapshot: DashboardSnapshot): string => {
  if (snapshot.attempted <= 0 || snapshot.planned <= snapshot.attempted) {
    return snapshot.planned <= snapshot.attempted ? "0s" : "—";
  }
  const elapsedMs = Math.max(0, Date.now() - snapshot.startedAtMs);
  if (elapsedMs <= 0) {
    return "—";
  }
  const avgMsPerTrial = elapsedMs / snapshot.attempted;
  if (!Number.isFinite(avgMsPerTrial) || avgMsPerTrial <= 0) {
    return "—";
  }
  return formatDuration(avgMsPerTrial * (snapshot.planned - snapshot.attempted));
};

const formatRunSummary = (snapshot: DashboardSnapshot): string => {
  const elapsed = formatDuration(Math.max(0, Date.now() - snapshot.startedAtMs));
  const eta = formatEta(snapshot);
  const usageLine =
    snapshot.mode === "mock"
      ? "Usage so far: not applicable (mock mode)"
      : `Usage so far: ${snapshot.usage.total} tokens (in ${snapshot.usage.prompt}, out ${snapshot.usage.completion})`;

  const workerLines: string[] = [];
  if (snapshot.workers > 1) {
    const sorted = Array.from(snapshot.workerStatus.entries()).sort((a, b) => a[0] - b[0]);
    const visible = sorted.slice(0, 8);
    for (const [workerId, state] of visible) {
      if (state.status === "running") {
        workerLines.push(`  W${workerId}: running trial #${state.trialId ?? "-"}`);
      } else {
        workerLines.push(`  W${workerId}: idle`);
      }
    }
    const hidden = sorted.length - visible.length;
    if (hidden > 0) {
      workerLines.push(`  (+${hidden} more workers)`);
    }
  }

  const novelty = snapshot.noveltyRate === null ? "—" : snapshot.noveltyRate.toFixed(3);
  const threshold = snapshot.noveltyThreshold === null ? "—" : snapshot.noveltyThreshold.toFixed(3);

  const lines: string[] = [];
  lines.push("═══ RUN ═══");
  lines.push(
    `Question: ${snapshot.question} | mode ${snapshot.mode} | protocol ${snapshot.protocol} | trials ${snapshot.attempted}/${snapshot.planned} | workers ${snapshot.workers}`
  );
  lines.push(`Progress: ${snapshot.attempted}/${snapshot.planned} | elapsed ${elapsed} | ETA ${eta}`);
  if (workerLines.length > 0) {
    lines.push("Workers:");
    lines.push(...workerLines);
  }
  lines.push(
    `Monitoring: novelty ${novelty} (threshold ${threshold}) | ${snapshot.patienceHint} | ${snapshot.stopState}`
  );
  lines.push(usageLine);
  lines.push("Stopping indicates diminishing novelty, not correctness.");
  if (snapshot.noveltyRate !== null) {
    lines.push("Embedding groups reflect similarity, not semantic categories.");
  }

  return `${lines.join("\n")}\n`;
};

class RunDashboardMonitor {
  private readonly bus: EventBus;
  private readonly snapshot: DashboardSnapshot;
  private readonly unsubs: Array<() => void> = [];

  constructor(context: RunLifecycleContext) {
    this.bus = context.bus;
    this.snapshot = {
      runId: context.runId,
      question: "",
      mode: context.mode,
      protocol: "independent",
      planned: 0,
      attempted: 0,
      eligible: 0,
      workers: 1,
      startedAtMs: Date.now(),
      usage: {
        prompt: 0,
        completion: 0,
        total: 0
      },
      workerStatus: new Map(),
      noveltyRate: null,
      noveltyThreshold: context.resolvedConfig.execution.stop_policy?.novelty_epsilon ?? null,
      patienceHint: "Sampling continues",
      stopState: "Sampling continues"
    };
  }

  attach(): void {
    this.unsubs.push(
      this.bus.subscribeSafe("run.started", (payload) => this.onRunStarted(payload)),
      this.bus.subscribeSafe("trial.completed", (payload) => this.onTrialCompleted(payload)),
      this.bus.subscribeSafe("embedding.recorded", (payload) => this.onEmbeddingRecorded(payload)),
      this.bus.subscribeSafe("worker.status", (payload) => this.onWorkerStatus(payload)),
      this.bus.subscribeSafe("convergence.record", (payload) => this.onConvergence(payload)),
      this.bus.subscribeSafe("batch.completed", () => this.render()),
      this.bus.subscribeSafe("run.completed", () => this.render()),
      this.bus.subscribeSafe("run.failed", () => this.render())
    );
  }

  detach(): void {
    this.unsubs.splice(0).forEach((unsubscribe) => unsubscribe());
  }

  private onRunStarted(payload: EventPayloadMap["run.started"]): void {
    this.snapshot.question = payload.resolved_config.question.text;
    this.snapshot.protocol = payload.resolved_config.protocol.type;
    this.snapshot.workers = Math.max(1, payload.resolved_config.execution.workers);
    this.snapshot.planned = payload.k_planned ?? payload.resolved_config.execution.k_max;
    this.snapshot.startedAtMs = Date.now();
    for (let workerId = 1; workerId <= this.snapshot.workers; workerId += 1) {
      this.snapshot.workerStatus.set(workerId, { status: "idle" });
    }
    this.render();
  }

  private onTrialCompleted(payload: EventPayloadMap["trial.completed"]): void {
    this.snapshot.attempted += 1;
    const usage = payload.trial_record.usage;
    if (usage) {
      this.snapshot.usage.prompt += usage.prompt_tokens;
      this.snapshot.usage.completion += usage.completion_tokens;
      this.snapshot.usage.total += usage.total_tokens;
      if (usage.cost !== undefined) {
        this.snapshot.usage.cost = (this.snapshot.usage.cost ?? 0) + usage.cost;
      }
    }
  }

  private onEmbeddingRecorded(payload: EventPayloadMap["embedding.recorded"]): void {
    if (payload.embedding_record.embedding_status === "success") {
      this.snapshot.eligible += 1;
    }
  }

  private onWorkerStatus(payload: EventPayloadMap["worker.status"]): void {
    this.snapshot.workerStatus.set(payload.worker_id, {
      status: payload.status === "busy" ? "running" : "idle",
      trialId: payload.trial_id
    });
  }

  private onConvergence(payload: EventPayloadMap["convergence.record"]): void {
    const record = payload.convergence_record;
    this.snapshot.noveltyRate = record.novelty_rate ?? null;
    this.snapshot.stopState = record.stop.should_stop
      ? "Threshold met"
      : record.stop.would_stop
        ? "Likely to stop"
        : "Sampling continues";
    this.snapshot.patienceHint = `stop mode ${record.stop.mode}`;
  }

  private render(): void {
    process.stdout.write(`${formatRunSummary(this.snapshot)}\n`);
  }
}

const readReceiptText = (runDir: string): string | null => {
  const receiptPath = resolve(runDir, "receipt.txt");
  if (!existsSync(receiptPath)) {
    return null;
  }
  return readFileSync(receiptPath, "utf8");
};

export const createUiRunLifecycleHooks = (input?: { dashboard?: boolean }): RunLifecycleHooks => {
  const dashboardEnabled = shouldRenderDashboard(Boolean(input?.dashboard));
  let monitor: RunDashboardMonitor | null = null;

  return {
    onRunSetup: (context): void => {
      if (!dashboardEnabled) {
        return;
      }
      monitor = new RunDashboardMonitor(context);
      monitor.attach();
    },
    onRunFinally: async (context): Promise<void> => {
      if (monitor) {
        monitor.detach();
        monitor = null;
      }

      if (!dashboardEnabled || context.receiptMode === "skip") {
        return;
      }

      const receiptText = readReceiptText(context.runDir);
      if (!receiptText) {
        context.warningSink.warn("receipt.txt missing after run completion", "receipt");
        return;
      }

      process.stdout.write("═══ RECEIPT ═══\n");
      process.stdout.write(receiptText);
    }
  };
};
