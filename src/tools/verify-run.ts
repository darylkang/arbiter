import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { tableFromIPC } from "apache-arrow";

import {
  formatAjvErrors,
  validateConfig,
  validateManifest,
  validateTrial,
  validateTrialPlan,
  validateMonitoring,
  validateEmbedding,
  validateGroupAssignment,
  validateGroupState
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

const addResult = (
  results: VerifyResult[],
  status: VerifyStatus,
  label: string,
  detail?: string
): void => {
  results.push({ status, label, detail });
};

const loadJson = <T>(path: string): T => JSON.parse(readFileSync(path, "utf8")) as T;

const readJsonl = (path: string): unknown[] => {
  const raw = readFileSync(path, "utf8");
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as unknown);
};

const validateObjectRecord = (value: unknown): boolean =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const verifyJson = (
  results: VerifyResult[],
  label: string,
  path: string,
  validate: (value: unknown) => boolean
): unknown | null => {
  if (!existsSync(path)) {
    addResult(results, "FAIL", label, `missing ${path}`);
    return null;
  }

  try {
    const value = loadJson<unknown>(path);
    if (!validate(value)) {
      const detail = formatAjvErrors(label, (validate as { errors?: unknown }).errors as never).join("; ");
      addResult(results, "FAIL", label, detail || "schema validation failed");
      return null;
    }
    addResult(results, "OK", label);
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
  validate: (value: unknown) => boolean
): unknown[] => {
  if (!existsSync(path)) {
    addResult(results, "FAIL", label, `missing ${path}`);
    return [];
  }

  try {
    const rows = readJsonl(path);
    let invalid = 0;
    for (const row of rows) {
      if (!validate(row)) {
        invalid += 1;
      }
    }
    if (invalid > 0) {
      addResult(results, "FAIL", label, `${invalid} invalid record(s)`);
      return rows;
    }
    addResult(results, "OK", label, `${rows.length} records`);
    return rows;
  } catch (error) {
    addResult(results, "FAIL", label, error instanceof Error ? error.message : String(error));
    return [];
  }
};

const verifyResolveOnly = (input: {
  results: VerifyResult[];
  runDir: string;
  manifest: { artifacts?: { entries?: Array<{ path: string }> } };
}): void => {
  const allowed = new Set(["config.resolved.json", "manifest.json"]);
  const entries = input.manifest.artifacts?.entries?.map((entry) => entry.path) ?? [];
  const invalidEntries = entries.filter((entry) => !allowed.has(entry));
  if (invalidEntries.length > 0) {
    addResult(
      input.results,
      "FAIL",
      "resolve-only manifest artifacts",
      `unexpected entries: ${invalidEntries.join(", ")}`
    );
  } else {
    addResult(input.results, "OK", "resolve-only manifest artifacts");
  }

  const files = new Set(
    readdirSync(input.runDir, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
  );

  const disallowed = ["config.source.json", "trial_plan.jsonl", "trials.jsonl", "monitoring.jsonl", "receipt.txt"]
    .filter((file) => files.has(file));
  if (disallowed.length > 0) {
    addResult(input.results, "FAIL", "resolve-only file set", `unexpected files: ${disallowed.join(", ")}`);
  } else {
    addResult(input.results, "OK", "resolve-only file set");
  }
};

export const verifyRunDir = (runDir: string): VerifyReport => {
  const results: VerifyResult[] = [];

  const manifest = verifyJson(
    results,
    "manifest.json",
    resolve(runDir, "manifest.json"),
    validateManifest
  ) as
    | {
        stopping_mode?: string;
        k_planned?: number;
        k_attempted?: number;
        k_eligible?: number;
        artifacts?: { entries?: Array<{ path: string }> };
      }
    | null;

  verifyJson(results, "config.resolved.json", resolve(runDir, "config.resolved.json"), validateConfig);

  if (!manifest) {
    return { results, ok: false };
  }

  if (manifest.stopping_mode === "resolve_only") {
    verifyResolveOnly({ results, runDir, manifest });
    return { results, ok: !results.some((result) => result.status === "FAIL") };
  }

  verifyJson(results, "config.source.json", resolve(runDir, "config.source.json"), validateObjectRecord);

  const planRows = verifyJsonl(
    results,
    "trial_plan.jsonl",
    resolve(runDir, "trial_plan.jsonl"),
    validateTrialPlan
  );
  const trialRows = verifyJsonl(
    results,
    "trials.jsonl",
    resolve(runDir, "trials.jsonl"),
    validateTrial
  );
  verifyJsonl(
    results,
    "monitoring.jsonl",
    resolve(runDir, "monitoring.jsonl"),
    validateMonitoring
  );

  const receiptPath = resolve(runDir, "receipt.txt");
  if (!existsSync(receiptPath)) {
    addResult(results, "FAIL", "receipt.txt", "missing receipt.txt");
  } else {
    addResult(results, "OK", "receipt.txt");
  }

  const planned = manifest.k_planned;
  if (typeof planned === "number" && planned !== planRows.length) {
    addResult(results, "FAIL", "planned count", `manifest=${planned}, trial_plan=${planRows.length}`);
  }

  const attempted = manifest.k_attempted;
  if (typeof attempted === "number" && attempted !== trialRows.length) {
    addResult(results, "FAIL", "attempted count", `manifest=${attempted}, trials=${trialRows.length}`);
  }

  const planTrialIds = planRows
    .map((row) => (row as { trial_id?: number }).trial_id)
    .filter((id): id is number => Number.isInteger(id));
  const contiguousPlan = planTrialIds.every((trialId, index) => trialId === index);
  if (!contiguousPlan) {
    addResult(results, "FAIL", "trial_plan order", "trial_id is not contiguous starting at 0");
  } else {
    addResult(results, "OK", "trial_plan order");
  }

  const trialIds = trialRows
    .map((row) => (row as { trial_id?: number }).trial_id)
    .filter((id): id is number => Number.isInteger(id));
  const uniqueTrialIds = new Set(trialIds);
  if (uniqueTrialIds.size !== trialIds.length) {
    addResult(results, "FAIL", "trials uniqueness", "duplicate trial_id values");
  } else {
    addResult(results, "OK", "trials uniqueness");
  }

  const embeddingsArrowPath = resolve(runDir, "embeddings.arrow");
  const embeddingsJsonlPath = resolve(runDir, "embeddings.jsonl");
  const hasArrow = existsSync(embeddingsArrowPath);
  const hasJsonl = existsSync(embeddingsJsonlPath);

  if (hasArrow) {
    addResult(results, "OK", "embeddings.arrow");
    try {
      const table = tableFromIPC(readFileSync(embeddingsArrowPath));
      const eligible = manifest.k_eligible;
      if (typeof eligible === "number" && table.numRows !== eligible) {
        addResult(results, "FAIL", "embeddings coherence", `manifest eligible=${eligible}, arrow rows=${table.numRows}`);
      }
    } catch (error) {
      addResult(results, "FAIL", "embeddings.arrow", error instanceof Error ? error.message : String(error));
    }
  }

  if (hasJsonl) {
    verifyJsonl(results, "embeddings.jsonl", embeddingsJsonlPath, validateEmbedding);
  }

  const eligible = manifest.k_eligible ?? 0;
  if (eligible > 0 && !hasArrow && !hasJsonl) {
    addResult(results, "FAIL", "embeddings availability", "eligible trials > 0 but no embeddings artifact found");
  } else if (eligible === 0 && !hasArrow && !hasJsonl) {
    addResult(results, "OK", "embeddings availability", "zero eligible trials");
  }

  const groupsStatePath = resolve(runDir, "groups", "state.json");
  if (existsSync(groupsStatePath)) {
    verifyJson(results, "groups/state.json", groupsStatePath, validateGroupState);
  }

  const groupsAssignmentsPath = resolve(runDir, "groups", "assignments.jsonl");
  if (existsSync(groupsAssignmentsPath)) {
    verifyJsonl(results, "groups/assignments.jsonl", groupsAssignmentsPath, validateGroupAssignment);
  }

  if (manifest.artifacts?.entries) {
    for (const entry of manifest.artifacts.entries) {
      const path = resolve(runDir, entry.path);
      if (!existsSync(path)) {
        addResult(results, "FAIL", "manifest artifact exists", `missing ${entry.path}`);
      }
    }
  }

  return { results, ok: !results.some((result) => result.status === "FAIL") };
};

export const formatVerifyReport = (report: VerifyReport): string =>
  report.results
    .map((result) => `${result.status} ${result.label}${result.detail ? `: ${result.detail}` : ""}`)
    .join("\n");
