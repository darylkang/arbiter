import type { Event } from "../../events/types.js";
import type { WarningRecord } from "../../utils/warnings.js";
import type { AppState, RunMode, TranscriptEntryKind } from "./state.js";
import { resetRunProgress } from "./state.js";

const MAX_TRANSCRIPT_ENTRIES = 1000;

const nextEntryId = (state: AppState): string => {
  const current = state.nextTranscriptEntryId;
  state.nextTranscriptEntryId += 1;
  return `entry-${current}`;
};

export const appendTranscript = (
  state: AppState,
  kind: TranscriptEntryKind,
  content: string,
  timestamp = new Date().toISOString()
): void => {
  state.transcript.push({
    id: nextEntryId(state),
    kind,
    content,
    timestamp
  });
  if (state.transcript.length > MAX_TRANSCRIPT_ENTRIES) {
    state.transcript.splice(0, state.transcript.length - MAX_TRANSCRIPT_ENTRIES);
  }
};

export const appendWarning = (state: AppState, warning: WarningRecord): void => {
  state.warnings.push(warning);
  appendTranscript(
    state,
    "warning",
    `${warning.source ? `[${warning.source}] ` : ""}${warning.message}`,
    warning.recorded_at
  );
};

export const appendWarningOnce = (
  state: AppState,
  key: string,
  message: string,
  source?: string
): void => {
  if (state.warningKeys.has(key)) {
    return;
  }
  state.warningKeys.add(key);
  appendWarning(state, {
    message,
    source,
    recorded_at: new Date().toISOString()
  });
};

export const beginRun = (state: AppState, mode: RunMode): void => {
  state.phase = "running";
  state.runMode = mode;
  resetRunProgress(state);
  state.warningKeys.clear();
  state.warnings = [];
};

const parseRateLimit = (message?: string, code?: string | null): boolean => {
  const combined = `${code ?? ""} ${message ?? ""}`.toLowerCase();
  return combined.includes("rate") && combined.includes("limit");
};

const formatStopReason = (stopReason: string): string => {
  switch (stopReason) {
    case "k_max_reached":
      return "k_max reached";
    case "converged":
      return "converged";
    case "user_interrupt":
      return "user interrupted";
    case "completed":
      return "completed";
    case "error":
      return "error";
    default:
      return stopReason;
  }
};

const formatBatchStatusSummary = (counts: Record<string, number>): string | null => {
  const entries = Object.entries(counts).filter(([, count]) => count > 0);
  if (entries.length === 0) {
    return null;
  }
  return entries
    .map(([status, count]) => `${count} ${status}`)
    .join(" • ");
};

const assertNeverEvent = (event: never): never => {
  throw new Error(`Unhandled event type: ${JSON.stringify(event)}`);
};

export const applyRunEvent = (state: AppState, event: Event): void => {
  switch (event.type) {
    case "run.started": {
      state.runProgress.active = true;
      state.runProgress.planned = event.payload.k_planned ?? state.runProgress.planned;
      const workers = event.payload.resolved_config?.execution?.workers;
      if (typeof workers === "number" && workers > 0) {
        state.runProgress.workerCount = workers;
      }
      appendTranscript(
        state,
        "status",
        `Run started: ${event.payload.run_id}. Planned trials: ${event.payload.k_planned ?? "-"}.`,
        event.payload.started_at
      );
      break;
    }

    case "trial.completed": {
      const { trial_record: record } = event.payload;
      state.runProgress.attempted += 1;

      if (state.runProgress.currentBatch && state.runProgress.currentBatch.completed < state.runProgress.currentBatch.total) {
        state.runProgress.currentBatch = {
          ...state.runProgress.currentBatch,
          completed: state.runProgress.currentBatch.completed + 1
        };
      }

      const usage = record.usage;
      if (usage) {
        state.runProgress.usage.prompt += usage.prompt_tokens;
        state.runProgress.usage.completion += usage.completion_tokens;
        state.runProgress.usage.total += usage.total_tokens;
        if (usage.cost !== undefined) {
          state.runProgress.usage.cost = (state.runProgress.usage.cost ?? 0) + usage.cost;
        }
      }

      if (record.actual_model && record.requested_model_slug && record.actual_model !== record.requested_model_slug) {
        appendWarningOnce(
          state,
          "model-mismatch",
          "Requested and actual models differ for some trials. See trials.jsonl actual_model.",
          "provenance"
        );
      }

      const retryCount = record.attempt?.retry_count ?? 0;
      const callRetries = Array.isArray(record.calls)
        ? record.calls.some((call) => (call.attempt?.retry_count ?? 0) > 0)
        : false;
      if (retryCount > 0 || callRetries) {
        appendWarningOnce(
          state,
          "retries",
          "Some calls required retries. Inspect trials.jsonl retry counts.",
          "runtime"
        );
      }

      if (record.status === "model_unavailable") {
        appendWarningOnce(
          state,
          "model-unavailable",
          "Some trials failed with model_unavailable.",
          "runtime"
        );
      }

      if (record.error && parseRateLimit(record.error.message, record.error.code ?? null)) {
        appendWarningOnce(
          state,
          "rate-limit",
          "Rate-limit errors occurred. Some trials may have failed.",
          "runtime"
        );
      }

      if (record.status !== "success") {
        state.runProgress.batchStatusCounts[record.status] =
          (state.runProgress.batchStatusCounts[record.status] ?? 0) + 1;
      }
      break;
    }

    case "parsed.output": {
      const status = event.payload.parsed_record.parse_status;
      if (status === "success") {
        state.runProgress.parseSuccess += 1;
      } else if (status === "fallback") {
        state.runProgress.parseFallback += 1;
      } else if (status === "failed") {
        state.runProgress.parseFailed += 1;
      }
      break;
    }

    case "embedding.recorded": {
      if (event.payload.embedding_record.embedding_status === "success") {
        state.runProgress.eligible += 1;
      }
      break;
    }

    case "batch.started": {
      state.runProgress.currentBatch = {
        batchNumber: event.payload.batch_number,
        total: event.payload.trial_ids.length,
        completed: 0
      };
      state.runProgress.batchStatusCounts = {};
      break;
    }

    case "batch.completed": {
      const elapsed = event.payload.elapsed_ms;
      const trialCount = event.payload.trial_ids.length;
      const batchNumber = event.payload.batch_number;
      state.runProgress.currentBatch = undefined;
      appendTranscript(
        state,
        "progress",
        `Batch ${batchNumber} complete in ${elapsed}ms (${trialCount} trials).`
      );

      const summary = formatBatchStatusSummary(state.runProgress.batchStatusCounts);
      if (summary) {
        appendTranscript(state, "status", `Batch ${batchNumber} statuses: ${summary}.`);
      }
      break;
    }

    case "convergence.record": {
      const record = event.payload.convergence_record;
      state.runProgress.recentBatches = [
        ...state.runProgress.recentBatches.slice(-2),
        {
          batchNumber: record.batch_number,
          noveltyRate: record.novelty_rate ?? null,
          meanMaxSim: record.mean_max_sim_to_prior ?? null,
          clusterCount: record.cluster_count
        }
      ];
      state.runProgress.noveltyTrend = [
        ...state.runProgress.noveltyTrend.slice(-12),
        record.novelty_rate ?? null
      ];
      state.runProgress.stopStatus = {
        mode: record.stop.mode,
        wouldStop: record.stop.would_stop,
        shouldStop: record.stop.should_stop
      };
      break;
    }

    case "run.completed": {
      state.runProgress.active = false;
      state.phase = "post-run";
      appendTranscript(
        state,
        "status",
        `Run complete: ${formatStopReason(event.payload.stop_reason)}${event.payload.incomplete ? " (incomplete)" : ""}.`,
        event.payload.completed_at
      );
      if (state.runProgress.parseFallback > 0) {
        appendWarningOnce(
          state,
          "parse-fallback",
          `${state.runProgress.parseFallback} trial(s) used fallback parsing. Review parsed.jsonl.`,
          "parsing"
        );
      }
      if (state.runProgress.parseFailed > 0) {
        appendWarningOnce(
          state,
          "parse-failed",
          `${state.runProgress.parseFailed} trial(s) had failed parsing.`,
          "parsing"
        );
      }
      break;
    }

    case "run.failed": {
      state.runProgress.active = false;
      state.phase = "post-run";
      appendTranscript(state, "error", `Run failed: ${event.payload.error}`, event.payload.completed_at);
      break;
    }

    case "trial.planned":
    case "embeddings.finalized":
    case "cluster.assigned":
    case "clusters.state":
    case "aggregates.computed":
    case "artifact.written":
    case "warning.raised":
      break;

    default:
      assertNeverEvent(event);
  }
};
