#!/usr/bin/env node
import "dotenv/config";

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

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
import { evaluatePolicy, type ContractFailurePolicy } from "../config/policy.js";
import { getAssetRoot } from "../utils/asset-root.js";
import { buildReceiptModel } from "../ui/receipt-model.js";
import { formatReceiptText } from "../ui/receipt-text.js";
import { renderReceiptInk } from "../ui/receipt-ink.js";
import { writeReceiptText } from "../ui/receipt-writer.js";
import { ExecutionLogger } from "../ui/execution-log.js";
import { formatVerifyReport, verifyRunDir } from "../tools/verify-run.js";
import { buildReportModel, formatReportJson, formatReportText } from "../tools/report-run.js";
import { listModels } from "../openrouter/client.js";

const DEFAULT_CONFIG_PATH = "arbiter.config.json";

const printUsage = (): void => {
  console.log("Wizard coming soon. For now: arbiter init → arbiter validate → arbiter run");
  console.log("Usage:");
  console.log(
    "  arbiter init [question] [--out <path>] [--force] [--template default|quickstart_independent|heterogeneity_mix|debate_v1|free_quickstart|full]"
  );
  console.log(
    "  arbiter quickstart [question] [--profile quickstart|heterogeneity|debate|free] [--mock|--live] [--yes] [--out <runs_dir>]"
  );
  console.log("  arbiter validate [config.json] [--live]");
  console.log("  arbiter resolve [config.json] [--out <runs_dir>] [--debug]");
  console.log("  arbiter mock-run [config.json] [--out <runs_dir>] [--debug] [--quiet]");
  console.log(
    "  arbiter run [config.json] [--out <runs_dir>] [--debug] [--quiet] [--max-trials N] [--batch-size N] [--workers N] [--strict|--permissive]"
  );
  console.log("  arbiter verify <run_dir>");
  console.log("  arbiter report <run_dir> [--format text|json] [--top N]");
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

const PROFILE_TEMPLATES: Record<string, string> = {
  quickstart: "quickstart_independent",
  heterogeneity: "heterogeneity_mix",
  debate: "debate_v1",
  free: "free_quickstart"
};

const resolveTemplateName = (value: string): string =>
  PROFILE_TEMPLATES[value] ?? value;

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

const resolvePolicyFlags = (flags: ParsedArgs["flags"]): {
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

const promptYesNo = async (question: string): Promise<boolean> => {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return false;
  }
  const rl = createInterface({ input, output });
  try {
    const answer = await rl.question(`${question} [y/N]: `);
    return answer.trim().toLowerCase().startsWith("y");
  } finally {
    rl.close();
  }
};

const resolveConfigForCli = (configPathInput: string, assetRoot: string) => {
  const configPath = resolve(process.cwd(), configPathInput);
  const configRoot = dirname(configPath);
  return resolveConfig({ configPath, configRoot, assetRoot });
};

const applyPolicy = (
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

const maybeRenderReceipt = async (runDir: string, useInk: boolean): Promise<string> => {
  const model = buildReceiptModel(runDir);
  const text = formatReceiptText(model);
  const path = writeReceiptText(runDir, text);

  if (useInk) {
    await renderReceiptInk(model);
  } else {
    process.stdout.write(text);
  }

  return path;
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

const runQuickstart = async (parsed: ParsedArgs, assetRoot: string): Promise<void> => {
  const question = parsed.positional[0];
  const profile = resolveTemplateName(getFlag(parsed.flags, "--profile") ?? "quickstart");
  const runsDir = getFlag(parsed.flags, "--out") ?? "runs";
  const force = hasFlag(parsed.flags, "--force");

  const templatePath = resolve(assetRoot, "templates", `${profile}.config.json`);
  if (!existsSync(templatePath)) {
    throw new Error(`Template not found: ${profile}`);
  }

  const targetPath = resolve(process.cwd(), DEFAULT_CONFIG_PATH);
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

  const result = resolveConfigForCli(DEFAULT_CONFIG_PATH, assetRoot);
  if (result.warnings.length > 0) {
    console.warn("Warnings:");
    result.warnings.forEach((warning) => console.warn(`- ${warning}`));
  }

  const hasApiKey = Boolean(process.env.OPENROUTER_API_KEY);
  const wantsMock = hasFlag(parsed.flags, "--mock") || !hasApiKey || !hasFlag(parsed.flags, "--live");
  const wantsLiveExplicit = hasFlag(parsed.flags, "--live");
  const wantsMockExplicit = hasFlag(parsed.flags, "--mock");
  const yes = hasFlag(parsed.flags, "--yes");

  if (wantsLiveExplicit && !hasApiKey) {
    throw new Error("OPENROUTER_API_KEY is required for live runs.");
  }

  const runFlags: ParsedArgs["flags"] = { ...parsed.flags, "--out": runsDir };
  const runParsed: ParsedArgs = { positional: [DEFAULT_CONFIG_PATH], flags: runFlags };

  let lastRunDir: string | undefined;

  if (wantsMock) {
    const result = await runMockCommand(runParsed, assetRoot);
    if (result && typeof result === "object" && "runDir" in result) {
      lastRunDir = (result as { runDir?: string }).runDir;
    }
  }

  if (wantsLiveExplicit) {
    const result = await runLiveCommand(runParsed, assetRoot);
    if (result && typeof result === "object" && "runDir" in result) {
      lastRunDir = (result as { runDir?: string }).runDir;
    }
  } else if (hasApiKey && !wantsMockExplicit) {
    const proceed = yes ? true : await promptYesNo("Run live now?");
    if (proceed) {
      const result = await runLiveCommand(runParsed, assetRoot);
      if (result && typeof result === "object" && "runDir" in result) {
        lastRunDir = (result as { runDir?: string }).runDir;
      }
    }
  }

  if (lastRunDir) {
    console.log(`Run directory: ${lastRunDir}`);
    console.log(`Receipt: ${resolve(lastRunDir, "receipt.txt")}`);
    console.log("Next steps:");
    console.log(`  arbiter report ${lastRunDir}`);
    console.log(`  arbiter verify ${lastRunDir}`);
  }
};

const runValidate = async (parsed: ParsedArgs, assetRoot: string): Promise<void> => {
  const configPath = getFlag(parsed.flags, "--config") ?? parsed.positional[0] ?? DEFAULT_CONFIG_PATH;
  const result = resolveConfigForCli(configPath, assetRoot);
  applyPolicy(result.resolvedConfig, result.catalog, parsed.flags);

  const live = hasFlag(parsed.flags, "--live");
  if (live) {
    if (!process.env.OPENROUTER_API_KEY) {
      throw new Error("OPENROUTER_API_KEY is required for validate --live");
    }
    await listModels();
  }

  if (result.warnings.length > 0) {
    console.warn("Warnings:");
    result.warnings.forEach((warning) => console.warn(`- ${warning}`));
  }

  console.log(`Config OK: ${resolve(process.cwd(), configPath)}`);
  if (live) {
    console.log("OpenRouter connectivity: OK");
  }
};

const runVerify = (parsed: ParsedArgs): void => {
  const runDir = parsed.positional[0];
  if (!runDir) {
    throw new Error("Usage: arbiter verify <run_dir>");
  }
  const report = verifyRunDir(runDir);
  console.log(formatVerifyReport(report));
  if (!report.ok) {
    process.exitCode = 1;
  }
};

const runReport = (parsed: ParsedArgs): void => {
  const runDir = parsed.positional[0];
  if (!runDir) {
    throw new Error("Usage: arbiter report <run_dir>");
  }
  const format = getFlag(parsed.flags, "--format") ?? "text";
  const top = getFlagNumber(parsed.flags, "--top") ?? 3;
  const model = buildReportModel(runDir, top);

  if (format === "json") {
    process.stdout.write(formatReportJson(model));
    return;
  }
  if (format !== "text") {
    throw new Error("Invalid --format (expected text|json)");
  }
  process.stdout.write(formatReportText(model));
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

const runMockCommand = async (parsed: ParsedArgs, assetRoot: string): Promise<unknown> => {
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

  const bus = new EventBus();
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
      await maybeRenderReceipt(runDir, useInk);
      bus.emit({ type: "artifact.written", payload: { path: "receipt.txt" } });
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

const runLiveCommand = async (parsed: ParsedArgs, assetRoot: string): Promise<unknown> => {
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
  printRunPreview(result.resolvedConfig);

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
    promptManifestSha256: result.promptManifestSha256,
    packageJsonPath: resolve(assetRoot, "package.json"),
    policy
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
      await maybeRenderReceipt(runDir, useInk);
      bus.emit({ type: "artifact.written", payload: { path: "receipt.txt" } });
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
    if (command === "quickstart") {
      await runQuickstart(parsed, assetRoot);
      return;
    }
    if (command === "validate") {
      await runValidate(parsed, assetRoot);
      return;
    }
    if (command === "verify") {
      runVerify(parsed);
      return;
    }
    if (command === "report") {
      runReport(parsed);
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
