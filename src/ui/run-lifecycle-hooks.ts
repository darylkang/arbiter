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
  MASTER_BAR_MAX,
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
  trialModelById: Map<number, string>;
  workerStatus: Map<number, { status: WorkerViewStatus; trialId?: number }>;
};

const MAX_DASHBOARD_QUESTION_CHARS = 88;
const CURSOR_HIDE = "\x1b[?25l";
const CURSOR_SHOW = "\x1b[?25h";
const RESET_SCROLL_REGION = "\x1b[r";
const ANSI_CSI_REGEX = /\u001b\[[0-9;?]*[ -/]*[@-~]/g;

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
    return "novelty saturation";
  }
  if (stopReason === "user_interrupt") {
    return "user requested graceful stop";
  }
  if (stopReason === "k_max_reached") {
    return "max trials reached";
  }
  if (stopReason === "completed") {
    return "sampling complete";
  }
  return "run failed";
};

const stripAnsi = (value: string): string =>
  value.replace(ANSI_CSI_REGEX, "").replace(/\r/g, "");

const countRenderedRows = (value: string, columns: number): number => {
  const width = Math.max(1, columns);
  const lines = stripAnsi(value).replace(/\n+$/, "").split("\n");
  let total = 0;
  for (const line of lines) {
    total += Math.max(1, Math.ceil(line.length / width));
  }
  return total;
};
const toPercent = (attempted: number, planned: number): number =>
  planned <= 0 ? 0 : Math.max(0, Math.min(100, (attempted / planned) * 100));

const toUsageSummary = (snapshot: DashboardSnapshot): string =>
  `${snapshot.usage.total} tokens (in ${snapshot.usage.prompt}, out ${snapshot.usage.completion})`;

const toDurationFromIso = (startedAt?: string, completedAt?: string): string => {
  if (!startedAt || !completedAt) {
    return "—";
  }
  const started = Date.parse(startedAt);
  const completed = Date.parse(completedAt);
  if (!Number.isFinite(started) || !Number.isFinite(completed) || completed < started) {
    return "—";
  }
  return formatClockHMS(completed - started);
};

type DashboardRenderOptions = {
  width?: number;
  maxRows?: number;
};

const countRowsForLines = (lines: string[], columns: number): number =>
  lines.reduce((total, line) => total + countRenderedRows(line, columns), 0);

const buildWorkerSection = (
  snapshot: DashboardSnapshot,
  fmt: ReturnType<typeof createStdoutFormatter>,
  width: number,
  compact: boolean,
  remainingRows: number
): string[] => {
  if (snapshot.workers <= 1 || remainingRows <= 0) {
    return [];
  }

  const sorted = Array.from(snapshot.workerStatus.entries()).sort((a, b) => a[0] - b[0]);
  const sectionPrefix = [renderRuledSection("WORKERS", width, fmt), ...(compact ? [] : [""]), fmt.muted("ID  Activity      State     Trial     Model")];
  const prefixRows = countRowsForLines(sectionPrefix, width);
  const overflowRows = countRowsForLines([fmt.muted("(+0 more workers)")], width);
  const minVisibleRows = prefixRows + 1;
  if (remainingRows < minVisibleRows) {
    return [];
  }

  let visibleCount = 0;
  let usedRows = prefixRows;
  while (visibleCount < sorted.length) {
    const [workerId, state] = sorted[visibleCount]!;
    const workerLine = renderWorkerRow(
      {
        id: workerId,
        state: state.status,
        trialId: state.trialId,
        model: state.trialId !== undefined ? snapshot.trialModelById.get(state.trialId) ?? "—" : "—",
        tick: snapshot.renderTick
      },
      fmt,
      width
    );
    const workerRows = countRenderedRows(workerLine, width);
    const remainingWorkers = sorted.length - (visibleCount + 1);
    const requiredOverflowRows = remainingWorkers > 0 ? overflowRows : 0;
    if (usedRows + workerRows + requiredOverflowRows > remainingRows) {
      break;
    }
    usedRows += workerRows;
    visibleCount += 1;
  }

  if (visibleCount === 0) {
    return [];
  }

  const lines = [...sectionPrefix];
  for (let index = 0; index < visibleCount; index += 1) {
    const [workerId, state] = sorted[index]!;
    lines.push(
      renderWorkerRow(
        {
          id: workerId,
          state: state.status,
          trialId: state.trialId,
          model: state.trialId !== undefined ? snapshot.trialModelById.get(state.trialId) ?? "—" : "—",
          tick: snapshot.renderTick
        },
        fmt,
        width
      )
    );
  }
  const hidden = sorted.length - visibleCount;
  if (hidden > 0) {
    lines.push(fmt.muted(`(+${hidden} more workers)`));
  }
  return lines;
};

export const buildRunDashboardText = (
  snapshot: DashboardSnapshot,
  nowMs = Date.now(),
  options: DashboardRenderOptions = {}
): string => {
  const fmt = createStdoutFormatter();
  const width = options.width ?? fmt.termWidth();
  const maxRows = options.maxRows;
  const compact = maxRows !== undefined && maxRows <= 18;
  const elapsedMs = Math.max(0, nowMs - snapshot.startedAtMs);
  const elapsed = formatClockHMS(elapsedMs);
  const eta = formatEtaHMS(snapshot);
  const pct = toPercent(snapshot.attempted, snapshot.planned);
  const masterBar = renderProgressBar(pct, Math.min(MASTER_BAR_MAX, Math.max(10, width - 34)), fmt.brand, fmt);
  const sections: string[] = [];
  let usedRows = 0;
  const pushBlock = (block: string[], required = false): boolean => {
    if (block.length === 0) {
      return true;
    }
    const blockRows = countRowsForLines(block, width);
    if (!required && maxRows !== undefined && usedRows + blockRows > maxRows) {
      return false;
    }
    sections.push(...block);
    usedRows += blockRows;
    return true;
  };

  pushBlock([renderStatusStrip("run / monitoring", elapsedMs, width, fmt), renderSeparator(width, fmt)], true);
  if (!compact) {
    pushBlock([""]);
  }
  pushBlock(
    [
      renderRuledSection("PROGRESS", width, fmt),
      ...(compact ? [] : [""]),
      `Trials: ${snapshot.attempted}/${snapshot.planned} · Workers: ${snapshot.workers}`,
      `${masterBar}  ${String(Math.round(pct)).padStart(3, " ")}%    ${elapsed}  ETA ${eta}`
    ],
    true
  );
  if (!compact) {
    pushBlock([""]);
  }

  const novelty = snapshot.noveltyRate === null ? "—" : snapshot.noveltyRate.toFixed(3);
  const noveltyThreshold =
    snapshot.noveltyThreshold === null ? "—" : snapshot.noveltyThreshold.toFixed(3);
  const meanMaxSimilarity =
    snapshot.meanMaxSimilarity === null ? "—" : snapshot.meanMaxSimilarity.toFixed(3);
  const similarityThreshold =
    snapshot.similarityThreshold === null ? "—" : snapshot.similarityThreshold.toFixed(3);

  const monitoringBlock = [
    renderRuledSection("MONITORING", width, fmt),
    ...(compact ? [] : [""]),
    renderKV("Novelty rate", `${novelty} (threshold ${noveltyThreshold})`, fmt),
    renderKV("Patience", `${snapshot.lowNoveltyStreak}/${snapshot.patience}`, fmt),
    renderKV("Status", snapshot.stopState, fmt)
  ];
  if (snapshot.groupingEnabled) {
    monitoringBlock.push(
      renderKV("Embedding groups", snapshot.groupCount === null ? "—" : String(snapshot.groupCount), fmt)
    );
  }
  if (snapshot.similarityThreshold !== null) {
    monitoringBlock.push(renderKV("Similarity", `${meanMaxSimilarity} (threshold ${similarityThreshold})`, fmt));
  }
  pushBlock(monitoringBlock, true);

  const caveatBlock = [fmt.muted(UI_COPY.stoppingCaveat)];
  if (snapshot.groupingEnabled) {
    caveatBlock.push(fmt.muted(UI_COPY.groupingCaveat));
  }
  if (snapshot.stopState === "user requested graceful stop") {
    caveatBlock.push(fmt.warn(UI_COPY.gracefulStopRequested));
  }
  pushBlock(compact ? caveatBlock : ["", ...caveatBlock], true);

  const footerBlock = compact
    ? [renderSeparator(width, fmt), fmt.muted("Ctrl+C graceful stop")]
    : ["", renderSeparator(width, fmt), fmt.muted("Ctrl+C graceful stop")];
  const footerRows = countRowsForLines(footerBlock, width);

  const remainingBeforeFooter = maxRows === undefined ? Number.POSITIVE_INFINITY : Math.max(0, maxRows - usedRows - footerRows);
  const workerBlock = buildWorkerSection(snapshot, fmt, width, compact, remainingBeforeFooter);
  if (workerBlock.length > 0) {
    pushBlock(compact ? workerBlock : ["", ...workerBlock]);
  }

  const usageBlock = [
    renderRuledSection("USAGE", width, fmt),
    ...(compact ? [] : [""]),
    ...(snapshot.mode === "mock"
      ? [fmt.muted("Usage not applicable")]
      : [
          `Usage so far: ${toUsageSummary(snapshot)}`,
          ...(snapshot.usage.cost !== undefined
            ? [fmt.warn(`Cost: ${snapshot.usage.cost.toFixed(6)} (estimate)`)]
            : [])
        ])
  ];
  pushBlock(compact ? usageBlock : ["", ...usageBlock]);

  pushBlock(footerBlock, true);

  return `${sections.join("\n")}\n`;
};

class RunDashboardMonitor {
  private readonly bus: EventBus;
  private readonly snapshot: DashboardSnapshot;
  private readonly unsubs: Array<() => void> = [];
  private readonly prefixRows: number;
  private animationTimer: NodeJS.Timeout | null = null;
  private hasRendered = false;

  constructor(context: RunLifecycleContext, prefixRows = 0) {
    this.bus = context.bus;
    this.prefixRows = prefixRows;
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
      trialModelById: new Map(),
      workerStatus: new Map()
    };
  }

  attach(): void {
    process.stdout.write(CURSOR_HIDE);
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
    process.stdout.write(RESET_SCROLL_REGION);
    if (this.hasRendered) {
      const terminalRows = Math.max(1, process.stdout.rows ?? 24);
      process.stdout.write(`\x1b[${terminalRows};1H\n`);
    }
    process.stdout.write(CURSOR_SHOW);
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

  private onTrialPlanned(payload: EventPayloadMap["trial.planned"]): void {
    this.snapshot.trialModelById.set(payload.trial_id, payload.assigned_config.model);
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
    const terminalColumns = Math.max(1, process.stdout.columns ?? 80);
    const terminalRows = Math.max(2, process.stdout.rows ?? 24);
    const topRow = Math.min(Math.max(1, this.prefixRows + 1), terminalRows);
    const liveRows = Math.max(1, terminalRows - topRow + 1);
    const frameText = buildRunDashboardText(this.snapshot, Date.now(), {
      width: terminalColumns,
      maxRows: liveRows
    }).replace(/\n+$/, "");

    process.stdout.write(`\x1b[${topRow};${terminalRows}r`);
    process.stdout.write(`\x1b[${topRow};1H\x1b[J`);
    process.stdout.write(frameText);
    this.hasRendered = true;
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
    const stopBanner = toStopBanner(model.stop_reason);
    const stopReasonLabel = stopBanner.replace(/^Stopped:\s*/i, "").trim();
    const lines: string[] = [
      renderStatusStrip("run / receipt", 0, width, fmt),
      renderSeparator(width, fmt),
      "",
      renderRuledSection("RECEIPT", width, fmt),
      "",
      stopBanner,
      fmt.muted(UI_COPY.stoppingCaveat),
      "",
      renderRuledSection("SUMMARY", width, fmt),
      "",
      renderKV("Stop reason", stopReasonLabel || "unknown", fmt),
      renderKV(
        "Trials",
        `${model.counts.k_planned ?? "-"} / ${model.counts.k_attempted ?? "-"} / ${model.counts.k_eligible ?? "-"} (planned / completed / eligible)`,
        fmt
      ),
      renderKV("Duration", toDurationFromIso(model.started_at, model.completed_at), fmt),
      renderKV(
        "Usage",
        model.usage
          ? `${model.usage.totals.total_tokens} tokens (in ${model.usage.totals.prompt_tokens}, out ${model.usage.totals.completion_tokens})`
          : "not available",
        fmt
      ),
      renderKV("Protocol", model.protocol ?? "-", fmt),
      renderKV("Models", `${model.model_count}`, fmt),
      renderKV("Personas", `${model.persona_count}`, fmt)
    ];

    if (model.grouping?.enabled) {
      lines.push("");
      lines.push(renderRuledSection("GROUPS", width, fmt));
      lines.push("");
      lines.push(`Embedding groups: ${model.grouping.group_count ?? "—"}`);
      lines.push("");
      lines.push("Top group sizes");
      lines.push(model.grouping.group_count !== undefined ? String(model.grouping.group_count) : "—");
      lines.push("");
      lines.push(fmt.muted(UI_COPY.groupingCaveat));
    }

    lines.push("");
    lines.push(renderRuledSection("ARTIFACTS", width, fmt));
    lines.push("");
    lines.push(fmt.muted("Only generated files are listed."));
    if ((model.artifacts?.length ?? 0) === 0) {
      lines.push("—");
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
      let prefixRows = 0;
      if (stackPrefixText && stackPrefixText.trim().length > 0) {
        const prefixText = stackPrefixText.replace(/\n+$/, "");
        prefixRows = countRenderedRows(prefixText, Math.max(1, process.stdout.columns ?? 80));
        process.stdout.write(`${prefixText}\n`);
      }
      monitor = new RunDashboardMonitor(context, prefixRows);
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
