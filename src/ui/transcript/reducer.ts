import type { Event } from "../../events/types.js";
import type { WarningRecord } from "../../utils/warnings.js";
import type { AppState, RunMode, TranscriptEntryKind } from "./state.js";
import { resetRunProgress } from "./state.js";

let entryCounter = 0;

const nextEntryId = (): string => {
  entryCounter += 1;
  return `entry-${entryCounter}`;
};

export const appendTranscript = (
  state: AppState,
  kind: TranscriptEntryKind,
  content: string,
  timestamp = new Date().toISOString()
): void => {
  state.transcript.push({
    id: nextEntryId(),
    kind,
    content,
    timestamp
  });
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

export const applyRunEvent = (state: AppState, event: Event): void => {
  switch (event.type) {
    case "run.started": {
      state.runProgress.active = true;
      state.runProgress.planned = event.payload.k_planned ?? state.runProgress.planned;
      appendTranscript(
        state,
        "status",
        `run started: ${event.payload.run_id} | protocol ${event.payload.resolved_config.protocol.type} | planned ${event.payload.k_planned ?? "-"}`,
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
          "requested and actual models differ for some trials; see trials.jsonl actual_model",
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
          "some calls required retries; inspect trials.jsonl retry counts",
          "runtime"
        );
      }

      if (record.status === "model_unavailable") {
        appendWarningOnce(
          state,
          "model-unavailable",
          "some trials failed with model_unavailable",
          "runtime"
        );
      }

      if (record.error && parseRateLimit(record.error.message, record.error.code ?? null)) {
        appendWarningOnce(
          state,
          "rate-limit",
          "rate-limit errors occurred; some trials may have failed",
          "runtime"
        );
      }

      if (record.status !== "success") {
        appendTranscript(
          state,
          "status",
          `trial ${record.trial_id} status: ${record.status}`,
          record.attempt?.completed_at ?? new Date().toISOString()
        );
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
      appendTranscript(
        state,
        "progress",
        `batch ${event.payload.batch_number} started (${event.payload.trial_ids.length} trials)`
      );
      break;
    }

    case "batch.completed": {
      state.runProgress.currentBatch = undefined;
      appendTranscript(
        state,
        "progress",
        `batch ${event.payload.batch_number} complete in ${event.payload.elapsed_ms}ms (${event.payload.trial_ids.length} trials)`
      );
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
      state.runProgress.noveltyTrend = [...state.runProgress.noveltyTrend.slice(-12), record.novelty_rate ?? null];
      state.runProgress.stopStatus = {
        mode: record.stop.mode,
        wouldStop: record.stop.would_stop,
        shouldStop: record.stop.should_stop
      };
      appendTranscript(
        state,
        "progress",
        `convergence batch ${record.batch_number}: novelty ${record.novelty_rate ?? "null"}, mean_sim ${record.mean_max_sim_to_prior ?? "null"}, clusters ${record.cluster_count}`
      );
      break;
    }

    case "run.completed": {
      state.runProgress.active = false;
      state.phase = "post-run";
      appendTranscript(
        state,
        "status",
        `run complete: ${formatStopReason(event.payload.stop_reason)}${event.payload.incomplete ? " (incomplete)" : ""}`,
        event.payload.completed_at
      );
      if (state.runProgress.parseFallback > 0) {
        appendWarningOnce(
          state,
          "parse-fallback",
          `${state.runProgress.parseFallback} trial(s) used fallback parsing; review parsed.jsonl`,
          "parsing"
        );
      }
      if (state.runProgress.parseFailed > 0) {
        appendWarningOnce(
          state,
          "parse-failed",
          `${state.runProgress.parseFailed} trial(s) had failed parsing`,
          "parsing"
        );
      }
      break;
    }

    case "run.failed": {
      state.runProgress.active = false;
      state.phase = "post-run";
      appendTranscript(state, "error", `run failed: ${event.payload.error}`, event.payload.completed_at);
      break;
    }

    default:
      break;
  }
};
