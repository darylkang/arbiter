import { readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";

import type { AppState } from "./state.js";
import { formatError } from "./error-format.js";

const RUNS_DIR_NAME = "runs";

const isDirectoryPath = (path: string): boolean => {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
};

export const listRunDirs = (): string[] => {
  try {
    const runRoot = resolve(process.cwd(), RUNS_DIR_NAME);
    const entries = readdirSync(runRoot, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => resolve(runRoot, entry.name))
      .sort()
      .reverse();
  } catch (error) {
    const maybeCode = (error as { code?: unknown }).code;
    if (maybeCode !== "ENOENT") {
      console.warn(`[arbiter:tui] failed to list run directories: ${formatError(error)}`);
    }
    return [];
  }
};

export const resolveRunDirArg = (
  state: Pick<AppState, "lastRunDir">,
  runDirArg?: string
): string | null => {
  if (runDirArg && runDirArg.trim().length > 0) {
    const candidate = runDirArg.trim();
    const absolute = resolve(process.cwd(), candidate);
    if (isDirectoryPath(absolute)) {
      return absolute;
    }
    const underRuns = resolve(process.cwd(), RUNS_DIR_NAME, candidate);
    if (isDirectoryPath(underRuns)) {
      return underRuns;
    }
    return null;
  }

  if (state.lastRunDir && isDirectoryPath(state.lastRunDir)) {
    return state.lastRunDir;
  }

  const all = listRunDirs();
  return all.length > 0 ? all[0] : null;
};

export const toRunDirLabel = (runDir: string): string => {
  const runRoot = `${resolve(process.cwd(), RUNS_DIR_NAME)}/`;
  return runDir.replace(runRoot, "");
};
