import "dotenv/config";

import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { resolveConfig } from "../config/resolve-config.js";
import { buildResolveManifest } from "../config/manifest.js";
import { generateRunId } from "../artifacts/run-id.js";
import { createRunDir } from "../artifacts/run-dir.js";
import { writeResolveArtifacts } from "../artifacts/resolve-artifacts.js";
import { EventBus } from "../events/event-bus.js";
import { ArtifactWriter } from "../artifacts/artifact-writer.js";
import { ClusteringMonitor } from "../clustering/monitor.js";
import { runMock } from "../engine/mock-runner.js";
import { runLive } from "../engine/live-runner.js";
import { validateConfig } from "../config/schema-validation.js";
import { buildReceiptModel } from "../ui/receipt-model.js";
import { formatReceiptText } from "../ui/receipt-text.js";
import { renderReceiptInk } from "../ui/receipt-ink.js";
import { writeReceiptText } from "../ui/receipt-writer.js";
import { ExecutionLogger } from "../ui/execution-log.js";
import { evaluatePolicy, type ContractFailurePolicy } from "../config/policy.js";

export const DEFAULT_CONFIG_PATH = "arbiter.config.json";

export type ParsedArgs = {
  positional: string[];
  flags: Record<string, string | boolean>;
};

export const parseArgs = (args: string[]): ParsedArgs => {
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

export const getFlag = (flags: ParsedArgs["flags"], name: string): string | undefined => {
  const value = flags[name];
  return typeof value === "string" ? value : undefined;
};

export const hasFlag = (flags: ParsedArgs["flags"], name: string): boolean => Boolean(flags[name]);

export const getFlagNumber = (flags: ParsedArgs["flags"], name: string): number | undefined => {
  const value = getFlag(flags, name);
  if (!value) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export const resolvePolicyFlags = (flags: ParsedArgs["flags"]): {
  strict: boolean;
  allowFree: boolean;
  allowAliased: boolean;
  contractFailurePolicy: ContractFailurePolicy;
} => {
  const strictFlag = hasFlag(flags, "--strict");
  const permissiveFlag = hasFlag(flags, "--permissive");
  if (strictFlag && permissiveFlag) {
    throw new Error("Use either --strict or --permissive (not both).");
  }

  const contractFailure = getFlag(flags, "--contract-failure") ?? "warn";
  if (contractFailure !== "warn" && contractFailure !== "exclude" && contractFailure !== "fail") {
    throw new Error("Invalid --contract-failure value (expected warn|exclude|fail).");
  }

  return {
    strict: strictFlag,
    allowFree: hasFlag(flags, "--allow-free"),
    allowAliased: hasFlag(flags, "--allow-aliased"),
    contractFailurePolicy: contractFailure as ContractFailurePolicy
  };
};

export const resolveConfigForCli = (configPathInput: string, assetRoot: string) => {
  const configPath = resolve(process.cwd(), configPathInput);
  const configRoot = dirname(configPath);
  return resolveConfig({ configPath, configRoot, assetRoot });
};

export const applyPolicy = (
  resolvedConfig: ReturnType<typeof resolveConfigForCli>["resolvedConfig"],
  catalog: ReturnType<typeof resolveConfigForCli>["catalog"],
  flags: ParsedArgs["flags"]
) => {
  const policyFlags = resolvePolicyFlags(flags);
  const evaluation = evaluatePolicy({
    resolvedConfig,
    catalog,
    strict: policyFlags.strict,
    allowFree: policyFlags.allowFree,
    allowAliased: policyFlags.allowAliased,
    contractFailurePolicy: policyFlags.contractFailurePolicy
  });

  if (evaluation.warnings.length > 0) {
    console.warn("Policy warnings:");
    evaluation.warnings.forEach((warning) => console.warn(`- ${warning}`));
  }
  if (evaluation.errors.length > 0) {
    throw new Error(`Policy violations:\n${evaluation.errors.map((msg) => `- ${msg}`).join("\n")}`);
  }

  return evaluation.policy;
};

const maybeRenderReceipt = async (
  runDir: string,
  useInk: boolean,
  mode: "auto" | "writeOnly" | "skip"
): Promise<string | null> => {
  if (mode === "skip") {
    return null;
  }
  const model = buildReceiptModel(runDir);
  const text = formatReceiptText(model);
  const path = writeReceiptText(runDir, text);

  if (mode === "auto") {
    if (useInk) {
      await renderReceiptInk(model);
    } else {
      process.stdout.write(text);
    }
  }

  return path;
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

export type RunCommandOptions = {
  bus?: EventBus;
  receiptMode?: "auto" | "writeOnly" | "skip";
  forceInk?: boolean;
  showPreview?: boolean;
};

export const runResolve = (parsed: ParsedArgs, assetRoot: string): void => {
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

export const runMockCommand = async (
  parsed: ParsedArgs,
  assetRoot: string,
  options?: RunCommandOptions
): Promise<unknown> => {
  const configPath = getFlag(parsed.flags, "--config") ?? parsed.positional[0] ?? DEFAULT_CONFIG_PATH;
  const runsDir = getFlag(parsed.flags, "--out") ?? "runs";
  const debug = hasFlag(parsed.flags, "--debug");
  const quiet = hasFlag(parsed.flags, "--quiet");

  const result = resolveConfigForCli(configPath, assetRoot);
  const policy = applyPolicy(result.resolvedConfig, result.catalog, parsed.flags);
  const runId = generateRunId();
  const { runDir } = createRunDir({ outRoot: runsDir, runId, debug });

  result.resolvedConfig.run.run_id = runId;

  const debugDir = resolve(runDir, "debug");
  mkdirSync(debugDir, { recursive: true });
  const embeddingsJsonlPath = resolve(debugDir, "embeddings.jsonl");

  const bus = options?.bus ?? new EventBus();
  const writer = new ArtifactWriter({
    runDir,
    runId,
    resolvedConfig: result.resolvedConfig,
    debugEnabled: debug,
    embeddingsJsonlPath,
    catalogVersion: result.catalog.catalog_version,
    catalogSha256: result.catalogSha256,
    promptManifestSha256: result.promptManifestSha256,
    packageJsonPath: resolve(assetRoot, "package.json"),
    policy
  });
  writer.attach(bus);
  const monitor = new ClusteringMonitor(result.resolvedConfig, bus);
  monitor.attach();
  const useInk = options?.forceInk ?? Boolean(process.stdout.isTTY && !quiet);
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
      stop: {
        shouldStop: () => monitor.getShouldStop()
      },
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
    await logger?.close();
    if (logger) {
      bus.emit({ type: "artifact.written", payload: { path: "execution.log" } });
    }
    try {
      const receiptPath = await maybeRenderReceipt(
        runDir,
        useInk,
        options?.receiptMode ?? "auto"
      );
      if (receiptPath) {
        bus.emit({ type: "artifact.written", payload: { path: "receipt.txt" } });
      }
    } catch (error) {
      console.warn(
        `Failed to render receipt: ${error instanceof Error ? error.message : String(error)}`
      );
    }
    writer.detach();
    monitor.detach();
    logger?.detach();
  }

  if (result.warnings.length > 0) {
    console.warn("Warnings:");
    result.warnings.forEach((warning) => console.warn(`- ${warning}`));
  }

  if (runError) {
    throw runError;
  }

  return mockResult;
};

export const runLiveCommand = async (
  parsed: ParsedArgs,
  assetRoot: string,
  options?: RunCommandOptions
): Promise<unknown> => {
  const configPath = getFlag(parsed.flags, "--config") ?? parsed.positional[0] ?? DEFAULT_CONFIG_PATH;
  const runsDir = getFlag(parsed.flags, "--out") ?? "runs";
  const debug = hasFlag(parsed.flags, "--debug");
  const quiet = hasFlag(parsed.flags, "--quiet");

  const result = resolveConfigForCli(configPath, assetRoot);
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
  const policy = applyPolicy(result.resolvedConfig, result.catalog, parsed.flags);
  if (options?.showPreview ?? true) {
    printRunPreview(result.resolvedConfig);
  }

  const debugDir = resolve(runDir, "debug");
  mkdirSync(debugDir, { recursive: true });
  const embeddingsJsonlPath = resolve(debugDir, "embeddings.jsonl");

  const bus = options?.bus ?? new EventBus();
  const writer = new ArtifactWriter({
    runDir,
    runId,
    resolvedConfig: result.resolvedConfig,
    debugEnabled: debug,
    embeddingsJsonlPath,
    catalogVersion: result.catalog.catalog_version,
    catalogSha256: result.catalogSha256,
    promptManifestSha256: result.promptManifestSha256,
    packageJsonPath: resolve(assetRoot, "package.json"),
    policy
  });
  writer.attach(bus);
  const monitor = new ClusteringMonitor(result.resolvedConfig, bus);
  monitor.attach();
  const useInk = options?.forceInk ?? Boolean(process.stdout.isTTY && !quiet);
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
      stop: {
        shouldStop: () => monitor.getShouldStop()
      },
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
    await logger?.close();
    if (logger) {
      bus.emit({ type: "artifact.written", payload: { path: "execution.log" } });
    }
    try {
      const receiptPath = await maybeRenderReceipt(
        runDir,
        useInk,
        options?.receiptMode ?? "auto"
      );
      if (receiptPath) {
        bus.emit({ type: "artifact.written", payload: { path: "receipt.txt" } });
      }
    } catch (error) {
      console.warn(
        `Failed to render receipt: ${error instanceof Error ? error.message : String(error)}`
      );
    }
    writer.detach();
    monitor.detach();
    logger?.detach();
  }

  if (result.warnings.length > 0) {
    console.warn("Warnings:");
    result.warnings.forEach((warning) => console.warn(`- ${warning}`));
  }

  if (runError) {
    throw runError;
  }

  return liveResult;
};
