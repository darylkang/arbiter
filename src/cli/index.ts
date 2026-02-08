#!/usr/bin/env node
import "dotenv/config";

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import { getAssetRoot } from "../utils/asset-root.js";
import { formatVerifyReport, verifyRunDir } from "../tools/verify-run.js";
import { buildReportModel, formatReportJson, formatReportText } from "../tools/report-run.js";
import { listModels } from "../openrouter/client.js";
import {
  DEFAULT_CONFIG_PATH,
  parseArgs,
  getFlag,
  hasFlag,
  resolveConfigForCli,
  applyPolicy,
  runResolve,
  runMockCommand,
  runLiveCommand,
  type ParsedArgs
} from "./commands.js";
import { resolveCliMode } from "./intent.js";
import { launchTranscriptTUI } from "../ui/transcript/app.js";

const printUsage = (): void => {
  console.log("Interactive transcript UI available in TTY: run `arbiter` with no args.");
  console.log("Headless flow: arbiter init → arbiter validate → arbiter run");
  console.log("Usage:");
  console.log(
    "  arbiter init [question] [--out <path>] [--force] [--template default|quickstart_independent|heterogeneity_mix|debate_v1|free_quickstart|full]"
  );
  console.log(
    "  arbiter quickstart [question] [--profile quickstart|heterogeneity|debate|free] [--mock|--live] [--yes] [--out <runs_dir>]"
  );
  console.log("  arbiter validate [config.json] [--live]");
  console.log("  arbiter resolve [config.json] [--out <runs_dir>]");
  console.log(
    "  arbiter mock-run [config.json] [--out <runs_dir>] [--debug] [--quiet] [--contract-failure warn|exclude|fail]"
  );
  console.log(
    "  arbiter run [config.json] [--out <runs_dir>] [--debug] [--quiet] [--max-trials N] [--batch-size N] [--workers N] [--strict|--permissive] [--contract-failure warn|exclude|fail]"
  );
  console.log("  arbiter verify <run_dir>");
  console.log("  arbiter report <run_dir> [--format text|json] [--top N]");
  console.log("  arbiter --headless  # disable interactive transcript ui");
};

const PROFILE_TEMPLATES: Record<string, string> = {
  quickstart: "quickstart_independent",
  heterogeneity: "heterogeneity_mix",
  debate: "debate_v1",
  free: "free_quickstart"
};

const resolveTemplateName = (value: string): string =>
  PROFILE_TEMPLATES[value] ?? value;

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
  const topRaw = getFlag(parsed.flags, "--top");
  const top = topRaw === undefined ? 3 : Number(topRaw);
  if (!Number.isInteger(top) || top < 1) {
    throw new Error("Invalid --top (expected positive integer)");
  }
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

const main = async (): Promise<void> => {
  const args = process.argv.slice(2);
  const { filteredArgs, noCommand, shouldLaunchTUI } = resolveCliMode(
    args,
    Boolean(process.stdout.isTTY)
  );
  const assetRoot = getAssetRoot();

  try {
    if (shouldLaunchTUI) {
      await launchTranscriptTUI({ assetRoot });
      return;
    }

    if (noCommand || filteredArgs.includes("--help") || filteredArgs.includes("-h")) {
      printUsage();
      process.exit(0);
    }

    const command = filteredArgs[0];
    const parsed = parseArgs(filteredArgs.slice(1));

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
