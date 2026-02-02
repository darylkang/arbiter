import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { ArbiterRunManifest } from "../generated/manifest.types.js";
import type { ArbiterResolvedConfig } from "../generated/config.types.js";
import type { ArbiterConvergenceTraceRecord } from "../generated/convergence-trace.types.js";
import type { ArbiterParsedOutputRecord } from "../generated/parsed-output.types.js";
import type { ArbiterTrialRecord } from "../generated/trial.types.js";
import type { ArbiterOnlineClusteringState } from "../generated/cluster-state.types.js";

const readJsonIfExists = <T>(path: string): T | undefined => {
  if (!existsSync(path)) {
    return undefined;
  }
  const raw = readFileSync(path, "utf8");
  return JSON.parse(raw) as T;
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
  policy?: ArbiterRunManifest["policy"];
  usage?: ArbiterRunManifest["usage"];
  novelty?: {
    last_novelty_rate?: number | null;
    last_mean_max_sim?: number | null;
    trend?: "up" | "down" | "flat" | "unknown";
  };
  contract?: {
    enabled: boolean;
    parse_status_counts: Record<string, number>;
    decision_counts: Record<string, number>;
    exemplars: Record<string, string[]>;
  };
  clustering?: {
    enabled: boolean;
    cluster_count?: number;
    top_clusters?: Array<{ cluster_id: number; member_count: number; exemplar_trial_id: number }>;
  };
  artifacts?: string[];
};

const computeTrend = (
  records: ArbiterConvergenceTraceRecord[]
): "up" | "down" | "flat" | "unknown" => {
  if (records.length < 2) {
    return "unknown";
  }
  const prev = records[records.length - 2].novelty_rate;
  const last = records[records.length - 1].novelty_rate;
  if (prev === null || prev === undefined || last === null || last === undefined) {
    return "unknown";
  }
  const delta = last - prev;
  if (Math.abs(delta) < 0.01) {
    return "flat";
  }
  return delta > 0 ? "up" : "down";
};

export const buildReportModel = (runDir: string, topN = 3): ReportModel => {
  const manifest = readJsonIfExists<ArbiterRunManifest>(resolve(runDir, "manifest.json"));
  if (!manifest) {
    throw new Error("manifest.json not found; cannot build report");
  }

  const config = readJsonIfExists<ArbiterResolvedConfig>(
    resolve(runDir, "config.resolved.json")
  );
  const trials = readJsonl<ArbiterTrialRecord>(resolve(runDir, "trials.jsonl"));
  const parsed = readJsonl<ArbiterParsedOutputRecord>(resolve(runDir, "parsed.jsonl"));
  const convergence = readJsonl<ArbiterConvergenceTraceRecord>(
    resolve(runDir, "convergence_trace.jsonl")
  );
  const clusterState = readJsonIfExists<ArbiterOnlineClusteringState>(
    resolve(runDir, "clusters", "online.state.json")
  );

  const statusCounts: Record<string, number> = {};
  for (const trial of trials) {
    statusCounts[trial.status] = (statusCounts[trial.status] ?? 0) + 1;
  }

  const parseStatusCounts: Record<string, number> = {};
  const decisionCounts: Record<string, number> = {};
  const exemplars: Record<string, string[]> = {};
  for (const record of parsed) {
    parseStatusCounts[record.parse_status] = (parseStatusCounts[record.parse_status] ?? 0) + 1;
    if (record.parse_status === "success" && record.outcome) {
      decisionCounts[record.outcome] = (decisionCounts[record.outcome] ?? 0) + 1;
      if (record.rationale) {
        const list = exemplars[record.outcome] ?? [];
        if (list.length < topN) {
          list.push(record.rationale);
          exemplars[record.outcome] = list;
        }
      }
    }
  }

  const clusteringEnabled = Boolean(config?.measurement?.clustering?.enabled);
  const clusters = clusterState?.clusters ?? [];
  const topClusters = clusters
    .slice()
    .sort((a, b) => b.member_count - a.member_count)
    .slice(0, topN)
    .map((cluster) => ({
      cluster_id: cluster.cluster_id,
      member_count: cluster.member_count,
      exemplar_trial_id: cluster.exemplar_trial_id
    }));

  const trend = computeTrend(convergence);
  const lastConvergence = convergence[convergence.length - 1];

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
    policy: manifest.policy,
    usage: manifest.usage,
    novelty: lastConvergence
      ? {
          last_novelty_rate: lastConvergence.novelty_rate ?? null,
          last_mean_max_sim: lastConvergence.mean_max_sim_to_prior ?? null,
          trend
        }
      : undefined,
    contract: config?.protocol?.decision_contract
      ? {
          enabled: true,
          parse_status_counts: parseStatusCounts,
          decision_counts: decisionCounts,
          exemplars
        }
      : undefined,
    clustering: clusteringEnabled
      ? {
          enabled: true,
          cluster_count: clusters.length,
          top_clusters: topClusters
        }
      : { enabled: false },
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
    `Counts: attempted ${model.counts.attempted ?? 0}, eligible ${model.counts.eligible ?? 0}, success ${model.counts.success ?? 0}, error ${model.counts.error ?? 0}, model_unavailable ${model.counts.model_unavailable ?? 0}, timeout_exhausted ${model.counts.timeout_exhausted ?? 0}`
  );

  if (model.policy) {
    lines.push(
      `Policy: strict=${model.policy.strict} allow_free=${model.policy.allow_free} allow_aliased=${model.policy.allow_aliased} contract_failure_policy=${model.policy.contract_failure_policy}`
    );
  }

  const usageLine = formatUsage(model.usage);
  if (usageLine) {
    lines.push(usageLine);
  }

  if (model.novelty) {
    const novelty = model.novelty.last_novelty_rate;
    const meanSim = model.novelty.last_mean_max_sim;
    lines.push(
      `Novelty: last=${novelty === null || novelty === undefined ? "null" : novelty.toFixed(3)} | mean_max_sim=${meanSim === null || meanSim === undefined ? "null" : meanSim.toFixed(3)} | trend=${model.novelty.trend}`
    );
  }

  if (model.contract?.enabled) {
    const parseCounts = model.contract.parse_status_counts;
    lines.push(
      `Contract: success ${parseCounts.success ?? 0}, fallback ${parseCounts.fallback ?? 0}, failed ${parseCounts.failed ?? 0}`
    );
    const decisions = Object.entries(model.contract.decision_counts);
    if (decisions.length > 0) {
      lines.push(
        `Decisions: ${decisions
          .map(([label, count]) => `${label}=${count}`)
          .join(", ")}`
      );
    }
  }

  if (model.clustering?.enabled) {
    lines.push(`Clustering: enabled (clusters ${model.clustering.cluster_count ?? 0})`);
    if (model.clustering.top_clusters && model.clustering.top_clusters.length > 0) {
      lines.push(
        `Top clusters: ${model.clustering.top_clusters
          .map((cluster) => `${cluster.cluster_id} (${cluster.member_count})`)
          .join(", ")}`
      );
    }
  } else {
    lines.push("Clustering: disabled");
  }

  if (model.artifacts && model.artifacts.length > 0) {
    lines.push(`Artifacts: ${model.artifacts.join(", ")}`);
  }

  lines.push(`Output: ${model.run_dir}`);
  return `${lines.join("\n")}\n`;
};

export const formatReportJson = (model: ReportModel): string =>
  `${JSON.stringify(model, null, 2)}\n`;
