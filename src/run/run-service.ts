import { mkdirSync } from "node:fs";
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
import {
  evaluatePolicy,
  type ContractFailurePolicy,
  type RunPolicySnapshot
} from "../config/policy.js";
import type { ArbiterResolvedConfig } from "../generated/config.types.js";
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

type RunMode = "mock" | "live";

type RunInputs = {
  configPath: string;
  runsDir: string;
  debug: boolean;
  quiet: boolean;
  warningSink: WarningSink;
};

const resolveRunInputs = (options: RunServiceOptions): RunInputs => ({
  configPath: resolve(process.cwd(), options.configPath),
  runsDir: options.runsDir ?? "runs",
  debug: options.debug ?? false,
  quiet: options.quiet ?? false,
  warningSink: options.warningSink ?? createConsoleWarningSink()
});

const applyExecutionOverrides = (
  resolvedConfig: ArbiterResolvedConfig,
  overrides?: LiveOverrides
): void => {
  if (!overrides) {
    return;
  }

  if (overrides.maxTrials !== undefined) {
    resolvedConfig.execution.k_max = Math.max(1, Math.floor(overrides.maxTrials));
  }
  if (overrides.batchSize !== undefined) {
    resolvedConfig.execution.batch_size = Math.max(1, Math.floor(overrides.batchSize));
  }
  if (overrides.workers !== undefined) {
    resolvedConfig.execution.workers = Math.max(1, Math.floor(overrides.workers));
  }

  if (!validateConfig(resolvedConfig)) {
    throw new Error("Resolved config became invalid after overrides");
  }
};

type PreparedRunContext = {
  bus: EventBus;
  writer: ArtifactWriter;
  monitor: ClusteringMonitor;
  shutdown: {
    signal: AbortSignal;
    isRequested: () => boolean;
    dispose: () => void;
  };
  stopWarningForwarder: () => void;
  lifecycleContext: RunLifecycleContext;
  policy: RunPolicySnapshot;
  compiled: ReturnType<typeof compileRunPlan>;
  runDir: string;
  runId: string;
  embeddingsJsonlPath: string;
  warningSink: WarningSink;
};

const prepareRunContext = (input: {
  mode: RunMode;
  options: RunServiceOptions;
  overrides?: LiveOverrides;
}): PreparedRunContext => {
  const runInputs = resolveRunInputs(input.options);
  const configRoot = dirname(runInputs.configPath);
  const result = resolveConfig({
    configPath: runInputs.configPath,
    configRoot,
    assetRoot: input.options.assetRoot
  });
  result.warnings.forEach((warning) => runInputs.warningSink.warn(warning, "config"));

  applyExecutionOverrides(result.resolvedConfig, input.overrides);

  const policy = resolvePolicy({
    resolvedConfig: result.resolvedConfig,
    catalog: result.catalog,
    policy: input.options.policy,
    warningSink: runInputs.warningSink
  });

  const runId = generateRunId();
  const { runDir } = createRunDir({ outRoot: runInputs.runsDir, runId, debug: runInputs.debug });

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

  const bus = input.options.bus ?? new EventBus();
  const forwardWarnings = input.options.forwardWarningEvents ?? true;
  const stopWarningForwarder = registerWarningForwarder(bus, runInputs.warningSink, forwardWarnings);

  const writer = new ArtifactWriter({
    runDir,
    runId,
    resolvedConfig: compiled.resolvedConfig,
    debugEnabled: runInputs.debug,
    embeddingsJsonlPath,
    catalogVersion: result.catalog.catalog_version,
    catalogSha256: result.catalogSha256,
    promptManifestSha256: result.promptManifestSha256,
    packageJsonPath: resolve(input.options.assetRoot, "package.json"),
    policy
  });
  writer.attach(bus);

  const monitor = new ClusteringMonitor(compiled.resolvedConfig, bus, runInputs.warningSink);
  monitor.attach();

  const lifecycleContext: RunLifecycleContext = {
    mode: input.mode,
    bus,
    runDir,
    runId,
    resolvedConfig: compiled.resolvedConfig,
    debug: runInputs.debug,
    quiet: runInputs.quiet,
    receiptMode: input.options.receiptMode ?? "auto",
    warningSink: runInputs.warningSink
  };

  const shutdown = setupShutdownHandlers({
    warningSink: runInputs.warningSink,
    timeoutMs: 30_000
  });

  return {
    bus,
    writer,
    monitor,
    shutdown,
    stopWarningForwarder,
    lifecycleContext,
    policy,
    compiled,
    runDir,
    runId,
    embeddingsJsonlPath,
    warningSink: runInputs.warningSink
  };
};

const runWithLifecycle = async <T extends { contractFailures: { fallback: number; failed: number; total: number } }>(
  input: {
    context: PreparedRunContext;
    hooks?: RunLifecycleHooks;
    modeLabel: string;
    execute: () => Promise<T>;
  }
): Promise<T> => {
  try {
    await input.hooks?.onRunSetup?.(input.context.lifecycleContext);
  } catch (error) {
    input.context.warningSink.warn(
      `Run lifecycle setup failed: ${error instanceof Error ? error.message : String(error)}`,
      "lifecycle"
    );
  }

  let result: T | undefined;
  let runError: Error | null = null;

  try {
    result = await input.execute();
  } catch (error) {
    runError = error instanceof Error ? error : new Error(String(error));
  } finally {
    input.context.shutdown.dispose();
    await input.context.writer.close();
    try {
      await input.hooks?.onRunFinally?.(input.context.lifecycleContext);
    } catch (error) {
      input.context.warningSink.warn(
        `Run lifecycle finalization failed: ${error instanceof Error ? error.message : String(error)}`,
        "lifecycle"
      );
    }
    input.context.writer.detach();
    input.context.monitor.detach();
    input.context.stopWarningForwarder();
  }

  if (runError) {
    throw runError;
  }
  if (!result) {
    throw new Error(`${input.modeLabel} run completed without a result`);
  }

  assertContractFailurePolicy({
    policy: input.context.policy,
    contractFailures: result.contractFailures
  });

  return result;
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

export const runMockService = async (
  options: RunServiceOptions & { overrides?: LiveOverrides }
): Promise<unknown> => {
  const context = prepareRunContext({
    mode: "mock",
    options,
    overrides: options.overrides
  });

  return runWithLifecycle<MockRunResult>({
    context,
    hooks: options.hooks,
    modeLabel: "Mock",
    execute: () =>
      runMock({
        bus: context.bus,
        runDir: context.runDir,
        resolvedConfig: context.compiled.resolvedConfig,
        embeddingsJsonlPath: context.embeddingsJsonlPath,
        debugEnabled: context.lifecycleContext.debug,
        contractFailurePolicy: context.policy.contract_failure_policy,
        beforeFinalize: async () => context.writer.close(),
        stop: {
          shouldStop: () => context.monitor.getShouldStop()
        },
        shutdown: {
          signal: context.shutdown.signal,
          isRequested: () => context.shutdown.isRequested()
        },
        precomputedPlan: {
          plan: context.compiled.plan,
          planSha256: context.compiled.planSha256
        }
      })
  });
};

export const runLiveService = async (
  options: RunServiceOptions & { overrides?: LiveOverrides }
): Promise<unknown> => {
  const context = prepareRunContext({
    mode: "live",
    options,
    overrides: options.overrides
  });

  return runWithLifecycle<LiveRunResult>({
    context,
    hooks: options.hooks,
    modeLabel: "Live",
    execute: () =>
      runLive({
        bus: context.bus,
        runDir: context.runDir,
        resolvedConfig: context.compiled.resolvedConfig,
        embeddingsJsonlPath: context.embeddingsJsonlPath,
        debugEnabled: context.lifecycleContext.debug,
        contractFailurePolicy: context.policy.contract_failure_policy,
        beforeFinalize: async () => context.writer.close(),
        stop: {
          shouldStop: () => context.monitor.getShouldStop()
        },
        shutdown: {
          signal: context.shutdown.signal,
          isRequested: () => context.shutdown.isRequested()
        },
        precomputedPlan: {
          plan: context.compiled.plan,
          planSha256: context.compiled.planSha256
        }
      })
  });
};
