#!/usr/bin/env node
import "dotenv/config";

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output, stderr } from "node:process";

import { getAssetRoot } from "../utils/asset-root.js";
import { formatVerifyReport, verifyRunDir } from "../tools/verify-run.js";
import { buildReportModel, formatReportJson, formatReportText } from "../tools/report-run.js";
import { listModels } from "../openrouter/client.js";
import { buildReceiptModel } from "../ui/receipt-model.js";
import { formatReceiptText } from "../ui/receipt-text.js";
import { EventBus } from "../events/event-bus.js";
import {
  DEFAULT_CONFIG_PATH,
  parseArgs,
  getFlag,
  hasFlag,
  resolveConfigForCli,
  applyPolicy,
  runResolve,
  runCommand,
  type ParsedArgs
} from "./commands.js";
import { resolveCliMode } from "./intent.js";
import { launchTranscriptTUI } from "../ui/transcript/app.js";
import { createStderrFormatter, createStdoutFormatter } from "../ui/fmt.js";
import { getHelpCommand, renderCommandHelp, renderRootHelp } from "./help.js";

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

const loadPackageVersion = (assetRoot: string): string => {
  const pkg = JSON.parse(readFileSync(resolve(assetRoot, "package.json"), "utf8")) as {
    version?: string;
  };
  return pkg.version ?? "0.0.0";
};

const writeTemplateConfigFile = (
  assetRoot: string,
  templateName: string,
  question: string | undefined,
  targetPath: string
): void => {
  const templatePath = resolve(assetRoot, "templates", `${templateName}.config.json`);
  if (!existsSync(templatePath)) {
    throw new Error(`Template not found: ${templateName}`);
  }

  const template = JSON.parse(readFileSync(templatePath, "utf8")) as Record<string, unknown>;
  if (typeof question === "string" && question.trim().length > 0) {
    const questionBlock = (template.question ?? {}) as Record<string, unknown>;
    questionBlock.text = question;
    template.question = questionBlock;
  }

  writeFileSync(targetPath, `${JSON.stringify(template, null, 2)}\n`, "utf8");
};

const runInit = (parsed: ParsedArgs, assetRoot: string): void => {
  const fmt = createStdoutFormatter();
  const question = parsed.positional[0];
  const outPath = getFlag(parsed.flags, "--out") ?? DEFAULT_CONFIG_PATH;
  const templateName = getFlag(parsed.flags, "--template") ?? "default";
  const force = hasFlag(parsed.flags, "--force");

  const targetPath = resolve(process.cwd(), outPath);
  if (existsSync(targetPath) && !force) {
    throw new Error(`Config already exists at ${targetPath}. Use --force to overwrite.`);
  }

  writeTemplateConfigFile(assetRoot, templateName, question, targetPath);

  const preview = resolveConfigForCli(targetPath, assetRoot);

  process.stdout.write(`${fmt.successBlock(`created config: ${targetPath}`)}\n`);
  process.stdout.write(`${fmt.kv("Template", templateName)}\n`);
  process.stdout.write(`${fmt.kv("Question", preview.resolvedConfig.question.text)}\n`);
  process.stdout.write(`${fmt.kv("Protocol", preview.resolvedConfig.protocol.type)}\n`);
  process.stdout.write(`${fmt.kv("k_max", String(preview.resolvedConfig.execution.k_max))}\n`);
  process.stdout.write(`${fmt.tip("arbiter validate && arbiter run")}\n`);
};

const runValidate = async (parsed: ParsedArgs, assetRoot: string): Promise<void> => {
  const fmt = createStdoutFormatter();
  const configPath =
    getFlag(parsed.flags, "--config") ?? parsed.positional[0] ?? DEFAULT_CONFIG_PATH;
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
    process.stdout.write(`${fmt.warnBlock("config warnings detected")}`);
    process.stdout.write("\n");
    result.warnings.forEach((warning) => {
      process.stdout.write(`${fmt.warn(`- ${warning}`)}\n`);
    });
  }

  process.stdout.write(`${fmt.successBlock(`config OK: ${resolve(process.cwd(), configPath)}`)}\n`);
  if (live) {
    process.stdout.write(`${fmt.successBlock("OpenRouter connectivity: OK")}\n`);
  }
};

const formatVerifyForTerminal = (raw: string): string => {
  const fmt = createStdoutFormatter();
  if (!fmt.isTTY) {
    return raw;
  }

  const lines = raw
    .trim()
    .split("\n")
    .map((line) => {
      if (line.startsWith("OK ")) {
        return fmt.success(line);
      }
      if (line.startsWith("WARN ")) {
        return fmt.warn(line);
      }
      if (line.startsWith("FAIL ")) {
        return fmt.error(line);
      }
      return fmt.text(line);
    });

  return `${fmt.header("Arbiter Verify")}\n${lines.join("\n")}\n`;
};

const runVerify = (parsed: ParsedArgs): void => {
  const runDir = parsed.positional[0];
  if (!runDir) {
    throw new Error("Usage: arbiter verify <run_dir>");
  }
  const report = verifyRunDir(runDir);
  const raw = formatVerifyReport(report);
  process.stdout.write(formatVerifyForTerminal(raw));
  if (!report.ok) {
    process.exitCode = 1;
  }
};

const formatReportForTerminal = (raw: string): string => {
  const fmt = createStdoutFormatter();
  if (!fmt.isTTY) {
    return raw;
  }

  const lines = raw.trim().split("\n");
  if (lines.length === 0) {
    return raw;
  }

  const styled: string[] = [fmt.header(lines[0])];
  lines.slice(1).forEach((line) => {
    if (line.startsWith("Status:")) {
      styled.push(fmt.accent(line));
      return;
    }
    if (line.startsWith("Output:")) {
      styled.push(fmt.info(line));
      return;
    }
    if (line.startsWith("Contract:")) {
      styled.push(fmt.warn(line));
      return;
    }
    styled.push(fmt.text(line));
  });

  return `${styled.join("\n")}\n`;
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
  process.stdout.write(formatReportForTerminal(formatReportText(model)));
};

const formatReceiptForTerminal = (raw: string): string => {
  const fmt = createStdoutFormatter();
  if (!fmt.isTTY) {
    return raw;
  }
  const lines = raw.trim().split("\n");
  if (lines.length === 0) {
    return raw;
  }
  const styled: string[] = [fmt.header(lines[0])];
  lines.slice(1).forEach((line) => {
    if (line.startsWith("Status:")) {
      styled.push(fmt.accent(line));
      return;
    }
    if (line.startsWith("Output:")) {
      styled.push(fmt.info(line));
      return;
    }
    styled.push(fmt.text(line));
  });
  return `${styled.join("\n")}\n`;
};

const runReceipt = (parsed: ParsedArgs): void => {
  const runDir = parsed.positional[0];
  if (!runDir) {
    throw new Error("Usage: arbiter receipt <run_dir>");
  }
  const model = buildReceiptModel(runDir);
  process.stdout.write(formatReceiptForTerminal(formatReceiptText(model)));
};

const createProgressReporter = (bus: EventBus): (() => void) => {
  const fmt = createStderrFormatter();
  const stream = stderr;
  const tty = Boolean(stream.isTTY);
  let activeLine = false;

  const writeLine = (line: string, overwrite = false): void => {
    if (overwrite && tty) {
      stream.write(`\r${line}   `);
      activeLine = true;
      return;
    }
    if (activeLine && tty) {
      stream.write("\n");
      activeLine = false;
    }
    stream.write(`${line}\n`);
  };

  const unsubs = [
    bus.subscribeSafe("run.started", (payload) => {
      writeLine(fmt.statusChip("run started", "info", `${payload.run_id} | planned ${payload.k_planned}`));
    }),
    bus.subscribeSafe("batch.completed", (payload) => {
      writeLine(
        fmt.statusChip(
          "batch",
          "info",
          `${payload.batch_number} complete | elapsed ${payload.elapsed_ms}ms`
        ),
        true
      );
    }),
    bus.subscribeSafe("run.completed", (payload) => {
      writeLine(
        fmt.statusChip("run complete", "success", `${payload.run_id} | ${payload.stop_reason}`)
      );
    }),
    bus.subscribeSafe("run.failed", (payload) => {
      writeLine(fmt.statusChip("run failed", "error", `${payload.run_id} | ${payload.error}`));
    })
  ];

  return (): void => {
    if (activeLine && tty) {
      stream.write("\n");
      activeLine = false;
    }
    unsubs.forEach((unsub) => unsub());
  };
};

const run = async (parsed: ParsedArgs, assetRoot: string): Promise<void> => {
  const fmtOut = createStdoutFormatter();
  const fmtErr = createStderrFormatter();

  const wantsLive = hasFlag(parsed.flags, "--live");
  const skipConfirm = hasFlag(parsed.flags, "--yes");
  const quiet = hasFlag(parsed.flags, "--quiet");

  if (!wantsLive && !process.env.OPENROUTER_API_KEY) {
    process.stdout.write(
      `${fmtOut.warnBlock("no OPENROUTER_API_KEY found. running in mock mode; use --live with an API key for real calls")}\n`
    );
  }

  if (wantsLive) {
    if (!process.env.OPENROUTER_API_KEY) {
      throw new Error("OPENROUTER_API_KEY is required for live runs.");
    }

    if (!skipConfirm) {
      if (!process.stdout.isTTY || !process.stdin.isTTY) {
        throw new Error("non-interactive live runs require --yes");
      }
      const proceed = await promptYesNo("Run in live mode with real API calls?");
      if (!proceed) {
        process.stdout.write(`${fmtOut.warnBlock("live run cancelled")}`);
        process.stdout.write("\n");
        return;
      }
    }
  }

  const bus = new EventBus();
  const detachProgress = quiet ? () => {} : createProgressReporter(bus);

  try {
    const result = await runCommand(parsed, assetRoot, {
      bus,
      showPreview: wantsLive,
      warningSink: {
        warn: (message, source) => {
          const prefix = source ? `[${source}] ` : "";
          process.stderr.write(`${fmtErr.warnBlock(`${prefix}${message}`)}\n`);
        }
      }
    });

    if (result.runDir) {
      process.stdout.write(`${fmtOut.successBlock(`run complete (${result.mode})`)}\n`);
      process.stdout.write(`${fmtOut.kv("Run directory", result.runDir)}\n`);
      process.stdout.write(`${fmtOut.tip(`arbiter report ${result.runDir}`)}\n`);
      process.stdout.write(`${fmtOut.tip(`arbiter verify ${result.runDir}`)}\n`);
    }
  } finally {
    detachProgress();
  }
};

const main = async (): Promise<void> => {
  const args = process.argv.slice(2);
  const { filteredArgs, noCommand, shouldLaunchTUI } = resolveCliMode(
    args,
    Boolean(process.stdout.isTTY)
  );
  const assetRoot = getAssetRoot();
  const fmtOut = createStdoutFormatter();
  const fmtErr = createStderrFormatter();

  try {
    if (shouldLaunchTUI) {
      await launchTranscriptTUI({ assetRoot });
      return;
    }

    if (filteredArgs[0] === "--version" || filteredArgs[0] === "-V") {
      process.stdout.write(`${loadPackageVersion(assetRoot)}\n`);
      process.exit(0);
    }

    if (noCommand || filteredArgs[0] === "--help" || filteredArgs[0] === "-h") {
      process.stdout.write(renderRootHelp(fmtOut));
      process.exit(0);
    }

    const command = filteredArgs[0];
    const parsed = parseArgs(filteredArgs.slice(1));

    if (hasFlag(parsed.flags, "--help")) {
      const helpCommand = getHelpCommand(command);
      if (!helpCommand) {
        process.stderr.write(`${fmtErr.errorBlock(`unknown command: ${command}`, "run arbiter --help for available commands")}\n`);
        process.exit(1);
      }
      process.stdout.write(renderCommandHelp(fmtOut, helpCommand));
      process.exit(0);
    }

    if (command === "init") {
      runInit(parsed, assetRoot);
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
      const result = runResolve(parsed, assetRoot);
      process.stdout.write(`${fmtOut.successBlock(`resolved run plan: ${result.runId}`)}\n`);
      process.stdout.write(`${fmtOut.kv("Output directory", result.runDir)}\n`);
      return;
    }
    if (command === "run") {
      await run(parsed, assetRoot);
      return;
    }
    if (command === "receipt") {
      runReceipt(parsed);
      return;
    }

    process.stderr.write(
      `${fmtErr.errorBlock(`unknown command: ${command}`, "run arbiter --help for available commands")}\n`
    );
    process.exit(1);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${fmtErr.errorBlock(message)}\n`);
    process.exit(1);
  }
};

void main();
