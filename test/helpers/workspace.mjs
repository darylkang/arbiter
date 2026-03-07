import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)));
export const DIST_CLI_ENTRY = resolve(REPO_ROOT, "dist/cli/index.js");
export const PACKAGE_VERSION = JSON.parse(
  readFileSync(resolve(REPO_ROOT, "package.json"), "utf8")
).version;

export const readJson = (filePath) => JSON.parse(readFileSync(filePath, "utf8"));
export const writeJson = (filePath, value) => {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

export const readJsonl = (filePath) => {
  const text = readFileSync(filePath, "utf8").trim();
  if (!text) {
    return [];
  }
  return text
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
};

export const withTempWorkspace = async (prefix, fn) => {
  const cwd = mkdtempSync(join(tmpdir(), prefix));
  const previousCwd = process.cwd();
  process.chdir(cwd);
  try {
    await fn(cwd);
  } finally {
    process.chdir(previousCwd);
    rmSync(cwd, { recursive: true, force: true });
  }
};

export const runBuiltCli = (args, options = {}) => {
  const result = spawnSync("node", [DIST_CLI_ENTRY, ...args], {
    cwd: options.cwd,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      ...(options.env ?? {})
    }
  });

  return {
    status: result.status ?? 0,
    stdout: result.stdout?.toString("utf8") ?? "",
    stderr: result.stderr?.toString("utf8") ?? ""
  };
};

export const runNodeScript = (scriptPath, options = {}) => {
  const result = spawnSync("node", [resolve(REPO_ROOT, scriptPath)], {
    cwd: options.cwd ?? REPO_ROOT,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      ...(options.env ?? {})
    }
  });

  return {
    status: result.status ?? 0,
    stdout: result.stdout?.toString("utf8") ?? "",
    stderr: result.stderr?.toString("utf8") ?? ""
  };
};

export const listFilesRecursive = (root, dir = root) => {
  const results = [];
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...listFilesRecursive(root, fullPath));
      continue;
    }
    results.push(relative(root, fullPath).replace(/\\/g, "/"));
  }
  return results.sort();
};

export const getSingleRunDir = (runsDir) => {
  const runDirs = readdirSync(runsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  if (runDirs.length !== 1) {
    throw new Error(`Expected exactly 1 run directory in ${runsDir}, got ${runDirs.length}`);
  }

  return resolve(runsDir, runDirs[0]);
};

export const countJsonlLines = (filePath) => readJsonl(filePath).length;
export const normalizePath = (value) => value.replace(/^\/private/, "");

export const assertFileExists = (filePath, label = filePath) => {
  if (!existsSync(filePath)) {
    throw new Error(`Expected ${label} to exist at ${filePath}`);
  }
};

export const cliDir = () => dirname(DIST_CLI_ENTRY);
