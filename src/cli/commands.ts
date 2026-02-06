import "dotenv/config";

import { dirname, resolve } from "node:path";

import { resolveConfig } from "../config/resolve-config.js";
import { validateConfig } from "../config/schema-validation.js";
import { EventBus } from "../events/event-bus.js";
import { evaluatePolicy, type ContractFailurePolicy } from "../config/policy.js";
import { runLiveService, runMockService, runResolveService } from "../run/run-service.js";
import { createConsoleWarningSink } from "../utils/warnings.js";

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

  const warningSink = createConsoleWarningSink();
  const { runId, runDir } = runResolveService({
    configPath,
    assetRoot,
    runsDir,
    warningSink
  });

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
  const policy = resolvePolicyFlags(parsed.flags);
  const warningSink = createConsoleWarningSink();

  return runMockService({
    configPath,
    assetRoot,
    runsDir,
    debug,
    quiet,
    bus: options?.bus,
    receiptMode: options?.receiptMode,
    forceInk: options?.forceInk,
    warningSink,
    forwardWarningEvents: true,
    policy
  });
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

  const maxTrials = getFlagNumber(parsed.flags, "--max-trials");
  const batchSize = getFlagNumber(parsed.flags, "--batch-size");
  const workers = getFlagNumber(parsed.flags, "--workers");
  if (options?.showPreview ?? true) {
    const preview = resolveConfigForCli(configPath, assetRoot);
    if (maxTrials !== undefined) {
      preview.resolvedConfig.execution.k_max = Math.max(1, Math.floor(maxTrials));
    }
    if (batchSize !== undefined) {
      preview.resolvedConfig.execution.batch_size = Math.max(1, Math.floor(batchSize));
    }
    if (workers !== undefined) {
      preview.resolvedConfig.execution.workers = Math.max(1, Math.floor(workers));
    }
    if (validateConfig(preview.resolvedConfig)) {
      printRunPreview(preview.resolvedConfig);
    }
  }

  const policy = resolvePolicyFlags(parsed.flags);
  const warningSink = createConsoleWarningSink();

  return runLiveService({
    configPath,
    assetRoot,
    runsDir,
    debug,
    quiet,
    bus: options?.bus,
    receiptMode: options?.receiptMode,
    forceInk: options?.forceInk,
    warningSink,
    forwardWarningEvents: true,
    policy,
    overrides: {
      maxTrials,
      batchSize,
      workers
    }
  });
};
