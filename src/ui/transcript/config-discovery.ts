import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";

import { formatError } from "./error-format.js";

export const DEFAULT_CONFIG_FILENAME = "arbiter.config.json";

export type ConfigCandidate = {
  path: string;
  name: string;
  valid: boolean;
  isDefault: boolean;
  disabledReason?: string;
};

type ListConfigCandidatesOptions = {
  cwd?: string;
  onError?: (message: string) => void;
};

const isConfigName = (name: string): boolean => {
  return name === DEFAULT_CONFIG_FILENAME || name.endsWith(".arbiter.json");
};

const isFile = (path: string): boolean => {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
};

const parseValidationError = (path: string): string | undefined => {
  try {
    JSON.parse(readFileSync(path, "utf8"));
    return undefined;
  } catch (error) {
    return `Invalid JSON: ${formatError(error)}`;
  }
};

const configSortKey = (candidate: ConfigCandidate): [number, number, string] => {
  const validityRank = candidate.valid ? 0 : 1;
  const defaultRank = candidate.isDefault ? 0 : 1;
  return [validityRank, defaultRank, candidate.name.toLowerCase()];
};

export const listConfigCandidates = (options?: ListConfigCandidatesOptions): ConfigCandidate[] => {
  const cwd = options?.cwd ?? process.cwd();

  try {
    const entries = readdirSync(cwd, { withFileTypes: true });
    const candidates = entries
      .filter((entry) => entry.isFile() && isConfigName(entry.name))
      .map((entry) => {
        const path = resolve(cwd, entry.name);
        const disabledReason = parseValidationError(path);
        return {
          path,
          name: entry.name,
          isDefault: entry.name === DEFAULT_CONFIG_FILENAME,
          valid: disabledReason === undefined,
          ...(disabledReason !== undefined ? { disabledReason } : {})
        } satisfies ConfigCandidate;
      })
      .filter((candidate) => isFile(candidate.path))
      .sort((a, b) => {
        const aKey = configSortKey(a);
        const bKey = configSortKey(b);
        if (aKey[0] !== bKey[0]) {
          return aKey[0] - bKey[0];
        }
        if (aKey[1] !== bKey[1]) {
          return aKey[1] - bKey[1];
        }
        return aKey[2].localeCompare(bKey[2]);
      });

    return candidates;
  } catch (error) {
    const maybeCode = (error as { code?: unknown }).code;
    if (maybeCode !== "ENOENT") {
      options?.onError?.(`[arbiter:tui] failed to discover config files: ${formatError(error)}`);
    }
    return [];
  }
};

export const listValidConfigCandidates = (options?: ListConfigCandidatesOptions): ConfigCandidate[] => {
  return listConfigCandidates(options).filter((candidate) => candidate.valid);
};

