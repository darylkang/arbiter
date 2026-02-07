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
import { runMock, type MockRunResult } from "../engine/mock-runner.js";
import { runLive, type LiveRunResult } from "../engine/live-runner.js";
import { validateConfig } from "../config/schema-validation.js";
import { evaluatePolicy, type ContractFailurePolicy, type RunPolicySnapshot } from "../config/policy.js";
import { createConsoleWarningSink, type WarningSink } from "../utils/warnings.js";
import { compileRunPlan } from "../planning/compiled-plan.js";
import type { RunLifecycleContext, RunLifecycleHooks } from "./lifecycle-hooks.js";

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
  hooks?: RunLifecycleHooks;
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

const assertContractFailurePolicy = (input: {
  policy: RunPolicySnapshot;
  contractFailures: {
    fallback: number;
    failed: number;
    total: number;
  };
}): void => {
  if (input.policy.contract_failure_policy !== "fail") {
    return;
  }
  if (input.contractFailures.total === 0) {
    return;
  }
  throw new Error(
    `Contract parse failures: fallback=${input.contractFailures.fallback}, failed=${input.contractFailures.failed}`
  );
};

export const runResolveService = (options: {
  configPath: string;
  assetRoot: string;
  runsDir?: string;
  warningSink?: WarningSink;
}): { runId: string; runDir: string } => {
  const configPath = resolve(process.cwd(), options.configPath);
  const runsDir = options.runsDir ?? "runs";
  const warningSink = options.warningSink ?? createConsoleWarningSink();

  const configRoot = dirname(configPath);
  const result = resolveConfig({ configPath, configRoot, assetRoot: options.assetRoot });
  result.warnings.forEach((warning) => warningSink.warn(warning, "config"));

  const runId = generateRunId();
  const { runDir } = createRunDir({ outRoot: runsDir, runId, debug: false });

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
    manifest
  });

  return { runId, runDir };
};

export const runMockService = async (options: RunServiceOptions): Promise<unknown> => {
  const configPath = resolve(process.cwd(), options.configPath);
  const runsDir = options.runsDir ?? "runs";
  const debug = options.debug ?? false;
  const quiet = options.quiet ?? false;
  const warningSink = options.warningSink ?? createConsoleWarningSink();

  const configRoot = dirname(configPath);
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

  const compiled = compileRunPlan({
    runId,
    runDir,
    resolvedConfig: result.resolvedConfig,
    policy
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
    resolvedConfig: compiled.resolvedConfig,
    debugEnabled: debug,
    embeddingsJsonlPath,
    catalogVersion: result.catalog.catalog_version,
    catalogSha256: result.catalogSha256,
    promptManifestSha256: result.promptManifestSha256,
    packageJsonPath: resolve(options.assetRoot, "package.json"),
    policy
  });
  writer.attach(bus);
  const monitor = new ClusteringMonitor(compiled.resolvedConfig, bus, warningSink);
  monitor.attach();
  const lifecycleContext: RunLifecycleContext = {
    mode: "mock",
    bus,
    runDir,
    runId,
    resolvedConfig: compiled.resolvedConfig,
    debug,
    quiet,
    receiptMode: options.receiptMode ?? "auto",
    warningSink
  };
  try {
    await options.hooks?.onRunSetup?.(lifecycleContext);
  } catch (error) {
    warningSink.warn(
      `Run lifecycle setup failed: ${error instanceof Error ? error.message : String(error)}`,
      "lifecycle"
    );
  }

  const shutdown = setupShutdownHandlers({ warningSink, timeoutMs: 30_000 });

  let mockResult: MockRunResult | undefined;
  let runError: Error | null = null;
  try {
    mockResult = await runMock({
      bus,
      runDir,
      resolvedConfig: compiled.resolvedConfig,
      embeddingsJsonlPath,
      debugEnabled: debug,
      contractFailurePolicy: policy.contract_failure_policy,
      beforeFinalize: async () => writer.close(),
      stop: {
        shouldStop: () => monitor.getShouldStop()
      },
      shutdown: {
        signal: shutdown.signal,
        isRequested: () => shutdown.isRequested()
      },
      precomputedPlan: {
        plan: compiled.plan,
        planSha256: compiled.planSha256
      }
    });
  } catch (error) {
    runError = error instanceof Error ? error : new Error(String(error));
  } finally {
    shutdown.dispose();
    await writer.close();
    try {
      await options.hooks?.onRunFinally?.(lifecycleContext);
    } catch (error) {
      warningSink.warn(
        `Run lifecycle finalization failed: ${error instanceof Error ? error.message : String(error)}`,
        "lifecycle"
      );
    }
    writer.detach();
    monitor.detach();
    stopWarningForwarder();
  }

  if (runError) {
    throw runError;
  }
  if (!mockResult) {
    throw new Error("Mock run completed without a result");
  }
  assertContractFailurePolicy({
    policy,
    contractFailures: mockResult.contractFailures
  });

  return mockResult;
};

export const runLiveService = async (
  options: RunServiceOptions & { overrides?: LiveOverrides }
): Promise<unknown> => {
  const configPath = resolve(process.cwd(), options.configPath);
  const runsDir = options.runsDir ?? "runs";
  const debug = options.debug ?? false;
  const quiet = options.quiet ?? false;
  const warningSink = options.warningSink ?? createConsoleWarningSink();

  const configRoot = dirname(configPath);
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

  const compiled = compileRunPlan({
    runId,
    runDir,
    resolvedConfig: result.resolvedConfig,
    policy
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
    resolvedConfig: compiled.resolvedConfig,
    debugEnabled: debug,
    embeddingsJsonlPath,
    catalogVersion: result.catalog.catalog_version,
    catalogSha256: result.catalogSha256,
    promptManifestSha256: result.promptManifestSha256,
    packageJsonPath: resolve(options.assetRoot, "package.json"),
    policy
  });
  writer.attach(bus);
  const monitor = new ClusteringMonitor(compiled.resolvedConfig, bus, warningSink);
  monitor.attach();
  const lifecycleContext: RunLifecycleContext = {
    mode: "live",
    bus,
    runDir,
    runId,
    resolvedConfig: compiled.resolvedConfig,
    debug,
    quiet,
    receiptMode: options.receiptMode ?? "auto",
    warningSink
  };
  try {
    await options.hooks?.onRunSetup?.(lifecycleContext);
  } catch (error) {
    warningSink.warn(
      `Run lifecycle setup failed: ${error instanceof Error ? error.message : String(error)}`,
      "lifecycle"
    );
  }

  const shutdown = setupShutdownHandlers({ warningSink, timeoutMs: 30_000 });

  let liveResult: LiveRunResult | undefined;
  let runError: Error | null = null;
  try {
    liveResult = await runLive({
      bus,
      runDir,
      resolvedConfig: compiled.resolvedConfig,
      embeddingsJsonlPath,
      debugEnabled: debug,
      contractFailurePolicy: policy.contract_failure_policy,
      beforeFinalize: async () => writer.close(),
      stop: {
        shouldStop: () => monitor.getShouldStop()
      },
      shutdown: {
        signal: shutdown.signal,
        isRequested: () => shutdown.isRequested()
      },
      precomputedPlan: {
        plan: compiled.plan,
        planSha256: compiled.planSha256
      }
    });
  } catch (error) {
    runError = error instanceof Error ? error : new Error(String(error));
  } finally {
    shutdown.dispose();
    await writer.close();
    try {
      await options.hooks?.onRunFinally?.(lifecycleContext);
    } catch (error) {
      warningSink.warn(
        `Run lifecycle finalization failed: ${error instanceof Error ? error.message : String(error)}`,
        "lifecycle"
      );
    }
    writer.detach();
    monitor.detach();
    stopWarningForwarder();
  }

  if (runError) {
    throw runError;
  }
  if (!liveResult) {
    throw new Error("Live run completed without a result");
  }
  assertContractFailurePolicy({
    policy,
    contractFailures: liveResult.contractFailures
  });

  return liveResult;
};
