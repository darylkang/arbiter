import type { EventPayloadMap } from "../../events/types.js";
import { UI_COPY } from "../copy.js";
import type { DashboardVM, RenderLine, WorkerRow } from "../runtime-view-models.js";

type WorkerViewStatus = "idle" | "running" | "finishing" | "error";

export type DashboardState = {
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

const formatEtaHMS = (state: DashboardState, nowMs: number): string => {
  if (state.attempted <= 0 || state.planned <= state.attempted) {
    return state.planned <= state.attempted ? "00:00:00" : "—";
  }
  const elapsedMs = Math.max(0, nowMs - state.startedAtMs);
  if (elapsedMs <= 0) {
    return "—";
  }
  const avgMsPerTrial = elapsedMs / state.attempted;
  if (!Number.isFinite(avgMsPerTrial) || avgMsPerTrial <= 0) {
    return "—";
  }
  return formatClockHMS(avgMsPerTrial * (state.planned - state.attempted));
};

const toPercent = (attempted: number, planned: number): number =>
  planned <= 0 ? 0 : Math.max(0, Math.min(100, (attempted / planned) * 100));

const toUsageSummary = (state: DashboardState): string =>
  `${state.usage.total} tokens (in ${state.usage.prompt}, out ${state.usage.completion})`;

export const mapStopStateFromMonitoring = (
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

export const mapStopStateFromCompletion = (
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

export const createDashboardState = (
  input: {
    runId: string;
    mode: "mock" | "live";
    resolvedConfig: EventPayloadMap["run.started"]["resolved_config"] | {
      execution: {
        k_min: number;
        stop_mode: "advisor" | "enforcer";
        stop_policy?: {
          novelty_epsilon?: number;
          similarity_threshold?: number;
          patience?: number;
        };
      };
      measurement: {
        clustering: {
          enabled: boolean;
          stop_mode?: string;
        };
      };
    };
  }
): DashboardState => {
  const stopPolicy = input.resolvedConfig.execution.stop_policy;
  return {
    runId: input.runId,
    questionExcerpt: "",
    mode: input.mode,
    protocolLabel: "Independent",
    groupingEnabled:
      input.resolvedConfig.measurement.clustering.enabled &&
      input.resolvedConfig.measurement.clustering.stop_mode !== "disabled",
    groupCount: null,
    planned: 0,
    attempted: 0,
    eligible: 0,
    workers: 1,
    kMinEligible: input.resolvedConfig.execution.k_min,
    stopMode: input.resolvedConfig.execution.stop_mode,
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
};

export const applyDashboardRunStarted = (
  state: DashboardState,
  payload: EventPayloadMap["run.started"]
): void => {
  const config = payload.resolved_config;
  state.questionExcerpt = toQuestionExcerpt(config.question.text, MAX_DASHBOARD_QUESTION_CHARS);
  state.protocolLabel = formatProtocolLabel(payload);
  state.workers = Math.max(1, config.execution.workers);
  state.planned = payload.k_planned ?? config.execution.k_max;
  state.kMinEligible = config.execution.k_min;
  state.stopMode = config.execution.stop_mode;
  state.noveltyThreshold = config.execution.stop_policy?.novelty_epsilon ?? state.noveltyThreshold;
  state.similarityThreshold =
    config.execution.stop_policy?.similarity_threshold ?? state.similarityThreshold;
  state.patience = config.execution.stop_policy?.patience ?? state.patience;
  state.startedAtMs = Date.now();
  state.lowNoveltyStreak = 0;
  state.noveltyRate = null;
  state.meanMaxSimilarity = null;
  state.groupCount = null;
  state.stopState = "sampling continues";
  state.workerStatus.clear();
  for (let workerId = 1; workerId <= state.workers; workerId += 1) {
    state.workerStatus.set(workerId, { status: "idle" });
  }
};

export const applyDashboardTrialCompleted = (
  state: DashboardState,
  payload: EventPayloadMap["trial.completed"]
): void => {
  state.attempted += 1;
  const usage = payload.trial_record.usage;
  if (!usage) {
    return;
  }
  state.usage.prompt += usage.prompt_tokens;
  state.usage.completion += usage.completion_tokens;
  state.usage.total += usage.total_tokens;
  if (usage.cost !== undefined) {
    state.usage.cost = (state.usage.cost ?? 0) + usage.cost;
  }
};

export const applyDashboardTrialPlanned = (
  state: DashboardState,
  payload: EventPayloadMap["trial.planned"]
): void => {
  state.trialModelById.set(payload.trial_id, payload.assigned_config.model);
};

export const applyDashboardEmbeddingRecorded = (
  state: DashboardState,
  payload: EventPayloadMap["embedding.recorded"]
): void => {
  if (payload.embedding_record.embedding_status === "success") {
    state.eligible += 1;
  }
};

export const applyDashboardWorkerStatus = (
  state: DashboardState,
  payload: EventPayloadMap["worker.status"]
): void => {
  state.workerStatus.set(payload.worker_id, {
    status: payload.status === "busy" ? "running" : "idle",
    trialId: payload.trial_id
  });
};

export const applyDashboardMonitoring = (
  state: DashboardState,
  payload: EventPayloadMap["monitoring.record"]
): void => {
  const record = payload.monitoring_record;
  state.noveltyRate = record.novelty_rate ?? null;
  state.meanMaxSimilarity = record.mean_max_sim_to_prior ?? null;
  state.stopState = mapStopStateFromMonitoring(record);

  if (state.groupingEnabled) {
    state.groupCount =
      typeof record.group_count === "number" ? record.group_count : state.groupCount;
  }

  const meetsLowNoveltyThresholds =
    record.has_eligible_in_batch &&
    record.k_eligible >= state.kMinEligible &&
    record.novelty_rate !== null &&
    record.mean_max_sim_to_prior !== null &&
    state.noveltyThreshold !== null &&
    state.similarityThreshold !== null &&
    record.novelty_rate <= state.noveltyThreshold &&
    record.mean_max_sim_to_prior >= state.similarityThreshold;

  state.lowNoveltyStreak = meetsLowNoveltyThresholds ? state.lowNoveltyStreak + 1 : 0;
};

export const applyDashboardRunCompleted = (
  state: DashboardState,
  payload: EventPayloadMap["run.completed"]
): void => {
  for (const [workerId, workerState] of state.workerStatus.entries()) {
    if (workerState.status === "running") {
      state.workerStatus.set(workerId, {
        status: "finishing",
        trialId: workerState.trialId
      });
    }
  }
  state.stopState = mapStopStateFromCompletion(payload.stop_reason);
};

export const applyDashboardRunFailed = (state: DashboardState): void => {
  for (const [workerId] of state.workerStatus.entries()) {
    state.workerStatus.set(workerId, { status: "error" });
  }
  state.stopState = "run failed";
};

export const tickDashboardState = (state: DashboardState): void => {
  state.renderTick += 1;
};

export const shouldAnimateDashboard = (state: DashboardState): boolean =>
  state.attempted < state.planned &&
  state.stopState !== "sampling complete" &&
  state.stopState !== "run failed" &&
  state.stopState !== "user requested graceful stop";

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
      model:
        workerState.trialId !== undefined ? state.trialModelById.get(workerState.trialId) ?? "—" : "—",
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
    eta: formatEtaHMS(state, nowMs),
    monitoringRows,
    caveatLines,
    workerRows,
    usageLines,
    footerText: "Ctrl+C graceful stop"
  };
};
