import "dotenv/config";

import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

import { resolveConfig } from "../config/resolve-config.js";
import { buildResolveManifest } from "../config/manifest.js";
import { generateRunId } from "../artifacts/run-id.js";
import { createRunDir } from "../artifacts/run-dir.js";
import { writeResolveArtifacts } from "../artifacts/resolve-artifacts.js";
import { EventBus } from "../events/event-bus.js";
import { ArtifactWriter } from "../artifacts/artifact-writer.js";
import { runMock } from "../engine/mock-runner.js";
import { runLive } from "../engine/live-runner.js";
import { validateConfig } from "../config/schema-validation.js";

const printUsage = (): void => {
  console.log("Usage:");
  console.log("  arbiter resolve --config <path> [--out <runs_dir>] [--debug]");
  console.log("  arbiter mock-run --config <path> [--out <runs_dir>] [--debug]");
  console.log(
    "  arbiter run --config <path> [--out <runs_dir>] [--debug] [--max-trials N] [--batch-size N] [--workers N]"
  );
};

const getArgValue = (args: string[], flag: string): string | undefined => {
  const index = args.indexOf(flag);
  if (index === -1 || index === args.length - 1) {
    return undefined;
  }
  return args[index + 1];
};

const hasFlag = (args: string[], flag: string): boolean => args.includes(flag);

const getArgNumber = (args: string[], flag: string): number | undefined => {
  const value = getArgValue(args, flag);
  if (value === undefined) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const runResolve = (args: string[]): void => {
  const configPath = getArgValue(args, "--config") ?? "arbiter.config.json";
  const runsDir = getArgValue(args, "--out") ?? "runs";
  const debug = hasFlag(args, "--debug");

  const result = resolveConfig({ configPath });
  const runId = generateRunId();
  const { runDir } = createRunDir({ outRoot: runsDir, runId, debug });

  result.resolvedConfig.run.run_id = runId;

  const manifest = buildResolveManifest({
    runId,
    resolvedConfig: result.resolvedConfig,
    catalogVersion: result.catalog.catalog_version,
    catalogSha256: result.catalogSha256,
    promptManifestSha256: result.promptManifestSha256
  });

  writeResolveArtifacts({
    runDir,
    resolvedConfig: result.resolvedConfig,
    manifest,
    catalog: result.catalog,
    promptManifest: result.promptManifest,
    catalogSha256: result.catalogSha256,
    promptManifestSha256: result.promptManifestSha256,
    debug
  });

  if (result.warnings.length > 0) {
    console.warn("Warnings:");
    result.warnings.forEach((warning) => console.warn(`- ${warning}`));
  }

  console.log(`Run ID: ${runId}`);
  console.log(`Output directory: ${runDir}`);
};

const runMockCommand = async (args: string[]): Promise<void> => {
  const configPath = getArgValue(args, "--config") ?? "arbiter.config.json";
  const runsDir = getArgValue(args, "--out") ?? "runs";
  const debug = hasFlag(args, "--debug");

  const result = resolveConfig({ configPath });
  const runId = generateRunId();
  const { runDir } = createRunDir({ outRoot: runsDir, runId, debug });

  result.resolvedConfig.run.run_id = runId;

  const debugDir = resolve(runDir, "debug");
  mkdirSync(debugDir, { recursive: true });
  const embeddingsJsonlPath = resolve(debugDir, "embeddings.jsonl");

  const bus = new EventBus();
  const writer = new ArtifactWriter({
    runDir,
    runId,
    resolvedConfig: result.resolvedConfig,
    debugEnabled: debug,
    embeddingsJsonlPath,
    catalogVersion: result.catalog.catalog_version,
    catalogSha256: result.catalogSha256,
    promptManifestSha256: result.promptManifestSha256
  });
  writer.attach(bus);

  let mockResult;
  try {
    mockResult = await runMock({
      bus,
      runDir,
      resolvedConfig: result.resolvedConfig,
      embeddingsJsonlPath,
      debugEnabled: debug,
      beforeFinalize: async () => writer.close()
    });
  } finally {
    await writer.close();
    writer.detach();
  }

  if (result.warnings.length > 0) {
    console.warn("Warnings:");
    result.warnings.forEach((warning) => console.warn(`- ${warning}`));
  }

  if (mockResult) {
    console.log(`Run ID: ${mockResult.runId}`);
    console.log(`Output directory: ${mockResult.runDir}`);
    console.log(`Trials attempted: ${mockResult.kAttempted}`);
    console.log(`Trials eligible: ${mockResult.kEligible}`);
    console.log(`Embeddings status: ${mockResult.embeddingsProvenance.status}`);
  }
};

const runLiveCommand = async (args: string[]): Promise<void> => {
  const configPath = getArgValue(args, "--config") ?? "arbiter.config.json";
  const runsDir = getArgValue(args, "--out") ?? "runs";
  const debug = hasFlag(args, "--debug");

  const result = resolveConfig({ configPath });
  const runId = generateRunId();
  const { runDir } = createRunDir({ outRoot: runsDir, runId, debug });

  const maxTrials = getArgNumber(args, "--max-trials");
  const batchSize = getArgNumber(args, "--batch-size");
  const workers = getArgNumber(args, "--workers");

  result.resolvedConfig.run.run_id = runId;
  if (maxTrials !== undefined) {
    result.resolvedConfig.execution.k_max = Math.max(1, Math.floor(maxTrials));
  }
  if (batchSize !== undefined) {
    result.resolvedConfig.execution.batch_size = Math.max(1, Math.floor(batchSize));
  }
  if (workers !== undefined) {
    result.resolvedConfig.execution.workers = Math.max(1, Math.floor(workers));
  }

  if (!validateConfig(result.resolvedConfig)) {
    throw new Error("Resolved config became invalid after overrides");
  }

  const debugDir = resolve(runDir, "debug");
  mkdirSync(debugDir, { recursive: true });
  const embeddingsJsonlPath = resolve(debugDir, "embeddings.jsonl");

  const bus = new EventBus();
  const writer = new ArtifactWriter({
    runDir,
    runId,
    resolvedConfig: result.resolvedConfig,
    debugEnabled: debug,
    embeddingsJsonlPath,
    catalogVersion: result.catalog.catalog_version,
    catalogSha256: result.catalogSha256,
    promptManifestSha256: result.promptManifestSha256
  });
  writer.attach(bus);

  let shutdownRequested = false;
  const shutdownController = new AbortController();
  const shutdownTimeoutMs = 30_000;

  const requestShutdown = (signalName: string): void => {
    if (shutdownRequested) {
      return;
    }
    shutdownRequested = true;
    console.warn(`${signalName} received: stopping new trials, waiting for in-flight to finish...`);
    setTimeout(() => shutdownController.abort(), shutdownTimeoutMs);
  };

  process.once("SIGINT", () => requestShutdown("SIGINT"));
  process.once("SIGTERM", () => requestShutdown("SIGTERM"));

  let liveResult;
  try {
    liveResult = await runLive({
      bus,
      runDir,
      resolvedConfig: result.resolvedConfig,
      embeddingsJsonlPath,
      debugEnabled: debug,
      beforeFinalize: async () => writer.close(),
      shutdown: {
        signal: shutdownController.signal,
        isRequested: () => shutdownRequested
      }
    });
  } finally {
    await writer.close();
    writer.detach();
  }

  if (result.warnings.length > 0) {
    console.warn("Warnings:");
    result.warnings.forEach((warning) => console.warn(`- ${warning}`));
  }

  if (liveResult) {
    console.log(`Run ID: ${liveResult.runId}`);
    console.log(`Output directory: ${liveResult.runDir}`);
    console.log(`Trials attempted: ${liveResult.kAttempted}`);
    console.log(`Trials eligible: ${liveResult.kEligible}`);
    console.log(`Embeddings status: ${liveResult.embeddingsProvenance.status}`);
  }
};

const main = async (): Promise<void> => {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    printUsage();
    process.exit(1);
  }

  const command = args[0];
  try {
    if (command === "resolve") {
      runResolve(args.slice(1));
    } else if (command === "mock-run") {
      await runMockCommand(args.slice(1));
    } else if (command === "run") {
      if (!process.env.OPENROUTER_API_KEY) {
        throw new Error(
          "OPENROUTER_API_KEY is required for live runs. Set it in your environment or .env file."
        );
      }
      await runLiveCommand(args.slice(1));
    } else {
      printUsage();
      process.exit(1);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  }
};

void main();
