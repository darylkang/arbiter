import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

export interface RunDirOptions {
  outRoot?: string;
  runId: string;
  debug?: boolean;
}

export interface RunDirResult {
  runDir: string;
  debugDir?: string;
}

export const createRunDir = (options: RunDirOptions): RunDirResult => {
  const outRoot = resolve(options.outRoot ?? "runs");
  const runDir = resolve(outRoot, options.runId);
  mkdirSync(runDir, { recursive: true });

  let debugDir: string | undefined;
  if (options.debug) {
    debugDir = resolve(runDir, "debug");
    mkdirSync(debugDir, { recursive: true });
  }

  return { runDir, debugDir };
};
