import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { EventBus } from "../events/event-bus.js";
import type { EventPayloadMap } from "../events/types.js";
import type { RunLifecycleContext, RunLifecycleHooks } from "../run/lifecycle-hooks.js";
import { UI_COPY } from "./copy.js";
import { toStopBanner } from "./copy.js";
import { buildReceiptModel } from "./receipt-model.js";
import { createStdoutFormatter, type Formatter } from "./fmt.js";
import type { DashboardVM, ReceiptVM, RenderLine } from "./runtime-view-models.js";
import {
  MIN_DASHBOARD_ROWS,
  getDashboardTerminalSupport
} from "./tui-constraints.js";
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

type DashboardState = {
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

type DashboardRenderOptions = {
  width?: number;
  maxRows?: number;
  fmt?: Formatter;
};

type ReceiptRenderOptions = {
  width?: number;
  fmt?: Formatter;
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

const formatEtaHMS = (state: DashboardState): string => {
  if (state.attempted <= 0 || state.planned <= state.attempted) {
    return state.planned <= state.attempted ? "00:00:00" : "—";
  }
  const elapsedMs = Math.max(0, Date.now() - state.startedAtMs);
  if (elapsedMs <= 0) {
    return "—";
  }
  const avgMsPerTrial = elapsedMs / state.attempted;
  if (!Number.isFinite(avgMsPerTrial) || avgMsPerTrial <= 0) {
    return "—";
  }
  return formatClockHMS(avgMsPerTrial * (state.planned - state.attempted));
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

const toUsageSummary = (state: DashboardState): string =>
  `${state.usage.total} tokens (in ${state.usage.prompt}, out ${state.usage.completion})`;

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

const countRowsForLines = (lines: string[], columns: number): number =>
  lines.reduce((total, line) => total + countRenderedRows(line, columns), 0);

const renderToneLine = (line: RenderLine, fmt: Formatter): string => {
  if (line.tone === "warn") {
    return fmt.warn(line.text);
  }
  if (line.tone === "error") {
    return fmt.error(line.text);
  }
  if (line.tone === "success") {
    return fmt.success(line.text);
  }
  if (line.tone === "info") {
    return fmt.info(line.text);
  }
  if (line.tone === "text") {
    return fmt.text(line.text);
  }
  return fmt.muted(line.text);
};

const buildWorkerSection = (
  workerRows: WorkerRow[],
  fmt: Formatter,
  width: number,
  compact: boolean,
  remainingRows: number
): string[] => {
  if (workerRows.length <= 1 || remainingRows <= 0) {
    return [];
  }

  const sectionPrefix = [renderRuledSection("WORKERS", width, fmt), ...(compact ? [] : [""]), fmt.muted("ID  Activity      State     Trial     Model")];
  const prefixRows = countRowsForLines(sectionPrefix, width);
  const overflowRows = countRowsForLines([fmt.muted("(+0 more workers)")], width);
  const minVisibleRows = prefixRows + 1;
  if (remainingRows < minVisibleRows) {
    return [];
  }

  let visibleCount = 0;
  let usedRows = prefixRows;
  while (visibleCount < workerRows.length) {
    const workerLine = renderWorkerRow(workerRows[visibleCount]!, fmt, width);
    const workerLineRows = countRenderedRows(workerLine, width);
    const remainingWorkers = workerRows.length - (visibleCount + 1);
    const requiredOverflowRows = remainingWorkers > 0 ? overflowRows : 0;
    if (usedRows + workerLineRows + requiredOverflowRows > remainingRows) {
      break;
    }
    usedRows += workerLineRows;
    visibleCount += 1;
  }

  if (visibleCount === 0) {
    return [];
  }

  const lines = [...sectionPrefix];
  for (let index = 0; index < visibleCount; index += 1) {
    lines.push(renderWorkerRow(workerRows[index]!, fmt, width));
  }
  const hidden = workerRows.length - visibleCount;
  if (hidden > 0) {
    lines.push(fmt.muted(`(+${hidden} more workers)`));
  }
  return lines;
};

export const buildDashboardViewModel = (
  state: DashboardState,
  nowMs = Date.now()
): DashboardVM => {
  const elapsedMs = Math.max(0, nowMs - state.startedAtMs);
  const novelty = state.noveltyRate === null ? "—" : state.noveltyRate.toFixed(3);
  const noveltyThreshold =
    state.noveltyThreshold === null ? "—" : state.noveltyThreshold.toFixed(3);
  const meanMaxSimilarity =
    state.meanMaxSimilarity === null ? "—" : state.meanMaxSimilarity.toFixed(3);
  const similarityThreshold =
    state.similarityThreshold === null ? "—" : state.similarityThreshold.toFixed(3);

  const monitoringRows = [
    { key: "Novelty rate", value: `${novelty} (threshold ${noveltyThreshold})` },
    { key: "Patience", value: `${state.lowNoveltyStreak}/${state.patience}` },
    { key: "Status", value: state.stopState }
  ];

  if (state.groupingEnabled) {
    monitoringRows.push({
      key: "Embedding groups",
      value: state.groupCount === null ? "—" : String(state.groupCount)
    });
  }
  if (state.similarityThreshold !== null) {
    monitoringRows.push({
      key: "Similarity",
      value: `${meanMaxSimilarity} (threshold ${similarityThreshold})`
    });
  }

  const caveatLines: RenderLine[] = [{ text: UI_COPY.stoppingCaveat, tone: "muted" }];
  if (state.groupingEnabled) {
    caveatLines.push({ text: UI_COPY.groupingCaveat, tone: "muted" });
  }
  if (state.stopState === "user requested graceful stop") {
    caveatLines.push({ text: UI_COPY.gracefulStopRequested, tone: "warn" });
  }

  const workerRows: WorkerRow[] = Array.from(state.workerStatus.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([workerId, workerState]) => ({
      id: workerId,
      state: workerState.status,
      trialId: workerState.trialId,
      model: workerState.trialId !== undefined ? state.trialModelById.get(workerState.trialId) ?? "—" : "—",
      tick: state.renderTick
    }));

  const usageLines: RenderLine[] =
    state.mode === "mock"
      ? [{ text: "Usage not applicable", tone: "muted" }]
      : [
          { text: `Usage so far: ${toUsageSummary(state)}`, tone: "text" },
          ...(state.usage.cost !== undefined
            ? [{ text: `Cost: ${state.usage.cost.toFixed(6)} (estimate)`, tone: "warn" as const }]
            : [])
        ];

  return {
    statusContext: "run / monitoring",
    elapsedMs,
    progressLabel: `Trials: ${state.attempted}/${state.planned} · Workers: ${state.workers}`,
    progressPct: toPercent(state.attempted, state.planned),
    eta: formatEtaHMS(state),
    monitoringRows,
    caveatLines,
    workerRows,
    usageLines,
    footerText: "Ctrl+C graceful stop"
  };
};

export const buildRunDashboardText = (vm: DashboardVM, options: DashboardRenderOptions = {}): string => {
  const fmt = options.fmt ?? createStdoutFormatter();
  const width = options.width ?? fmt.termWidth();
  const maxRows = options.maxRows;
  const compact = maxRows !== undefined && maxRows <= 18;
  const elapsed = formatClockHMS(vm.elapsedMs);
  const masterBar = renderProgressBar(
    vm.progressPct,
    Math.min(MASTER_BAR_MAX, Math.max(10, width - 34)),
    fmt.brand,
    fmt
  );
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

  pushBlock([renderStatusStrip(vm.statusContext, vm.elapsedMs, width, fmt), renderSeparator(width, fmt)], true);
  if (!compact) {
    pushBlock([""]);
  }
  pushBlock(
    [
      renderRuledSection("PROGRESS", width, fmt),
      ...(compact ? [] : [""]),
      vm.progressLabel,
      `${masterBar}  ${String(Math.round(vm.progressPct)).padStart(3, " ")}%    ${elapsed}  ETA ${vm.eta}`
    ],
    true
  );
  if (!compact) {
    pushBlock([""]);
  }

  const monitoringBlock = [
    renderRuledSection("MONITORING", width, fmt),
    ...(compact ? [] : [""]),
    ...vm.monitoringRows.map((row) => renderKV(row.key, row.value, fmt))
  ];
  pushBlock(monitoringBlock, true);

  const caveatBlock = vm.caveatLines.map((line) => renderToneLine(line, fmt));
  pushBlock(compact ? caveatBlock : ["", ...caveatBlock], true);

  const footerBlock = compact
    ? [renderSeparator(width, fmt), fmt.muted(vm.footerText)]
    : ["", renderSeparator(width, fmt), fmt.muted(vm.footerText)];
  const footerRows = countRowsForLines(footerBlock, width);

  const remainingBeforeFooter = maxRows === undefined ? Number.POSITIVE_INFINITY : Math.max(0, maxRows - usedRows - footerRows);
  const workerBlock = buildWorkerSection(vm.workerRows, fmt, width, compact, remainingBeforeFooter);
  if (workerBlock.length > 0) {
    pushBlock(compact ? workerBlock : ["", ...workerBlock]);
  }

  const usageBlock = [
    renderRuledSection("USAGE", width, fmt),
    ...(compact ? [] : [""]),
    ...vm.usageLines.map((line) => renderToneLine(line, fmt))
  ];
  pushBlock(compact ? usageBlock : ["", ...usageBlock]);

  pushBlock(compact ? [renderSeparator(width, fmt), fmt.muted(vm.footerText)] : ["", renderSeparator(width, fmt), fmt.muted(vm.footerText)], true);

  return `${sections.join("\n")}\n`;
};

class RunDashboardMonitor {
  private readonly bus: EventBus;
  private readonly snapshot: DashboardState;
  private readonly unsubs: Array<() => void> = [];
  private readonly prefixRows: number;
  private lastTopRow = 1;
  private lastLiveRows = MIN_DASHBOARD_ROWS;
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
      const nextRow = Math.min(terminalRows, this.lastTopRow + this.lastLiveRows);
      process.stdout.write(`\x1b[${nextRow};1H\n`);
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
    const visiblePrefixRows = Math.min(
      this.prefixRows,
      Math.max(0, terminalRows - MIN_DASHBOARD_ROWS)
    );
    const topRow = Math.min(Math.max(1, visiblePrefixRows + 1), terminalRows);
    const liveRows = Math.max(1, terminalRows - visiblePrefixRows);
    const frameText = buildRunDashboardText(buildDashboardViewModel(this.snapshot, Date.now()), {
      width: terminalColumns,
      maxRows: liveRows
    }).replace(/\n+$/, "");

    process.stdout.write(`\x1b[${topRow};${terminalRows}r`);
    process.stdout.write(`\x1b[${topRow};1H\x1b[J`);
    process.stdout.write(frameText);
    this.lastTopRow = topRow;
    this.lastLiveRows = liveRows;
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

export const buildReceiptViewModel = (runDir: string): ReceiptVM => {
  const model = buildReceiptModel(runDir);
  const stopBanner = toStopBanner(model.stop_reason);
  const stopReasonLabel = stopBanner.replace(/^Stopped:\s*/i, "").trim() || "unknown";
  const summaryRows = [
    { key: "Stop reason", value: stopReasonLabel },
    {
      key: "Trials",
      value: `${model.counts.k_planned ?? "-"} / ${model.counts.k_attempted ?? "-"} / ${model.counts.k_eligible ?? "-"} (planned / completed / eligible)`
    },
    { key: "Duration", value: toDurationFromIso(model.started_at, model.completed_at) },
    {
      key: "Usage",
      value: model.usage
        ? `${model.usage.totals.total_tokens} tokens (in ${model.usage.totals.prompt_tokens}, out ${model.usage.totals.completion_tokens})`
        : "not available"
    },
    { key: "Protocol", value: model.protocol ?? "-" },
    { key: "Models", value: `${model.model_count}` },
    { key: "Personas", value: `${model.persona_count}` }
  ];

  const groupLines: RenderLine[] = [];
  if (model.grouping?.enabled) {
    groupLines.push({ text: `Embedding groups: ${model.grouping.group_count ?? "—"}`, tone: "text" });
    groupLines.push({ text: "Top group sizes", tone: "text" });
    groupLines.push({
      text: model.grouping.group_count !== undefined ? String(model.grouping.group_count) : "—",
      tone: "text"
    });
    groupLines.push({ text: UI_COPY.groupingCaveat, tone: "muted" });
  }

  const artifactRows: string[] = [ "Only generated files are listed." ];
  if ((model.artifacts?.length ?? 0) === 0) {
    artifactRows.push("—");
  } else {
    const paths = model.artifacts?.map((artifact) => artifact.path) ?? [];
    for (let index = 0; index < paths.length; index += 3) {
      artifactRows.push(paths.slice(index, index + 3).join("    "));
    }
  }
  if ((model.counts.k_eligible ?? 0) === 0) {
    artifactRows.push("No embeddings were generated because there were zero eligible trials.");
  }

  return {
    statusContext: "run / receipt",
    stopBanner,
    caveatLines: [{ text: UI_COPY.stoppingCaveat, tone: "muted" }],
    summaryRows,
    groupLines,
    artifactRows,
    reproduceCommand: `arbiter run --config ${runDir}/config.resolved.json`,
    footerText: "Run complete."
  };
};

export const buildReceiptDisplayText = (vm: ReceiptVM, options: ReceiptRenderOptions = {}): string => {
  const fmt = options.fmt ?? createStdoutFormatter();
  const width = options.width ?? fmt.termWidth();
  const lines: string[] = [
    renderStatusStrip(vm.statusContext, 0, width, fmt),
    renderSeparator(width, fmt),
    "",
    renderRuledSection("RECEIPT", width, fmt),
    "",
    vm.stopBanner,
    ...vm.caveatLines.map((line) => renderToneLine(line, fmt)),
    "",
    renderRuledSection("SUMMARY", width, fmt),
    "",
    ...vm.summaryRows.map((row) => renderKV(row.key, row.value, fmt))
  ];

  if (vm.groupLines.length > 0) {
    lines.push("");
    lines.push(renderRuledSection("GROUPS", width, fmt));
    lines.push("");
    lines.push(...vm.groupLines.map((line) => renderToneLine(line, fmt)));
  }

  lines.push("");
  lines.push(renderRuledSection("ARTIFACTS", width, fmt));
  lines.push("");
  lines.push(...vm.artifactRows.map((line) => fmt.muted(line)));
  lines.push("");
  lines.push(renderRuledSection("REPRODUCE", width, fmt));
  lines.push("");
  lines.push(vm.reproduceCommand);
  lines.push("");
  lines.push(renderSeparator(width, fmt));
  lines.push(fmt.muted(vm.footerText));
  return `${lines.join("\n")}\n`;
};

const buildReceiptDisplayTextFromRunDir = (runDir: string): string | null => {
  try {
    return buildReceiptDisplayText(buildReceiptViewModel(runDir));
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
  let dashboardActive = false;
  let usePlainReceipt = false;

  return {
    onRunSetup: (context): void => {
      if (!dashboardEnabled) {
        return;
      }
      const terminalSupport = getDashboardTerminalSupport(process.stdout);
      if (!terminalSupport.ok) {
        usePlainReceipt = true;
        process.stdout.write(`${UI_COPY.dashboardTerminalTooSmall}\n`);
        dashboardActive = false;
        return;
      }
      usePlainReceipt = false;
      let prefixRows = 0;
      if (stackPrefixText && stackPrefixText.trim().length > 0) {
        const prefixText = stackPrefixText.replace(/\n+$/, "");
        prefixRows = countRenderedRows(prefixText, Math.max(1, process.stdout.columns ?? 80));
        process.stdout.write(`${prefixText}\n`);
      }
      monitor = new RunDashboardMonitor(context, prefixRows);
      monitor.attach();
      dashboardActive = true;
    },
    onRunFinally: async (context): Promise<void> => {
      if (monitor) {
        monitor.detach();
        monitor = null;
      }

      if ((!dashboardEnabled && !dashboardActive) || context.receiptMode === "skip") {
        return;
      }

      const receiptText = readReceiptText(context.runDir);
      if (usePlainReceipt) {
        if (receiptText) {
          process.stdout.write(receiptText);
          return;
        }
        context.warningSink.warn("receipt.txt missing after run completion", "receipt");
        return;
      }
      const receiptDisplayText = buildReceiptDisplayTextFromRunDir(context.runDir);
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
