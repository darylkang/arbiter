#!/usr/bin/env node
import "dotenv/config";

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { resolveConfig } from "../config/resolve-config.js";
import { buildResolveManifest } from "../config/manifest.js";
import { generateRunId } from "../artifacts/run-id.js";
import { createRunDir } from "../artifacts/run-dir.js";
import { writeResolveArtifacts } from "../artifacts/resolve-artifacts.js";
import { writeJsonAtomic } from "../artifacts/io.js";
import { EventBus } from "../events/event-bus.js";
import { ArtifactWriter } from "../artifacts/artifact-writer.js";
import { ClusteringMonitor } from "../clustering/monitor.js";
import { runMock } from "../engine/mock-runner.js";
import { runLive } from "../engine/live-runner.js";
import { validateConfig } from "../config/schema-validation.js";
import { getAssetRoot } from "../utils/asset-root.js";
import { buildReceiptModel } from "../ui/receipt-model.js";
import { formatReceiptText } from "../ui/receipt-text.js";
import { renderReceiptInk } from "../ui/receipt-ink.js";
import { writeReceiptText } from "../ui/receipt-writer.js";
import { ExecutionLogger } from "../ui/execution-log.js";

const DEFAULT_CONFIG_PATH = "arbiter.config.json";

const printUsage = (): void => {
  console.log("Wizard coming soon. For now: arbiter init → arbiter validate → arbiter run");
  console.log("Usage:");
  console.log(
    "  arbiter init [question] [--out <path>] [--force] [--template default|debate|multi-model|full]"
  );
  console.log("  arbiter validate [config.json]");
  console.log("  arbiter resolve [config.json] [--out <runs_dir>] [--debug]");
  console.log("  arbiter mock-run [config.json] [--out <runs_dir>] [--debug] [--quiet]");
  console.log(
    "  arbiter run [config.json] [--out <runs_dir>] [--debug] [--quiet] [--max-trials N] [--batch-size N] [--workers N]"
  );
};

type ParsedArgs = {
  positional: string[];
  flags: Record<string, string | boolean>;
};

const parseArgs = (args: string[]): ParsedArgs => {
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg.startsWith("--")) {
      const next = args[i + 1];
      if (next && !next.startsWith("--")) {
        flags[arg] = next;
        i += 1;
      } else {
        flags[arg] = true;
      }
    } else {
      positional.push(arg);
    }
  }
  return { positional, flags };
};

const getFlag = (flags: ParsedArgs["flags"], name: string): string | undefined => {
  const value = flags[name];
  return typeof value === "string" ? value : undefined;
};

const hasFlag = (flags: ParsedArgs["flags"], name: string): boolean => Boolean(flags[name]);

const getFlagNumber = (flags: ParsedArgs["flags"], name: string): number | undefined => {
  const value = getFlag(flags, name);
  if (!value) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const resolveConfigForCli = (configPathInput: string, assetRoot: string) => {
  const configPath = resolve(process.cwd(), configPathInput);
  const configRoot = dirname(configPath);
  return resolveConfig({ configPath, configRoot, assetRoot });
};

const printRunPreview = (resolvedConfig: ReturnType<typeof resolveConfigForCli>["resolvedConfig"]): void => {
  const question = resolvedConfig.question?.text ?? "";
  const truncatedQuestion = question.length > 120 ? `${question.slice(0, 119)}…` : question;
  const protocol = resolvedConfig.protocol?.type ?? "unknown";
  const kMax = resolvedConfig.execution.k_max;
  const batchSize = resolvedConfig.execution.batch_size;
  const workers = resolvedConfig.execution.workers;
  const models = resolvedConfig.sampling.models
    .map((model) => `${model.model}${model.weight !== undefined ? ` (w=${model.weight})` : ""}`)
    .join(", ");
  const clustering = resolvedConfig.measurement.clustering.enabled
    ? `enabled (tau ${resolvedConfig.measurement.clustering.tau})`
    : "disabled";

  console.log("About to run:");
  console.log(`  Question: ${truncatedQuestion}`);
  console.log(`  Protocol: ${protocol}`);
  console.log(`  Trials: ${kMax} | batch ${batchSize} | workers ${workers}`);
  console.log(`  Models: ${models}`);
  console.log(`  Clustering: ${clustering}`);
};

const maybeRenderReceipt = async (runDir: string, useInk: boolean): Promise<void> => {
  const model = buildReceiptModel(runDir);
  const text = formatReceiptText(model);
  writeReceiptText(runDir, text);

  if (useInk) {
    await renderReceiptInk(model);
  } else {
    process.stdout.write(text);
  }
};

const runInit = (parsed: ParsedArgs, assetRoot: string): void => {
  const question = parsed.positional[0];
  const outPath = getFlag(parsed.flags, "--out") ?? DEFAULT_CONFIG_PATH;
  const templateName = getFlag(parsed.flags, "--template") ?? "default";
  const force = hasFlag(parsed.flags, "--force");

  const templatePath = resolve(assetRoot, "templates", `${templateName}.config.json`);
  if (!existsSync(templatePath)) {
    throw new Error(`Template not found: ${templateName}`);
  }

  const targetPath = resolve(process.cwd(), outPath);
  if (existsSync(targetPath) && !force) {
    throw new Error(`Config already exists at ${targetPath}. Use --force to overwrite.`);
  }

  const template = JSON.parse(readFileSync(templatePath, "utf8")) as Record<string, unknown>;
  if (typeof question === "string" && question.trim().length > 0) {
    const questionBlock = (template.question ?? {}) as Record<string, unknown>;
    questionBlock.text = question;
    template.question = questionBlock;
  }

  writeFileSync(targetPath, `${JSON.stringify(template, null, 2)}\n`, "utf8");

  console.log(`Created config: ${targetPath}`);
  console.log("Next steps:");
  console.log("  1) Set OPENROUTER_API_KEY (recommend .env)");
  console.log("  2) arbiter validate");
  console.log("  3) arbiter run");
  console.log("Results will be written under runs/<run_id>/.");
};

const runValidate = (parsed: ParsedArgs, assetRoot: string): void => {
  const configPath = getFlag(parsed.flags, "--config") ?? parsed.positional[0] ?? DEFAULT_CONFIG_PATH;
  const result = resolveConfigForCli(configPath, assetRoot);

  if (result.warnings.length > 0) {
    console.warn("Warnings:");
    result.warnings.forEach((warning) => console.warn(`- ${warning}`));
  }

  console.log(`Config OK: ${resolve(process.cwd(), configPath)}`);
};

const runResolve = (parsed: ParsedArgs, assetRoot: string): void => {
  const configPath = getFlag(parsed.flags, "--config") ?? parsed.positional[0] ?? DEFAULT_CONFIG_PATH;
  const runsDir = getFlag(parsed.flags, "--out") ?? "runs";
  const debug = hasFlag(parsed.flags, "--debug");

  const result = resolveConfigForCli(configPath, assetRoot);
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

const runMockCommand = async (parsed: ParsedArgs, assetRoot: string): Promise<void> => {
  const configPath = getFlag(parsed.flags, "--config") ?? parsed.positional[0] ?? DEFAULT_CONFIG_PATH;
  const runsDir = getFlag(parsed.flags, "--out") ?? "runs";
  const debug = hasFlag(parsed.flags, "--debug");
  const quiet = hasFlag(parsed.flags, "--quiet");

  const result = resolveConfigForCli(configPath, assetRoot);
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
    receiptEnabled: true,
    executionLogEnabled: Boolean(process.stdout.isTTY && !quiet),
    embeddingsJsonlPath,
    catalogVersion: result.catalog.catalog_version,
    catalogSha256: result.catalogSha256,
    promptManifestSha256: result.promptManifestSha256
  });
  writer.attach(bus);
  const monitor = new ClusteringMonitor(result.resolvedConfig, bus);
  monitor.attach();
  const useInk = Boolean(process.stdout.isTTY && !quiet);
  const executionLogPath = resolve(runDir, "execution.log");
  const logger = useInk ? new ExecutionLogger(executionLogPath) : null;
  if (logger) {
    logger.attach(bus);
  }

  let shutdownRequested = false;
  const shutdownController = new AbortController();
  const shutdownTimeoutMs = 30_000;
  let shutdownTimer: ReturnType<typeof setTimeout> | null = null;

  const requestShutdown = (signalName: string): void => {
    if (shutdownRequested) {
      return;
    }
    shutdownRequested = true;
    console.warn(`${signalName} received: stopping new trials, waiting for in-flight to finish...`);
    shutdownTimer = setTimeout(() => shutdownController.abort(), shutdownTimeoutMs);
  };

  process.once("SIGINT", () => requestShutdown("SIGINT"));
  process.once("SIGTERM", () => requestShutdown("SIGTERM"));

  let mockResult;
  let runError: Error | null = null;
  try {
    mockResult = await runMock({
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
  } catch (error) {
    runError = error instanceof Error ? error : new Error(String(error));
  } finally {
    if (shutdownTimer) {
      clearTimeout(shutdownTimer);
      shutdownTimer = null;
    }
    await writer.close();
    writer.detach();
    monitor.detach();
    await logger?.close();
    logger?.detach();
  }

  if (result.warnings.length > 0) {
    console.warn("Warnings:");
    result.warnings.forEach((warning) => console.warn(`- ${warning}`));
  }

  try {
    await maybeRenderReceipt(runDir, useInk);
  } catch (error) {
    console.warn(`Failed to render receipt: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (runError) {
    throw runError;
  }
};

const runLiveCommand = async (parsed: ParsedArgs, assetRoot: string): Promise<void> => {
  const configPath = getFlag(parsed.flags, "--config") ?? parsed.positional[0] ?? DEFAULT_CONFIG_PATH;
  const runsDir = getFlag(parsed.flags, "--out") ?? "runs";
  const debug = hasFlag(parsed.flags, "--debug");
  const quiet = hasFlag(parsed.flags, "--quiet");

  const result = resolveConfigForCli(configPath, assetRoot);
  printRunPreview(result.resolvedConfig);
  const runId = generateRunId();
  const { runDir } = createRunDir({ outRoot: runsDir, runId, debug });

  const maxTrials = getFlagNumber(parsed.flags, "--max-trials");
  const batchSize = getFlagNumber(parsed.flags, "--batch-size");
  const workers = getFlagNumber(parsed.flags, "--workers");

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
    receiptEnabled: true,
    executionLogEnabled: Boolean(process.stdout.isTTY && !quiet),
    embeddingsJsonlPath,
    catalogVersion: result.catalog.catalog_version,
    catalogSha256: result.catalogSha256,
    promptManifestSha256: result.promptManifestSha256
  });
  writer.attach(bus);
  const monitor = new ClusteringMonitor(result.resolvedConfig, bus);
  monitor.attach();
  const useInk = Boolean(process.stdout.isTTY && !quiet);
  const executionLogPath = resolve(runDir, "execution.log");
  const logger = useInk ? new ExecutionLogger(executionLogPath) : null;
  if (logger) {
    logger.attach(bus);
  }

  let shutdownRequested = false;
  const shutdownController = new AbortController();
  const shutdownTimeoutMs = 30_000;
  let shutdownTimer: ReturnType<typeof setTimeout> | null = null;

  const requestShutdown = (signalName: string): void => {
    if (shutdownRequested) {
      return;
    }
    shutdownRequested = true;
    console.warn(`${signalName} received: stopping new trials, waiting for in-flight to finish...`);
    shutdownTimer = setTimeout(() => shutdownController.abort(), shutdownTimeoutMs);
  };

  process.once("SIGINT", () => requestShutdown("SIGINT"));
  process.once("SIGTERM", () => requestShutdown("SIGTERM"));

  let liveResult;
  let runError: Error | null = null;
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
  } catch (error) {
    runError = error instanceof Error ? error : new Error(String(error));
  } finally {
    if (shutdownTimer) {
      clearTimeout(shutdownTimer);
      shutdownTimer = null;
    }
    await writer.close();
    writer.detach();
    monitor.detach();
    await logger?.close();
    logger?.detach();
  }

  if (result.warnings.length > 0) {
    console.warn("Warnings:");
    result.warnings.forEach((warning) => console.warn(`- ${warning}`));
  }

  try {
    await maybeRenderReceipt(runDir, useInk);
  } catch (error) {
    console.warn(`Failed to render receipt: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (runError) {
    throw runError;
  }
};

const main = async (): Promise<void> => {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    printUsage();
    process.exit(0);
  }

  const command = args[0];
  const parsed = parseArgs(args.slice(1));
  const assetRoot = getAssetRoot();

  try {
    if (command === "init") {
      runInit(parsed, assetRoot);
      return;
    }
    if (command === "validate") {
      runValidate(parsed, assetRoot);
      return;
    }
    if (command === "resolve") {
      runResolve(parsed, assetRoot);
      return;
    }
    if (command === "mock-run") {
      await runMockCommand(parsed, assetRoot);
      return;
    }
    if (command === "run") {
      if (!process.env.OPENROUTER_API_KEY) {
        console.error("Missing OPENROUTER_API_KEY for live runs.");
        console.error("Set it via environment or a .env file (dotenv is loaded).");
        console.error("Quick start:");
        console.error("  export OPENROUTER_API_KEY=...your key...");
        console.error("  arbiter validate");
        console.error("  arbiter run");
        process.exit(1);
      }
      await runLiveCommand(parsed, assetRoot);
      return;
    }

    printUsage();
    process.exit(1);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  }
};

void main();
