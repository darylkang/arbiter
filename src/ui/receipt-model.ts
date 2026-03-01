import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { ArbiterRunManifest } from "../generated/manifest.types.js";
import type { ArbiterResolvedConfig } from "../generated/config.types.js";
import type { ArbiterMonitoringRecord } from "../generated/monitoring.types.js";
import type { ArbiterOnlineGroupingState } from "../generated/group-state.types.js";

const readJsonIfExists = <T>(path: string): T | undefined => {
  if (!existsSync(path)) {
    return undefined;
  }
  return JSON.parse(readFileSync(path, "utf8")) as T;
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
  return lines.length > 0 ? (JSON.parse(lines[lines.length - 1]) as T) : undefined;
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
  model_count: number;
  persona_count: number;
  counts: {
    k_planned?: number;
    k_attempted?: number;
    k_eligible?: number;
  };
  usage?: ArbiterRunManifest["usage"];
  monitoring?: {
    novelty_rate?: number | null;
    mean_max_sim_to_prior?: number | null;
    group_count?: number;
  };
  grouping?: {
    enabled: boolean;
    group_count?: number;
  };
  artifacts?: { path: string; record_count?: number }[];
};

export const buildReceiptModel = (runDir: string): ReceiptModel => {
  const manifest = readJsonIfExists<ArbiterRunManifest>(resolve(runDir, "manifest.json"));
  if (!manifest) {
    throw new Error("manifest.json not found; cannot build receipt");
  }

  const config = readJsonIfExists<ArbiterResolvedConfig>(resolve(runDir, "config.resolved.json"));
  const monitoring = readLastJsonlRecord<ArbiterMonitoringRecord>(resolve(runDir, "monitoring.jsonl"));
  const groupState = readJsonIfExists<ArbiterOnlineGroupingState>(resolve(runDir, "groups", "state.json"));

  return {
    run_id: manifest.run_id,
    run_dir: runDir,
    stop_reason: manifest.stop_reason,
    incomplete: manifest.incomplete,
    started_at: manifest.started_at ?? manifest.timestamps?.started_at,
    completed_at: manifest.completed_at ?? manifest.timestamps?.completed_at,
    question: config?.question?.text ? truncate(config.question.text) : undefined,
    protocol:
      config?.protocol.type === "debate_v1"
        ? `Debate (${config.protocol.participants ?? 2} participants, ${config.protocol.rounds ?? 1} rounds)`
        : config?.protocol.type,
    model_count: config?.sampling.models.length ?? 0,
    persona_count: config?.sampling.personas.length ?? 0,
    counts: {
      k_planned: manifest.k_planned,
      k_attempted: manifest.k_attempted,
      k_eligible: manifest.k_eligible
    },
    usage: manifest.usage,
    monitoring: monitoring
      ? {
          novelty_rate: monitoring.novelty_rate,
          mean_max_sim_to_prior: monitoring.mean_max_sim_to_prior,
          group_count: monitoring.group_count
        }
      : undefined,
    grouping: {
      enabled: Boolean(config?.measurement.clustering.enabled),
      group_count: groupState?.groups?.length
    },
    artifacts: manifest.artifacts?.entries?.map((entry) => ({
      path: entry.path,
      record_count: entry.record_count
    }))
  };
};
