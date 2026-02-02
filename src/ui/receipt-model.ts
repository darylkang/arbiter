import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { ArbiterRunManifest } from "../generated/manifest.types.js";
import type { ArbiterResolvedConfig } from "../generated/config.types.js";
import type { ArbiterEmbeddingsProvenance } from "../generated/embeddings-provenance.types.js";
import type { ArbiterConvergenceTraceRecord } from "../generated/convergence-trace.types.js";
import type { ArbiterOnlineClusteringState } from "../generated/cluster-state.types.js";

const readJsonIfExists = <T>(path: string): T | undefined => {
  if (!existsSync(path)) {
    return undefined;
  }
  const raw = readFileSync(path, "utf8");
  return JSON.parse(raw) as T;
};

const readLastJsonlRecord = <T>(path: string): T | undefined => {
  if (!existsSync(path)) {
    return undefined;
  }
  const raw = readFileSync(path, "utf8").trim();
  if (!raw) {
    return undefined;
  }
  const lines = raw.split("\n").filter(Boolean);
  const last = lines[lines.length - 1];
  return last ? (JSON.parse(last) as T) : undefined;
};

const truncate = (value: string, max = 120): string =>
  value.length > max ? `${value.slice(0, max - 1)}…` : value;

export type ReceiptModel = {
  run_id: string;
  run_dir: string;
  stop_reason?: string;
  incomplete?: boolean;
  started_at?: string;
  completed_at?: string;
  question?: string;
  protocol?: string;
  model_summary?: string;
  counts: {
    k_planned?: number;
    k_attempted?: number;
    k_eligible?: number;
    k_min?: number;
    k_min_count_rule?: string;
  };
  embeddings?: {
    status?: string;
    dimensions?: number | null;
    primary_format?: string;
  };
  convergence?: {
    batch_number?: number;
    novelty_rate?: number | null;
    mean_max_sim_to_prior?: number | null;
    cluster_count?: number;
    new_clusters_this_batch?: number;
    largest_cluster_share?: number;
    js_divergence?: number | null;
    cluster_limit_hit?: boolean;
    forced_assignments_this_batch?: number;
    forced_assignments_cumulative?: number;
  };
  clustering?: {
    enabled: boolean;
    cluster_count?: number;
  };
  artifacts?: { path: string; record_count?: number }[];
};

export const buildReceiptModel = (runDir: string): ReceiptModel => {
  const manifestPath = resolve(runDir, "manifest.json");
  const manifest = readJsonIfExists<ArbiterRunManifest>(manifestPath);
  if (!manifest) {
    throw new Error("manifest.json not found; cannot build receipt");
  }

  const config = readJsonIfExists<ArbiterResolvedConfig>(
    resolve(runDir, "config.resolved.json")
  );
  const embeddings = readJsonIfExists<ArbiterEmbeddingsProvenance>(
    resolve(runDir, "embeddings.provenance.json")
  );
  const convergence = readLastJsonlRecord<ArbiterConvergenceTraceRecord>(
    resolve(runDir, "convergence_trace.jsonl")
  );
  const clusterState = readJsonIfExists<ArbiterOnlineClusteringState>(
    resolve(runDir, "clusters", "online.state.json")
  );

  const modelSummary = config?.sampling?.models
    ? config.sampling.models
        .map((model) => `${model.model}${model.weight !== undefined ? ` (w=${model.weight})` : ""}`)
        .join(", ")
    : undefined;

  const clusteringEnabled = Boolean(config?.measurement?.clustering?.enabled);

  return {
    run_id: manifest.run_id,
    run_dir: runDir,
    stop_reason: manifest.stop_reason,
    incomplete: manifest.incomplete,
    started_at: manifest.started_at ?? manifest.timestamps?.started_at,
    completed_at: manifest.completed_at ?? manifest.timestamps?.completed_at,
    question: config?.question?.text ? truncate(config.question.text) : undefined,
    protocol: config?.protocol?.type,
    model_summary: modelSummary,
    counts: {
      k_planned: manifest.k_planned,
      k_attempted: manifest.k_attempted,
      k_eligible: manifest.k_eligible,
      k_min: manifest.k_min,
      k_min_count_rule: manifest.k_min_count_rule
    },
    embeddings: embeddings
      ? {
          status: embeddings.status,
          dimensions: embeddings.dimensions ?? null,
          primary_format: embeddings.primary_format
        }
      : undefined,
    convergence: convergence
      ? {
          batch_number: convergence.batch_number,
          novelty_rate: convergence.novelty_rate,
          mean_max_sim_to_prior: convergence.mean_max_sim_to_prior,
          cluster_count: convergence.cluster_count,
          new_clusters_this_batch: convergence.new_clusters_this_batch,
          largest_cluster_share: convergence.largest_cluster_share,
          js_divergence: convergence.js_divergence,
          cluster_limit_hit: convergence.cluster_limit_hit,
          forced_assignments_this_batch: convergence.forced_assignments_this_batch,
          forced_assignments_cumulative: convergence.forced_assignments_cumulative
        }
      : undefined,
    clustering: {
      enabled: clusteringEnabled,
      cluster_count: clusterState?.clusters?.length
    },
    artifacts: manifest.artifacts?.entries?.map((entry) => ({
      path: entry.path,
      record_count: entry.record_count
    }))
  };
};
