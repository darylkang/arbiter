import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { EventBus } from "../events/event-bus.js";
import type { EventPayloadMap } from "../events/types.js";
import type { RunLifecycleContext, RunLifecycleHooks } from "../run/lifecycle-hooks.js";

type WorkerViewStatus = "idle" | "running" | "finishing" | "error";

type DashboardSnapshot = {
  runId: string;
  questionExcerpt: string;
  mode: "mock" | "live";
  protocolLabel: string;
  groupingEnabled: boolean;
  groupCount: number | null;
  planned: number;
  attempted: number;
  eligible: number;
  workers: number;
  kMinEligible: number;
  stopMode: "advisor" | "enforcer";
  noveltyThreshold: number | null;
  similarityThreshold: number | null;
  patience: number;
  lowNoveltyStreak: number;
  noveltyRate: number | null;
  meanMaxSimilarity: number | null;
  stopState: string;
  startedAtMs: number;
  renderTick: number;
  usage: {
    prompt: number;
    completion: number;
    total: number;
    cost?: number;
  };
  workerStatus: Map<number, { status: WorkerViewStatus; trialId?: number }>;
};

const MAX_DASHBOARD_QUESTION_CHARS = 88;
const MAX_VISIBLE_WORKERS = 8;
const SPINNER_FRAMES = ["-", "\\", "|", "/"];

const shouldRenderDashboard = (enabled: boolean): boolean =>
  enabled && Boolean(process.stdout.isTTY);

const toQuestionExcerpt = (text: string, maxChars: number): string => {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxChars) {
    return normalized;
  }
  return `${normalized.slice(0, maxChars - 1).trimEnd()}…`;
};

const formatProtocolLabel = (payload: EventPayloadMap["run.started"]): string => {
  const protocol = payload.resolved_config.protocol;
  if (protocol.type === "debate_v1") {
    const participants = protocol.participants ?? 2;
    const rounds = protocol.rounds ?? 1;
    return `Debate (${participants}p x ${rounds}r + A)`;
  }
  return "Independent";
};

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

const formatProgressBar = (completed: number, planned: number, width = 28): string => {
  const safePlanned = Math.max(1, planned);
  const ratio = Math.max(0, Math.min(1, completed / safePlanned));
  const filled = Math.round(ratio * width);
  const left = "#".repeat(filled);
  const right = "-".repeat(Math.max(0, width - filled));
  return `[${left}${right}]`;
};

const mapStopStateFromMonitoring = (
  record: EventPayloadMap["monitoring.record"]["monitoring_record"]
): string => {
  if (record.stop.should_stop) {
    return "threshold met";
  }
  if (record.stop.would_stop) {
    return "likely to stop";
  }
  return "sampling continues";
};

const mapStopStateFromCompletion = (
  stopReason: EventPayloadMap["run.completed"]["stop_reason"]
): string => {
  if (stopReason === "converged") {
    return "threshold met";
  }
  if (stopReason === "user_interrupt") {
    return "stopped by user (graceful)";
  }
  if (stopReason === "k_max_reached" || stopReason === "completed") {
    return "sampling complete";
  }
  return "run failed";
};

const spinnerFrame = (tick: number): string =>
  SPINNER_FRAMES[Math.max(0, tick) % SPINNER_FRAMES.length];

export const buildRunDashboardText = (
  snapshot: DashboardSnapshot,
  nowMs = Date.now()
): string => {
  const elapsed = formatDuration(Math.max(0, nowMs - snapshot.startedAtMs));
  const eta = formatEta(snapshot);
  const progressBar = formatProgressBar(snapshot.attempted, snapshot.planned);

  const lines: string[] = [];
  lines.push("═══ RUN ═══");
  lines.push(
    `Question: ${snapshot.questionExcerpt} | mode ${snapshot.mode} | protocol ${snapshot.protocolLabel} | trials ${snapshot.attempted}/${snapshot.planned} | workers ${snapshot.workers}`
  );
  lines.push(`Progress: ${progressBar} ${snapshot.attempted}/${snapshot.planned}`);
  lines.push(`Timing: elapsed ${elapsed} | ETA ${eta}`);

  if (snapshot.workers > 1) {
    lines.push("Workers:");
    const sorted = Array.from(snapshot.workerStatus.entries()).sort((a, b) => a[0] - b[0]);
    const visible = sorted.slice(0, MAX_VISIBLE_WORKERS);
    for (const [workerId, state] of visible) {
      if (state.status === "running") {
        lines.push(
          `  W${workerId}: ${spinnerFrame(snapshot.renderTick)} calling model (trial ${state.trialId ?? "-"})`
        );
      } else if (state.status === "finishing") {
        lines.push(`  W${workerId}: ${spinnerFrame(snapshot.renderTick)} finishing`);
      } else if (state.status === "error") {
        lines.push(`  W${workerId}: ! error`);
      } else {
        lines.push(`  W${workerId}: idle`);
      }
    }
    const hidden = sorted.length - visible.length;
    if (hidden > 0) {
      lines.push(`  (+${hidden} more workers)`);
    }
  }

  const novelty = snapshot.noveltyRate === null ? "—" : snapshot.noveltyRate.toFixed(3);
  const noveltyThreshold =
    snapshot.noveltyThreshold === null ? "—" : snapshot.noveltyThreshold.toFixed(3);
  const meanMaxSimilarity =
    snapshot.meanMaxSimilarity === null ? "—" : snapshot.meanMaxSimilarity.toFixed(3);
  const similarityThreshold =
    snapshot.similarityThreshold === null ? "—" : snapshot.similarityThreshold.toFixed(3);

  lines.push("Monitoring:");
  lines.push(`  novelty rate: ${novelty} (threshold ${noveltyThreshold})`);
  lines.push(`  mean max similarity: ${meanMaxSimilarity} (threshold ${similarityThreshold})`);
  lines.push(`  patience: ${snapshot.lowNoveltyStreak}/${snapshot.patience} low-novelty batches`);
  lines.push(`  status: ${snapshot.stopState}`);
  if (snapshot.groupingEnabled) {
    lines.push(`  embedding groups: ${snapshot.groupCount === null ? "—" : snapshot.groupCount}`);
  }

  if (snapshot.mode === "mock") {
    lines.push("Usage so far: usage not applicable (mock mode)");
  } else {
    lines.push(
      `Usage so far: ${snapshot.usage.total} tokens (in ${snapshot.usage.prompt}, out ${snapshot.usage.completion})`
    );
    if (snapshot.usage.cost !== undefined) {
      lines.push(`Cost estimate so far: $${snapshot.usage.cost.toFixed(6)}`);
    }
  }

  lines.push("Stopping indicates diminishing novelty, not correctness.");
  if (snapshot.groupingEnabled) {
    lines.push("Embedding groups reflect similarity, not semantic categories.");
  }

  return `${lines.join("\n")}\n`;
};

class RunDashboardMonitor {
  private readonly bus: EventBus;
  private readonly snapshot: DashboardSnapshot;
  private readonly unsubs: Array<() => void> = [];
  private lastRenderedLineCount = 0;

  constructor(context: RunLifecycleContext) {
    this.bus = context.bus;
    const stopPolicy = context.resolvedConfig.execution.stop_policy;
    this.snapshot = {
      runId: context.runId,
      questionExcerpt: "",
      mode: context.mode,
      protocolLabel: "Independent",
      groupingEnabled:
        context.resolvedConfig.measurement.clustering.enabled &&
        context.resolvedConfig.measurement.clustering.stop_mode !== "disabled",
      groupCount: null,
      planned: 0,
      attempted: 0,
      eligible: 0,
      workers: 1,
      kMinEligible: context.resolvedConfig.execution.k_min,
      stopMode: context.resolvedConfig.execution.stop_mode,
      noveltyThreshold: stopPolicy?.novelty_epsilon ?? null,
      similarityThreshold: stopPolicy?.similarity_threshold ?? null,
      patience: stopPolicy?.patience ?? 2,
      lowNoveltyStreak: 0,
      noveltyRate: null,
      meanMaxSimilarity: null,
      stopState: "sampling continues",
      startedAtMs: Date.now(),
      renderTick: 0,
      usage: {
        prompt: 0,
        completion: 0,
        total: 0
      },
      workerStatus: new Map()
    };
  }

  attach(): void {
    this.unsubs.push(
      this.bus.subscribeSafe("run.started", (payload) => this.onRunStarted(payload)),
      this.bus.subscribeSafe("trial.completed", (payload) => this.onTrialCompleted(payload)),
      this.bus.subscribeSafe("embedding.recorded", (payload) => this.onEmbeddingRecorded(payload)),
      this.bus.subscribeSafe("worker.status", (payload) => this.onWorkerStatus(payload)),
      this.bus.subscribeSafe("monitoring.record", (payload) => this.onMonitoring(payload)),
      this.bus.subscribeSafe("batch.completed", () => this.render()),
      this.bus.subscribeSafe("run.completed", (payload) => this.onRunCompleted(payload)),
      this.bus.subscribeSafe("run.failed", () => this.onRunFailed())
    );
  }

  detach(): void {
    this.unsubs.splice(0).forEach((unsubscribe) => unsubscribe());
  }

  private onRunStarted(payload: EventPayloadMap["run.started"]): void {
    const config = payload.resolved_config;
    this.snapshot.questionExcerpt = toQuestionExcerpt(
      config.question.text,
      MAX_DASHBOARD_QUESTION_CHARS
    );
    this.snapshot.protocolLabel = formatProtocolLabel(payload);
    this.snapshot.workers = Math.max(1, config.execution.workers);
    this.snapshot.planned = payload.k_planned ?? config.execution.k_max;
    this.snapshot.kMinEligible = config.execution.k_min;
    this.snapshot.stopMode = config.execution.stop_mode;
    this.snapshot.noveltyThreshold =
      config.execution.stop_policy?.novelty_epsilon ?? this.snapshot.noveltyThreshold;
    this.snapshot.similarityThreshold =
      config.execution.stop_policy?.similarity_threshold ?? this.snapshot.similarityThreshold;
    this.snapshot.patience = config.execution.stop_policy?.patience ?? this.snapshot.patience;
    this.snapshot.startedAtMs = Date.now();
    this.snapshot.lowNoveltyStreak = 0;
    this.snapshot.noveltyRate = null;
    this.snapshot.meanMaxSimilarity = null;
    this.snapshot.groupCount = null;
    this.snapshot.stopState = "sampling continues";
    this.snapshot.workerStatus.clear();
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

  private onMonitoring(payload: EventPayloadMap["monitoring.record"]): void {
    const record = payload.monitoring_record;
    this.snapshot.noveltyRate = record.novelty_rate ?? null;
    this.snapshot.meanMaxSimilarity = record.mean_max_sim_to_prior ?? null;
    this.snapshot.stopState = mapStopStateFromMonitoring(record);

    if (this.snapshot.groupingEnabled) {
      this.snapshot.groupCount =
        typeof record.group_count === "number" ? record.group_count : this.snapshot.groupCount;
    }

    const meetsLowNoveltyThresholds =
      record.has_eligible_in_batch &&
      record.k_eligible >= this.snapshot.kMinEligible &&
      record.novelty_rate !== null &&
      record.mean_max_sim_to_prior !== null &&
      this.snapshot.noveltyThreshold !== null &&
      this.snapshot.similarityThreshold !== null &&
      record.novelty_rate <= this.snapshot.noveltyThreshold &&
      record.mean_max_sim_to_prior >= this.snapshot.similarityThreshold;

    this.snapshot.lowNoveltyStreak = meetsLowNoveltyThresholds
      ? this.snapshot.lowNoveltyStreak + 1
      : 0;
  }

  private onRunCompleted(payload: EventPayloadMap["run.completed"]): void {
    for (const [workerId, state] of this.snapshot.workerStatus.entries()) {
      if (state.status === "running") {
        this.snapshot.workerStatus.set(workerId, {
          status: "finishing",
          trialId: state.trialId
        });
      }
    }
    this.snapshot.stopState = mapStopStateFromCompletion(payload.stop_reason);
    this.render();
  }

  private onRunFailed(): void {
    for (const [workerId] of this.snapshot.workerStatus.entries()) {
      this.snapshot.workerStatus.set(workerId, { status: "error" });
    }
    this.snapshot.stopState = "run failed";
    this.render();
  }

  private render(): void {
    this.snapshot.renderTick += 1;
    const frameText = buildRunDashboardText(this.snapshot);
    const frameLineCount = frameText.trimEnd().split("\n").length;

    if (this.lastRenderedLineCount > 0) {
      process.stdout.write(`\x1b[${this.lastRenderedLineCount}A\x1b[J`);
    }
    process.stdout.write(frameText);
    this.lastRenderedLineCount = frameLineCount;
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
