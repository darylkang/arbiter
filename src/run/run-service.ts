import { existsSync, mkdirSync } from "node:fs";
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
import { evaluatePolicy, type ContractFailurePolicy, type RunPolicySnapshot } from "../config/policy.js";
import { createConsoleWarningSink, type WarningSink } from "../utils/warnings.js";

export type RunServicePolicy = {
  strict?: boolean;
  allowFree?: boolean;
  allowAliased?: boolean;
  contractFailurePolicy?: ContractFailurePolicy;
};

export type RunServiceOptions = {
  configPath: string;
  assetRoot: string;
  runsDir?: string;
  debug?: boolean;
  quiet?: boolean;
  bus?: EventBus;
  receiptMode?: "auto" | "writeOnly" | "skip";
  forceInk?: boolean;
  warningSink?: WarningSink;
  forwardWarningEvents?: boolean;
  policy?: RunServicePolicy;
};

export type LiveOverrides = {
  maxTrials?: number;
  batchSize?: number;
  workers?: number;
};

const resolvePolicy = (input: {
  resolvedConfig: ReturnType<typeof resolveConfig>["resolvedConfig"];
  catalog: ReturnType<typeof resolveConfig>["catalog"];
  policy?: RunServicePolicy;
  warningSink: WarningSink;
}): RunPolicySnapshot => {
  const policy = input.policy ?? {};
  const evaluation = evaluatePolicy({
    resolvedConfig: input.resolvedConfig,
    catalog: input.catalog,
    strict: policy.strict ?? false,
    allowFree: policy.allowFree ?? false,
    allowAliased: policy.allowAliased ?? false,
    contractFailurePolicy: policy.contractFailurePolicy ?? "warn"
  });

  if (evaluation.warnings.length > 0) {
    evaluation.warnings.forEach((warning) => input.warningSink.warn(warning, "policy"));
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

const setupShutdownHandlers = (input: {
  warningSink: WarningSink;
  timeoutMs: number;
}): {
  signal: AbortSignal;
  isRequested: () => boolean;
  dispose: () => void;
} => {
  const controller = new AbortController();
  let shutdownRequested = false;
  let shutdownTimer: ReturnType<typeof setTimeout> | null = null;

  const requestShutdown = (signalName: string): void => {
    if (shutdownRequested) {
      return;
    }
    shutdownRequested = true;
    input.warningSink.warn(
      `${signalName} received: stopping new trials, waiting for in-flight to finish...`,
      "shutdown"
    );
    shutdownTimer = setTimeout(() => controller.abort(), input.timeoutMs);
  };

  const onSigint = (): void => requestShutdown("SIGINT");
  const onSigterm = (): void => requestShutdown("SIGTERM");

  process.on("SIGINT", onSigint);
  process.on("SIGTERM", onSigterm);

  const dispose = (): void => {
    process.removeListener("SIGINT", onSigint);
    process.removeListener("SIGTERM", onSigterm);
    if (shutdownTimer) {
      clearTimeout(shutdownTimer);
      shutdownTimer = null;
    }
  };

  return {
    signal: controller.signal,
    isRequested: () => shutdownRequested,
    dispose
  };
};

const registerWarningForwarder = (
  bus: EventBus,
  sink: WarningSink,
  forward: boolean
): (() => void) => {
  if (!forward) {
    return () => {};
  }
  return bus.subscribeSafe("warning.raised", (payload) => {
    sink.warn(payload.message, payload.source);
  });
};

export const runResolveService = (options: {
  configPath: string;
  assetRoot: string;
  runsDir?: string;
  debug?: boolean;
  warningSink?: WarningSink;
}): { runId: string; runDir: string } => {
  const configPath = options.configPath;
  const runsDir = options.runsDir ?? "runs";
  const debug = options.debug ?? false;
  const warningSink = options.warningSink ?? createConsoleWarningSink();

  const configRoot = dirname(resolve(process.cwd(), configPath));
  const result = resolveConfig({ configPath, configRoot, assetRoot: options.assetRoot });
  result.warnings.forEach((warning) => warningSink.warn(warning, "config"));

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

  return { runId, runDir };
};

export const runMockService = async (options: RunServiceOptions): Promise<unknown> => {
  const configPath = options.configPath;
  const runsDir = options.runsDir ?? "runs";
  const debug = options.debug ?? false;
  const quiet = options.quiet ?? false;
  const warningSink = options.warningSink ?? createConsoleWarningSink();

  const configRoot = dirname(resolve(process.cwd(), configPath));
  const result = resolveConfig({ configPath, configRoot, assetRoot: options.assetRoot });
  result.warnings.forEach((warning) => warningSink.warn(warning, "config"));
  const policy = resolvePolicy({
    resolvedConfig: result.resolvedConfig,
    catalog: result.catalog,
    policy: options.policy,
    warningSink
  });

  const runId = generateRunId();
  const { runDir } = createRunDir({ outRoot: runsDir, runId, debug });

  result.resolvedConfig.run.run_id = runId;

  const debugDir = resolve(runDir, "debug");
  mkdirSync(debugDir, { recursive: true });
  const embeddingsJsonlPath = resolve(debugDir, "embeddings.jsonl");

  const bus = options.bus ?? new EventBus();
  const forwardWarnings = options.forwardWarningEvents ?? true;
  const stopWarningForwarder = registerWarningForwarder(bus, warningSink, forwardWarnings);

  const writer = new ArtifactWriter({
    runDir,
    runId,
    resolvedConfig: result.resolvedConfig,
    debugEnabled: debug,
    embeddingsJsonlPath,
    catalogVersion: result.catalog.catalog_version,
    catalogSha256: result.catalogSha256,
    promptManifestSha256: result.promptManifestSha256,
    packageJsonPath: resolve(options.assetRoot, "package.json"),
    policy
  });
  writer.attach(bus);
  const monitor = new ClusteringMonitor(result.resolvedConfig, bus, warningSink);
  monitor.attach();
  const useInk = options.forceInk ?? Boolean(process.stdout.isTTY && !quiet);
  const executionLogPath = resolve(runDir, "execution.log");
  const logger = useInk ? new ExecutionLogger(executionLogPath) : null;
  if (logger) {
    logger.attach(bus);
  }

  const shutdown = setupShutdownHandlers({ warningSink, timeoutMs: 30_000 });

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
        signal: shutdown.signal,
        isRequested: () => shutdown.isRequested()
      }
    });
  } catch (error) {
    runError = error instanceof Error ? error : new Error(String(error));
  } finally {
    shutdown.dispose();
    await writer.close();
    await logger?.close();
    if (logger) {
      bus.emit({ type: "artifact.written", payload: { path: "execution.log" } });
    }
    try {
      const receiptPath = await maybeRenderReceipt(
        runDir,
        useInk,
        options.receiptMode ?? "auto"
      );
      if (receiptPath) {
        bus.emit({ type: "artifact.written", payload: { path: "receipt.txt" } });
      }
    } catch (error) {
      warningSink.warn(
        `Failed to render receipt: ${error instanceof Error ? error.message : String(error)}`,
        "receipt"
      );
    }
    writer.detach();
    monitor.detach();
    logger?.detach();
    stopWarningForwarder();
  }

  if (runError) {
    throw runError;
  }

  return mockResult;
};

export const runLiveService = async (
  options: RunServiceOptions & { overrides?: LiveOverrides }
): Promise<unknown> => {
  const configPath = options.configPath;
  const runsDir = options.runsDir ?? "runs";
  const debug = options.debug ?? false;
  const quiet = options.quiet ?? false;
  const warningSink = options.warningSink ?? createConsoleWarningSink();

  const configRoot = dirname(resolve(process.cwd(), configPath));
  const result = resolveConfig({ configPath, configRoot, assetRoot: options.assetRoot });
  result.warnings.forEach((warning) => warningSink.warn(warning, "config"));

  const runId = generateRunId();
  const { runDir } = createRunDir({ outRoot: runsDir, runId, debug });

  result.resolvedConfig.run.run_id = runId;
  if (options.overrides?.maxTrials !== undefined) {
    result.resolvedConfig.execution.k_max = Math.max(1, Math.floor(options.overrides.maxTrials));
  }
  if (options.overrides?.batchSize !== undefined) {
    result.resolvedConfig.execution.batch_size = Math.max(
      1,
      Math.floor(options.overrides.batchSize)
    );
  }
  if (options.overrides?.workers !== undefined) {
    result.resolvedConfig.execution.workers = Math.max(1, Math.floor(options.overrides.workers));
  }

  if (!validateConfig(result.resolvedConfig)) {
    throw new Error("Resolved config became invalid after overrides");
  }

  const policy = resolvePolicy({
    resolvedConfig: result.resolvedConfig,
    catalog: result.catalog,
    policy: options.policy,
    warningSink
  });

  const debugDir = resolve(runDir, "debug");
  mkdirSync(debugDir, { recursive: true });
  const embeddingsJsonlPath = resolve(debugDir, "embeddings.jsonl");

  const bus = options.bus ?? new EventBus();
  const forwardWarnings = options.forwardWarningEvents ?? true;
  const stopWarningForwarder = registerWarningForwarder(bus, warningSink, forwardWarnings);

  const writer = new ArtifactWriter({
    runDir,
    runId,
    resolvedConfig: result.resolvedConfig,
    debugEnabled: debug,
    embeddingsJsonlPath,
    catalogVersion: result.catalog.catalog_version,
    catalogSha256: result.catalogSha256,
    promptManifestSha256: result.promptManifestSha256,
    packageJsonPath: resolve(options.assetRoot, "package.json"),
    policy
  });
  writer.attach(bus);
  const monitor = new ClusteringMonitor(result.resolvedConfig, bus, warningSink);
  monitor.attach();
  const useInk = options.forceInk ?? Boolean(process.stdout.isTTY && !quiet);
  const executionLogPath = resolve(runDir, "execution.log");
  const logger = useInk ? new ExecutionLogger(executionLogPath) : null;
  if (logger) {
    logger.attach(bus);
  }

  const shutdown = setupShutdownHandlers({ warningSink, timeoutMs: 30_000 });

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
        signal: shutdown.signal,
        isRequested: () => shutdown.isRequested()
      }
    });
  } catch (error) {
    runError = error instanceof Error ? error : new Error(String(error));
  } finally {
    shutdown.dispose();
    await writer.close();
    await logger?.close();
    if (logger) {
      bus.emit({ type: "artifact.written", payload: { path: "execution.log" } });
    }
    try {
      const receiptPath = await maybeRenderReceipt(
        runDir,
        useInk,
        options.receiptMode ?? "auto"
      );
      if (receiptPath) {
        bus.emit({ type: "artifact.written", payload: { path: "receipt.txt" } });
      }
    } catch (error) {
      warningSink.warn(
        `Failed to render receipt: ${error instanceof Error ? error.message : String(error)}`,
        "receipt"
      );
    }
    writer.detach();
    monitor.detach();
    logger?.detach();
    stopWarningForwarder();
  }

  if (runError) {
    throw runError;
  }

  return liveResult;
};
