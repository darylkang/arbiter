import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

export const DEFAULT_CONFIG_FILENAME = "arbiter.config.json";
const CONFIG_PATTERN = /^arbiter\.config(?:\.[1-9][0-9]*)?\.json$/;

export type ParsedArgs = {
  positional: string[];
  flags: Record<string, string | boolean>;
};

export const parseArgs = (args: string[]): ParsedArgs => {
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "-h") {
      flags["--help"] = true;
      continue;
    }
    if (arg === "-V") {
      flags["--version"] = true;
      continue;
    }
    if (arg.startsWith("--")) {
      const next = args[i + 1];
      if (next && !next.startsWith("--")) {
        flags[arg] = next;
        i += 1;
      } else {
        flags[arg] = true;
      }
      continue;
    }
    positional.push(arg);
  }

  return { positional, flags };
};

export const getFlag = (flags: ParsedArgs["flags"], name: string): string | undefined => {
  const value = flags[name];
  return typeof value === "string" ? value : undefined;
};

export const hasFlag = (flags: ParsedArgs["flags"], name: string): boolean =>
  Boolean(flags[name]);

export const getFlagInteger = (flags: ParsedArgs["flags"], name: string): number | undefined => {
  const raw = getFlag(flags, name);
  if (raw === undefined) {
    return undefined;
  }
  const parsed = Number(raw);
  if (!Number.isInteger(parsed)) {
    throw new Error(`${name} must be an integer`);
  }
  return parsed;
};

export const readJsonFile = <T>(path: string): T => {
  const raw = readFileSync(path, "utf8");
  return JSON.parse(raw) as T;
};

export const writeJsonFile = (path: string, value: unknown): void => {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

export const listConfigFiles = (cwd = process.cwd()): string[] => {
  const entries = readdirSync(cwd, { withFileTypes: true })
    .filter((entry) => entry.isFile() && CONFIG_PATTERN.test(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
  return entries;
};

export const resolveConfigPath = (value: string): string => resolve(process.cwd(), value);

export const nextCollisionSafeConfigPath = (cwd = process.cwd()): string => {
  const basePath = resolve(cwd, DEFAULT_CONFIG_FILENAME);
  if (!existsSync(basePath)) {
    return basePath;
  }

  let index = 1;
  while (true) {
    const next = resolve(cwd, `arbiter.config.${index}.json`);
    if (!existsSync(next)) {
      return next;
    }
    index += 1;
  }
};

export const loadTemplateConfig = (assetRoot: string, templateName: "default" | "debate_v1") => {
  const templatePath = resolve(assetRoot, "resources/templates", `${templateName}.config.json`);
  return readJsonFile<Record<string, unknown>>(templatePath);
};
