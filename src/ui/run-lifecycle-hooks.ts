import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { EventBus } from "../events/event-bus.js";
import type { EventPayloadMap } from "../events/types.js";
import type { RunLifecycleContext, RunLifecycleHooks } from "../run/lifecycle-hooks.js";
import { UI_COPY } from "./copy.js";
import { toStopBanner } from "./copy.js";
import { buildReceiptModel } from "./receipt-model.js";
import { createStdoutFormatter } from "./fmt.js";
import {
  renderKV,
  renderProgressBar,
  renderRuledSection,
  renderSeparator,
  renderStatusStrip,
  renderWorkerRow,
  type WorkerRow
} from "./wizard-theme.js";

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
const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

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

const formatClockHMS = (inputMs: number): string => {
  const totalSeconds = Math.max(0, Math.floor(inputMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(
    2,
    "0"
  )}`;
};

const formatEtaHMS = (snapshot: DashboardSnapshot): string => {
  if (snapshot.attempted <= 0 || snapshot.planned <= snapshot.attempted) {
    return snapshot.planned <= snapshot.attempted ? "00:00:00" : "—";
  }
  const elapsedMs = Math.max(0, Date.now() - snapshot.startedAtMs);
  if (elapsedMs <= 0) {
    return "—";
  }
  const avgMsPerTrial = elapsedMs / snapshot.attempted;
  if (!Number.isFinite(avgMsPerTrial) || avgMsPerTrial <= 0) {
    return "—";
  }
  return formatClockHMS(avgMsPerTrial * (snapshot.planned - snapshot.attempted));
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
    return "user requested graceful stop";
  }
  if (stopReason === "k_max_reached" || stopReason === "completed") {
    return "sampling complete";
  }
  return "run failed";
};

const spinnerFrame = (tick: number): string =>
  SPINNER_FRAMES[Math.max(0, tick) % SPINNER_FRAMES.length];

const countRenderedLines = (value: string): number => value.split("\n").length;
const toPercent = (attempted: number, planned: number): number =>
  planned <= 0 ? 0 : Math.max(0, Math.min(100, (attempted / planned) * 100));

const toUsageSummary = (snapshot: DashboardSnapshot): string =>
  `${snapshot.usage.total} tokens (in ${snapshot.usage.prompt}, out ${snapshot.usage.completion})`;

export const buildRunDashboardText = (
  snapshot: DashboardSnapshot,
  nowMs = Date.now()
): string => {
  const fmt = createStdoutFormatter();
  const width = fmt.termWidth();
  const elapsedMs = Math.max(0, nowMs - snapshot.startedAtMs);
  const elapsed = formatClockHMS(elapsedMs);
  const eta = formatEtaHMS(snapshot);
  const pct = toPercent(snapshot.attempted, snapshot.planned);
  const masterBar = renderProgressBar(pct, Math.min(30, Math.max(6, width - 40)), fmt.brand, fmt);
  const sections: string[] = [
    renderStatusStrip("run / monitoring", elapsedMs, width, fmt),
    renderSeparator(width, fmt),
    "",
    renderRuledSection("PROGRESS", width, fmt),
    "",
    `Trials: ${snapshot.attempted}/${snapshot.planned} · Workers: ${snapshot.workers}`,
    `${masterBar}  ${String(Math.round(pct)).padStart(3, " ")}%    ${elapsed}  ETA ${eta}`,
    "",
    renderRuledSection("MONITORING", width, fmt),
    ""
  ];

  const novelty = snapshot.noveltyRate === null ? "—" : snapshot.noveltyRate.toFixed(3);
  const noveltyThreshold =
    snapshot.noveltyThreshold === null ? "—" : snapshot.noveltyThreshold.toFixed(3);
  const meanMaxSimilarity =
    snapshot.meanMaxSimilarity === null ? "—" : snapshot.meanMaxSimilarity.toFixed(3);
  const similarityThreshold =
    snapshot.similarityThreshold === null ? "—" : snapshot.similarityThreshold.toFixed(3);

  sections.push(renderKV("Novelty rate", `${novelty} (threshold ${noveltyThreshold})`, fmt));
  sections.push(renderKV("Patience", `${snapshot.lowNoveltyStreak}/${snapshot.patience}`, fmt));
  sections.push(renderKV("Status", snapshot.stopState, fmt));
  if (snapshot.groupingEnabled) {
    sections.push(
      renderKV("Embedding groups", snapshot.groupCount === null ? "—" : String(snapshot.groupCount), fmt)
    );
  }
  if (snapshot.similarityThreshold !== null) {
    sections.push(renderKV("Similarity", `${meanMaxSimilarity} (threshold ${similarityThreshold})`, fmt));
  }
  sections.push("");
  sections.push(fmt.muted(UI_COPY.stoppingCaveat));
  if (snapshot.groupingEnabled) {
    sections.push(fmt.muted(UI_COPY.groupingCaveat));
  }
  if (snapshot.stopState === "user requested graceful stop") {
    sections.push("");
    sections.push(fmt.warn(UI_COPY.gracefulStopRequested));
  }
  sections.push("");
  sections.push(renderRuledSection("USAGE", width, fmt));
  sections.push("");
  if (snapshot.mode === "mock") {
    sections.push(fmt.muted("Usage not applicable"));
  } else {
    sections.push(`Usage so far: ${toUsageSummary(snapshot)}`);
    if (snapshot.usage.cost !== undefined) {
      sections.push(fmt.warn(`Cost: ${snapshot.usage.cost.toFixed(6)} (estimate)`));
    }
  }

  if (snapshot.workers > 1) {
    const rows = process.stdout.rows ?? 24;
    const maxFrameLines = Math.max(10, rows - 1);
    const baseLineCount = sections.reduce((total, section) => total + countRenderedLines(section), 0);
    const availableWorkerRows = Math.max(0, maxFrameLines - baseLineCount - 8);
    if (availableWorkerRows > 0) {
      const sorted = Array.from(snapshot.workerStatus.entries()).sort((a, b) => a[0] - b[0]);
      const needsOverflow = sorted.length > availableWorkerRows;
      const visibleTarget = needsOverflow
        ? Math.max(0, availableWorkerRows - 1)
        : availableWorkerRows;
      const visible = sorted.slice(0, visibleTarget);
      sections.push("");
      sections.push(renderRuledSection("WORKERS", width, fmt));
      sections.push("");
      for (const [workerId, state] of visible) {
        const workerRow: WorkerRow = {
          id: workerId,
          pct,
          state: state.status,
          trialId: state.trialId,
          model: snapshot.mode === "mock" ? "mock" : "live",
          spinner: state.status === "idle" ? spinnerFrame(snapshot.renderTick) : undefined
        };
        sections.push(renderWorkerRow(workerRow, fmt));
      }
      const hidden = sorted.length - visible.length;
      if (hidden > 0) {
        sections.push(fmt.muted(`(+${hidden} more workers)`));
      }
    }
  }

  sections.push("");
  sections.push(renderSeparator(width, fmt));
  sections.push(fmt.muted("Ctrl+C graceful stop"));
  return `${sections.join("\n")}\n`;
};

class RunDashboardMonitor {
  private readonly bus: EventBus;
  private readonly snapshot: DashboardSnapshot;
  private readonly unsubs: Array<() => void> = [];
  private lastRenderedLineCount = 0;
  private animationTimer: NodeJS.Timeout | null = null;

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
    this.startAnimationLoop();
  }

  detach(): void {
    this.stopAnimationLoop();
    this.unsubs.splice(0).forEach((unsubscribe) => unsubscribe());
  }

  private startAnimationLoop(): void {
    if (this.animationTimer) {
      return;
    }
    this.animationTimer = setInterval(() => {
      if (this.shouldAnimate()) {
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

  private shouldAnimate(): boolean {
    return (
      this.snapshot.attempted < this.snapshot.planned &&
      this.snapshot.stopState !== "sampling complete" &&
      this.snapshot.stopState !== "run failed" &&
      this.snapshot.stopState !== "user requested graceful stop"
    );
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

const buildReceiptDisplayText = (runDir: string): string | null => {
  try {
    const model = buildReceiptModel(runDir);
    const fmt = createStdoutFormatter();
    const width = fmt.termWidth();
    const lines: string[] = [
      renderStatusStrip("run / receipt", 0, width, fmt),
      renderSeparator(width, fmt),
      "",
      renderRuledSection("RECEIPT", width, fmt),
      "",
      toStopBanner(model.stop_reason),
      fmt.muted(UI_COPY.stoppingCaveat),
      "",
      renderRuledSection("SUMMARY", width, fmt),
      "",
      renderKV("Stop reason", model.stop_reason ?? "unknown", fmt),
      renderKV(
        "Trials",
        `${model.counts.k_planned ?? "-"} / ${model.counts.k_attempted ?? "-"} / ${model.counts.k_eligible ?? "-"} (planned / completed / eligible)`,
        fmt
      ),
      renderKV("Duration", `${model.started_at ?? "-"} -> ${model.completed_at ?? "-"}`, fmt),
      renderKV(
        "Usage",
        model.usage
          ? `${model.usage.totals.total_tokens} tokens (in ${model.usage.totals.prompt_tokens}, out ${model.usage.totals.completion_tokens})`
          : "not available",
        fmt
      ),
      renderKV("Protocol", model.protocol ?? "-", fmt),
      renderKV("Models", String(model.model_count), fmt),
      renderKV("Personas", String(model.persona_count), fmt)
    ];

    if (model.grouping?.enabled) {
      lines.push("");
      lines.push(renderRuledSection("GROUPS", width, fmt));
      lines.push("");
      lines.push("Top group sizes");
      lines.push(model.grouping.group_count !== undefined ? String(model.grouping.group_count) : "—");
      lines.push("");
      lines.push(fmt.muted(UI_COPY.groupingCaveat));
    }

    lines.push("");
    lines.push(renderRuledSection("ARTIFACTS", width, fmt));
    lines.push("");
    if ((model.artifacts?.length ?? 0) === 0) {
      lines.push("(no artifacts listed)");
    } else {
      const paths = model.artifacts?.map((artifact) => artifact.path) ?? [];
      for (let index = 0; index < paths.length; index += 3) {
        lines.push(paths.slice(index, index + 3).join("    "));
      }
    }

    if ((model.counts.k_eligible ?? 0) === 0) {
      lines.push("No embeddings were generated because there were zero eligible trials.");
    }

    lines.push("");
    lines.push(renderRuledSection("REPRODUCE", width, fmt));
    lines.push("");
    lines.push(`arbiter run --config ${runDir}/config.resolved.json`);
    lines.push("");
    lines.push(renderSeparator(width, fmt));
    lines.push(fmt.muted("Run complete."));
    return `${lines.join("\n")}\n`;
  } catch {
    return null;
  }
};

export const createUiRunLifecycleHooks = (input?: {
  dashboard?: boolean;
  stackPrefixText?: string;
}): RunLifecycleHooks => {
  const dashboardEnabled = shouldRenderDashboard(Boolean(input?.dashboard));
  const stackPrefixText = input?.stackPrefixText;
  let monitor: RunDashboardMonitor | null = null;

  return {
    onRunSetup: (context): void => {
      if (!dashboardEnabled) {
        return;
      }
      if (stackPrefixText && stackPrefixText.trim().length > 0) {
        process.stdout.write(`${stackPrefixText.replace(/\n+$/, "")}\n`);
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
      const receiptDisplayText = buildReceiptDisplayText(context.runDir);
      if (receiptDisplayText) {
        process.stdout.write(receiptDisplayText);
        return;
      }

      if (!receiptText) {
        context.warningSink.warn("receipt.txt missing after run completion", "receipt");
        return;
      }

      process.stdout.write(`${UI_COPY.receiptHeader}\n`);
      process.stdout.write(receiptText);
    }
  };
};
