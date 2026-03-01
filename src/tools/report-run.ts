import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { ArbiterRunManifest } from "../generated/manifest.types.js";
import type { ArbiterResolvedConfig } from "../generated/config.types.js";
import type { ArbiterConvergenceTraceRecord } from "../generated/convergence-trace.types.js";
import type { ArbiterTrialRecord } from "../generated/trial.types.js";

const readJsonIfExists = <T>(path: string): T | undefined => {
  if (!existsSync(path)) {
    return undefined;
  }
  return JSON.parse(readFileSync(path, "utf8")) as T;
};

const readJsonl = <T>(path: string): T[] => {
  if (!existsSync(path)) {
    return [];
  }
  const raw = readFileSync(path, "utf8").trim();
  if (!raw) {
    return [];
  }
  return raw
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
};

export type ReportModel = {
  run_id: string;
  run_dir: string;
  stop_reason?: string;
  incomplete?: boolean;
  counts: {
    planned?: number;
    attempted?: number;
    eligible?: number;
    success?: number;
    error?: number;
    model_unavailable?: number;
    timeout_exhausted?: number;
  };
  usage?: ArbiterRunManifest["usage"];
  novelty?: {
    last_novelty_rate?: number | null;
    last_mean_max_sim?: number | null;
  };
  grouping?: {
    enabled: boolean;
    group_count?: number;
  };
  artifacts?: string[];
};

export const buildReportModel = (runDir: string): ReportModel => {
  const manifest = readJsonIfExists<ArbiterRunManifest>(resolve(runDir, "manifest.json"));
  if (!manifest) {
    throw new Error("manifest.json not found; cannot build report");
  }

  const config = readJsonIfExists<ArbiterResolvedConfig>(resolve(runDir, "config.resolved.json"));
  const trials = readJsonl<ArbiterTrialRecord>(resolve(runDir, "trials.jsonl"));
  const monitoring = readJsonl<ArbiterConvergenceTraceRecord>(resolve(runDir, "monitoring.jsonl"));

  const statusCounts: Record<string, number> = {};
  for (const trial of trials) {
    statusCounts[trial.status] = (statusCounts[trial.status] ?? 0) + 1;
  }

  const lastMonitoring = monitoring[monitoring.length - 1];

  return {
    run_id: manifest.run_id,
    run_dir: runDir,
    stop_reason: manifest.stop_reason,
    incomplete: manifest.incomplete,
    counts: {
      planned: manifest.k_planned,
      attempted: manifest.k_attempted,
      eligible: manifest.k_eligible,
      success: statusCounts.success ?? 0,
      error: statusCounts.error ?? 0,
      model_unavailable: statusCounts.model_unavailable ?? 0,
      timeout_exhausted: statusCounts.timeout_exhausted ?? 0
    },
    usage: manifest.usage,
    novelty: lastMonitoring
      ? {
          last_novelty_rate: lastMonitoring.novelty_rate ?? null,
          last_mean_max_sim: lastMonitoring.mean_max_sim_to_prior ?? null
        }
      : undefined,
    grouping: {
      enabled: Boolean(config?.measurement.clustering.enabled),
      group_count: typeof lastMonitoring?.cluster_count === "number" ? lastMonitoring.cluster_count : undefined
    },
    artifacts: manifest.artifacts?.entries?.map((entry) => entry.path)
  };
};

const formatUsage = (usage?: ArbiterRunManifest["usage"]): string | undefined => {
  if (!usage) {
    return undefined;
  }
  const totals = usage.totals;
  const cost = totals.cost !== undefined ? ` | cost ${totals.cost.toFixed(6)}` : "";
  return `Tokens: in ${totals.prompt_tokens}, out ${totals.completion_tokens}, total ${totals.total_tokens}${cost}`;
};

export const formatReportText = (model: ReportModel): string => {
  const lines: string[] = [];
  lines.push("Arbiter Report");
  lines.push(`Run ID: ${model.run_id}`);
  lines.push(`Status: ${model.stop_reason ?? "unknown"}${model.incomplete ? " (incomplete)" : ""}`);
  lines.push(
    `Counts: planned ${model.counts.planned ?? 0}, attempted ${model.counts.attempted ?? 0}, eligible ${model.counts.eligible ?? 0}, success ${model.counts.success ?? 0}, error ${model.counts.error ?? 0}`
  );

  const usageLine = formatUsage(model.usage);
  if (usageLine) {
    lines.push(usageLine);
  }

  if (model.novelty) {
    lines.push(
      `Novelty: last=${model.novelty.last_novelty_rate ?? "-"} | mean_max_sim=${model.novelty.last_mean_max_sim ?? "-"}`
    );
  }

  if (model.grouping?.enabled) {
    lines.push(`Embedding groups: enabled${model.grouping.group_count !== undefined ? ` (${model.grouping.group_count})` : ""}`);
  } else {
    lines.push("Embedding groups: disabled");
  }

  if (model.artifacts && model.artifacts.length > 0) {
    lines.push(`Artifacts: ${model.artifacts.join(", ")}`);
  }

  lines.push(`Output: ${model.run_dir}`);
  return `${lines.join("\n")}\n`;
};

export const formatReportJson = (model: ReportModel): string => `${JSON.stringify(model, null, 2)}\n`;
