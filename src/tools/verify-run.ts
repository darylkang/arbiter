import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { tableFromIPC } from "apache-arrow";

import {
  formatAjvErrors,
  validateAggregates,
  validateClusterAssignment,
  validateClusterState,
  validateConfig,
  validateConvergenceTrace,
  validateEmbeddingsProvenance,
  validateEmbedding,
  validateManifest,
  validateParsedOutput,
  validateTrial,
  validateTrialPlan
} from "../config/schema-validation.js";

export type VerifyStatus = "OK" | "WARN" | "FAIL";

export type VerifyResult = {
  status: VerifyStatus;
  label: string;
  detail?: string;
};

export type VerifyReport = {
  results: VerifyResult[];
  ok: boolean;
};

const loadJson = <T>(path: string): T => {
  const raw = readFileSync(path, "utf8");
  return JSON.parse(raw) as T;
};

const readJsonLines = (path: string): unknown[] => {
  const raw = readFileSync(path, "utf8");
  const lines = raw.split("\n").filter((line) => line.trim().length > 0);
  return lines.map((line) => JSON.parse(line) as unknown);
};

const addResult = (
  results: VerifyResult[],
  status: VerifyStatus,
  label: string,
  detail?: string
): void => {
  results.push({ status, label, detail });
};

const nearlyEqual = (a: number | null | undefined, b: number | null | undefined): boolean => {
  if (a === null || a === undefined || b === null || b === undefined) {
    return a === b;
  }
  return Math.abs(a - b) < 1e-9;
};

const verifyJson = (
  results: VerifyResult[],
  label: string,
  path: string,
  validate: (data: unknown) => boolean
): unknown | null => {
  if (!existsSync(path)) {
    addResult(results, "FAIL", label, `Missing file: ${path}`);
    return null;
  }
  try {
    const value = loadJson<unknown>(path);
    if (!validate(value)) {
      const errors = formatAjvErrors(label, (validate as { errors?: unknown }).errors as never);
      addResult(results, "FAIL", label, errors.join("; ") || "Schema validation failed");
    } else {
      addResult(results, "OK", label);
    }
    return value;
  } catch (error) {
    addResult(results, "FAIL", label, error instanceof Error ? error.message : String(error));
    return null;
  }
};

const verifyJsonl = (
  results: VerifyResult[],
  label: string,
  path: string,
  validate: (data: unknown) => boolean
): unknown[] => {
  if (!existsSync(path)) {
    addResult(results, "FAIL", label, `Missing file: ${path}`);
    return [];
  }
  try {
    const records = readJsonLines(path);
    let invalidCount = 0;
    for (const record of records) {
      if (!validate(record)) {
        invalidCount += 1;
      }
    }
    if (invalidCount > 0) {
      addResult(results, "FAIL", label, `${invalidCount} record(s) failed schema validation`);
    } else {
      addResult(results, "OK", label, `${records.length} record(s)`);
    }
    return records;
  } catch (error) {
    addResult(results, "FAIL", label, error instanceof Error ? error.message : String(error));
    return [];
  }
};

const verifyTrialPlan = (results: VerifyResult[], records: unknown[], expected?: number): void => {
  if (records.length === 0) {
    addResult(results, "WARN", "trial_plan.jsonl order", "No records to verify");
    return;
  }

  let contiguous = true;
  for (let i = 0; i < records.length; i += 1) {
    const record = records[i] as { trial_id?: number };
    if (record.trial_id !== i) {
      contiguous = false;
      break;
    }
  }

  if (!contiguous) {
    addResult(results, "FAIL", "trial_plan.jsonl order", "trial_id is not contiguous starting at 0");
  } else {
    addResult(results, "OK", "trial_plan.jsonl order");
  }

  if (expected !== undefined && expected !== records.length) {
    addResult(
      results,
      "FAIL",
      "trial_plan.jsonl count",
      `Expected ${expected} records, got ${records.length}`
    );
  } else if (expected !== undefined) {
    addResult(results, "OK", "trial_plan.jsonl count");
  }
};

const extractTrialIds = (records: unknown[]): number[] =>
  records
    .map((record) => (record as { trial_id?: number }).trial_id)
    .filter((id): id is number => Number.isInteger(id) && (id as number) >= 0);

const verifyTrialRecords = (
  results: VerifyResult[],
  trialRecords: unknown[],
  parsedRecords: unknown[],
  planned?: number,
  attempted?: number
): void => {
  const trialIds = extractTrialIds(trialRecords);
  const parsedIds = extractTrialIds(parsedRecords);
  const uniqueTrials = new Set(trialIds);
  const uniqueParsed = new Set(parsedIds);

  if (uniqueTrials.size !== trialIds.length) {
    addResult(results, "FAIL", "trials.jsonl trial_id uniqueness", "Duplicate trial_id values found");
  } else {
    addResult(results, "OK", "trials.jsonl trial_id uniqueness");
  }

  if (planned !== undefined) {
    const outOfRange = Array.from(uniqueTrials).some((id) => id < 0 || id >= planned);
    if (outOfRange) {
      addResult(results, "FAIL", "trials.jsonl trial_id range", "trial_id outside planned range");
    } else {
      addResult(results, "OK", "trials.jsonl trial_id range");
    }
  }

  if (attempted !== undefined) {
    if (uniqueTrials.size !== attempted) {
      addResult(
        results,
        "FAIL",
        "trials.jsonl count",
        `Expected ${attempted} trial records, got ${uniqueTrials.size}`
      );
    } else {
      addResult(results, "OK", "trials.jsonl count");
    }
  }

  const missingParsed = Array.from(uniqueTrials).filter((id) => !uniqueParsed.has(id));
  const extraParsed = Array.from(uniqueParsed).filter((id) => !uniqueTrials.has(id));
  if (missingParsed.length > 0 || extraParsed.length > 0) {
    addResult(
      results,
      "FAIL",
      "parsed.jsonl alignment",
      `Missing parsed for ${missingParsed.length}, extra parsed ${extraParsed.length}`
    );
  } else {
    addResult(results, "OK", "parsed.jsonl alignment");
  }

  if (uniqueTrials.size > 0) {
    const sorted = Array.from(uniqueTrials).sort((a, b) => a - b);
    const contiguous = sorted.every((id, index) => id === sorted[0] + index);
    if (!contiguous) {
      addResult(
        results,
        "WARN",
        "trials.jsonl contiguity",
        "trial_id sequence is not contiguous"
      );
    } else {
      addResult(results, "OK", "trials.jsonl contiguity");
    }
  }
};

const verifyStopReason = (
  results: VerifyResult[],
  manifest: { stop_reason?: string },
  convergenceRecords: Array<{ [key: string]: unknown }>
): void => {
  if (convergenceRecords.length === 0) {
    return;
  }
  const last = convergenceRecords[convergenceRecords.length - 1] as {
    stop?: { should_stop?: boolean };
  };
  if (manifest.stop_reason === "converged" && last.stop?.should_stop !== true) {
    addResult(
      results,
      "FAIL",
      "stop_reason coherence",
      "manifest stop_reason=converged but last convergence record should_stop=false"
    );
  } else if (manifest.stop_reason) {
    addResult(results, "OK", "stop_reason coherence");
  }
};

const verifyZeroEligibleSemantics = (
  results: VerifyResult[],
  convergenceRecords: Array<{ [key: string]: unknown }>
): void => {
  let mismatches = 0;
  for (const record of convergenceRecords) {
    const hasEligible = record.has_eligible_in_batch as boolean | undefined;
    const novelty = record.novelty_rate as number | null | undefined;
    const meanSim = record.mean_max_sim_to_prior as number | null | undefined;
    if (hasEligible === false && (novelty !== null || meanSim !== null)) {
      mismatches += 1;
    }
    if (hasEligible === true && (novelty === null || meanSim === null)) {
      mismatches += 1;
    }
  }
  if (mismatches > 0) {
    addResult(
      results,
      "FAIL",
      "zero-eligible semantics",
      `${mismatches} convergence record(s) inconsistent with has_eligible_in_batch`
    );
  } else if (convergenceRecords.length > 0) {
    addResult(results, "OK", "zero-eligible semantics");
  }
};
const verifyEmbeddingsArrow = (results: VerifyResult[], arrowPath: string): void => {
  if (!existsSync(arrowPath)) {
    addResult(results, "WARN", "embeddings.arrow", "File not present");
    return;
  }
  try {
    const buffer = readFileSync(arrowPath);
    const table = tableFromIPC(buffer);
    const batch = table.batches[0];
    const trialColumn = batch?.getChildAt(0);
    if (!trialColumn) {
      addResult(results, "FAIL", "embeddings.arrow", "Missing trial_id column");
      return;
    }
    const trials = Array.from(trialColumn.toArray() as Iterable<number>);
    let sorted = true;
    let unique = true;
    for (let i = 1; i < trials.length; i += 1) {
      if (trials[i] < trials[i - 1]) {
        sorted = false;
      }
      if (trials[i] === trials[i - 1]) {
        unique = false;
      }
    }
    if (!sorted || !unique) {
      addResult(
        results,
        "FAIL",
        "embeddings.arrow trial_id order",
        `sorted=${sorted} unique=${unique}`
      );
    } else {
      addResult(results, "OK", "embeddings.arrow trial_id order");
    }
  } catch (error) {
    addResult(results, "FAIL", "embeddings.arrow", error instanceof Error ? error.message : String(error));
  }
};

const verifyAggregates = (
  results: VerifyResult[],
  aggregates: { [key: string]: unknown } | null,
  convergenceRecords: Array<{ [key: string]: unknown }>
): void => {
  if (!aggregates) {
    addResult(results, "FAIL", "aggregates.json", "Missing aggregates data");
    return;
  }
  if (convergenceRecords.length === 0) {
    addResult(results, "WARN", "aggregates vs convergence", "No convergence records to compare");
    return;
  }
  const last = convergenceRecords[convergenceRecords.length - 1];
  const sharedFields = ["k_attempted", "k_eligible", "novelty_rate", "mean_max_sim_to_prior"] as const;
  for (const field of sharedFields) {
    const aggValue = aggregates[field] as number | null | undefined;
    const convValue = last[field] as number | null | undefined;
    if (!nearlyEqual(aggValue, convValue)) {
      addResult(
        results,
        "FAIL",
        "aggregates vs convergence",
        `${field} mismatch (aggregates=${aggValue}, convergence=${convValue})`
      );
      return;
    }
  }

  const clusterCount = aggregates.cluster_count as number | null | undefined;
  const entropy = aggregates.entropy as number | null | undefined;
  const convCluster = last.cluster_count as number | undefined;
  const convEntropy = last.entropy as number | undefined;
  if (clusterCount !== null && clusterCount !== undefined && convCluster !== undefined) {
    if (clusterCount !== convCluster) {
      addResult(results, "FAIL", "aggregates vs convergence", "cluster_count mismatch");
      return;
    }
  }
  if (entropy !== null && entropy !== undefined && convEntropy !== undefined) {
    if (!nearlyEqual(entropy, convEntropy)) {
      addResult(results, "FAIL", "aggregates vs convergence", "entropy mismatch");
      return;
    }
  }
  addResult(results, "OK", "aggregates vs convergence");
};

export const verifyRunDir = (runDir: string): VerifyReport => {
  const results: VerifyResult[] = [];
  const manifestPath = resolve(runDir, "manifest.json");
  const manifest = verifyJson(results, "manifest.json", manifestPath, validateManifest) as
    | {
        artifacts?: { entries?: Array<{ path: string }> };
        k_planned?: number;
        k_attempted?: number;
        incomplete?: boolean;
        stop_reason?: string;
      }
    | null;

  const receiptPath = resolve(runDir, "receipt.txt");
  if (existsSync(receiptPath) && manifest?.artifacts?.entries) {
    const listed = manifest.artifacts.entries.some((entry) => entry.path === "receipt.txt");
    if (!listed) {
      addResult(results, "WARN", "receipt.txt listing", "Receipt exists but is not listed in manifest");
    }
  }

  if (manifest?.artifacts?.entries) {
    for (const entry of manifest.artifacts.entries) {
      const artifactPath = resolve(runDir, entry.path);
      if (!existsSync(artifactPath)) {
        addResult(results, "FAIL", "artifact exists", `Missing ${entry.path}`);
      }
    }
  }

  verifyJson(results, "config.resolved.json", resolve(runDir, "config.resolved.json"), validateConfig);
  const aggregates = verifyJson(
    results,
    "aggregates.json",
    resolve(runDir, "aggregates.json"),
    validateAggregates
  ) as { [key: string]: unknown } | null;
  verifyJson(
    results,
    "embeddings.provenance.json",
    resolve(runDir, "embeddings.provenance.json"),
    validateEmbeddingsProvenance
  );

  const planRecords = verifyJsonl(
    results,
    "trial_plan.jsonl",
    resolve(runDir, "trial_plan.jsonl"),
    validateTrialPlan
  );
  verifyTrialPlan(results, planRecords, manifest?.k_planned);

  const trialRecords = verifyJsonl(
    results,
    "trials.jsonl",
    resolve(runDir, "trials.jsonl"),
    validateTrial
  );
  const parsedRecords = verifyJsonl(
    results,
    "parsed.jsonl",
    resolve(runDir, "parsed.jsonl"),
    validateParsedOutput
  );
  const convergenceRecords = verifyJsonl(
    results,
    "convergence_trace.jsonl",
    resolve(runDir, "convergence_trace.jsonl"),
    validateConvergenceTrace
  ) as Array<{ [key: string]: unknown }>;

  verifyAggregates(results, aggregates, convergenceRecords);
  verifyTrialRecords(results, trialRecords, parsedRecords, manifest?.k_planned, manifest?.k_attempted);
  verifyStopReason(results, manifest ?? {}, convergenceRecords);
  verifyZeroEligibleSemantics(results, convergenceRecords);
  verifyEmbeddingsArrow(results, resolve(runDir, "embeddings.arrow"));

  const clusterStatePath = resolve(runDir, "clusters", "online.state.json");
  if (existsSync(clusterStatePath)) {
    verifyJson(results, "clusters/online.state.json", clusterStatePath, validateClusterState);
  }
  const clusterAssignmentsPath = resolve(runDir, "clusters", "online.assignments.jsonl");
  if (existsSync(clusterAssignmentsPath)) {
    verifyJsonl(
      results,
      "clusters/online.assignments.jsonl",
      clusterAssignmentsPath,
      validateClusterAssignment
    );
  }

  const embeddingsDebugPath = resolve(runDir, "debug", "embeddings.jsonl");
  if (existsSync(embeddingsDebugPath)) {
    verifyJsonl(
      results,
      "debug/embeddings.jsonl",
      embeddingsDebugPath,
      validateEmbedding
    );
  }

  const ok = !results.some((result) => result.status === "FAIL");
  return { results, ok };
};

export const formatVerifyReport = (report: VerifyReport): string => {
  return report.results
    .map((result) => {
      const detail = result.detail ? `: ${result.detail}` : "";
      return `${result.status} ${result.label}${detail}`;
    })
    .join("\n");
};
