#!/usr/bin/env node
import "dotenv/config";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { getAssetRoot } from "../utils/asset-root.js";
import { createStdoutFormatter } from "../ui/fmt.js";
import { createUiRunLifecycleHooks } from "../ui/run-lifecycle-hooks.js";
import { launchWizardTUI } from "../ui/wizard/app.js";
import { runLiveService, runMockService } from "../run/run-service.js";
import type { WarningSink } from "../utils/warnings.js";
import {
  DEFAULT_CONFIG_FILENAME,
  getFlag,
  getFlagInteger,
  hasFlag,
  listConfigFiles,
  loadTemplateConfig,
  nextCollisionSafeConfigPath,
  parseArgs,
  resolveConfigPath,
  writeJsonFile
} from "./commands.js";
import { getHelpCommand, renderCommandHelp, renderRootHelp } from "./help.js";
import { resolveCliMode } from "./intent.js";

type RunMode = "mock" | "live";

const loadPackageVersion = (assetRoot: string): string => {
  const pkg = JSON.parse(readFileSync(resolve(assetRoot, "package.json"), "utf8")) as {
    version?: string;
  };
  return pkg.version ?? "0.0.0";
};

const fail = (message: string): never => {
  throw new Error(message);
};

const assertAllowedFlags = (
  flags: Record<string, string | boolean>,
  allowed: string[]
): void => {
  const allowedSet = new Set(allowed);
  for (const flag of Object.keys(flags)) {
    if (!allowedSet.has(flag)) {
      fail(`unknown flag: ${flag}`);
    }
  }
};

const createSilentWarningSink = (): WarningSink => ({
  warn: () => {
    // Intentionally silent in non-dashboard headless runs.
  }
});

const runInit = (assetRoot: string): void => {
  const targetPath = nextCollisionSafeConfigPath();
  const template = loadTemplateConfig(assetRoot, "default");
  writeJsonFile(targetPath, template);

  process.stdout.write(`created config: ${targetPath}\n`);
  process.stdout.write("next:\n");
  process.stdout.write("  arbiter\n");
  process.stdout.write(`  arbiter run --config ${resolve(process.cwd(), targetPath)}\n`);
};

const runHeadless = async (input: {
  assetRoot: string;
  args: string[];
}): Promise<void> => {
  const parsed = parseArgs(input.args);
  assertAllowedFlags(parsed.flags, [
    "--help",
    "--version",
    "--config",
    "--out",
    "--workers",
    "--batch-size",
    "--max-trials",
    "--mode",
    "--dashboard"
  ]);

  if (hasFlag(parsed.flags, "--help")) {
    process.stdout.write(renderCommandHelp(createStdoutFormatter(), getHelpCommand("run")!));
    return;
  }

  const configFlag = getFlag(parsed.flags, "--config");
  if (!configFlag) {
    fail("run requires --config <path>");
  }
  const configPath = resolveConfigPath(configFlag as string);

  const modeRaw = getFlag(parsed.flags, "--mode") ?? "mock";
  if (modeRaw !== "mock" && modeRaw !== "live") {
    fail("--mode must be one of: mock, live");
  }
  const mode = modeRaw as RunMode;

  if (mode === "live" && !process.env.OPENROUTER_API_KEY) {
    fail("live mode requires OPENROUTER_API_KEY");
  }

  const dashboardRequested = hasFlag(parsed.flags, "--dashboard");
  const dashboardEnabled = dashboardRequested && Boolean(process.stdout.isTTY);
  if (dashboardRequested && !process.stdout.isTTY) {
    process.stderr.write("warning: --dashboard requires TTY stdout; continuing headless\n");
  }

  const warnings = dashboardEnabled ? undefined : createSilentWarningSink();
  const hooks = createUiRunLifecycleHooks({ dashboard: dashboardEnabled });

  const maxTrials = getFlagInteger(parsed.flags, "--max-trials");
  const batchSize = getFlagInteger(parsed.flags, "--batch-size");
  const workers = getFlagInteger(parsed.flags, "--workers");

  const common = {
    configPath,
    assetRoot: input.assetRoot,
    runsDir: getFlag(parsed.flags, "--out") ?? undefined,
    quiet: !dashboardEnabled,
    debug: false,
    hooks,
    warningSink: warnings,
    forwardWarningEvents: false,
    receiptMode: dashboardEnabled ? ("auto" as const) : ("writeOnly" as const),
    overrides: {
      ...(maxTrials !== undefined ? { maxTrials } : {}),
      ...(batchSize !== undefined ? { batchSize } : {}),
      ...(workers !== undefined ? { workers } : {})
    }
  };

  if (mode === "live") {
    await runLiveService(common);
  } else {
    await runMockService(common);
  }
};

const main = async (): Promise<void> => {
  const assetRoot = getAssetRoot();
  const args = process.argv.slice(2);
  const cliMode = resolveCliMode(args, Boolean(process.stdout.isTTY));
  const parsed = parseArgs(cliMode.filteredArgs);
  const fmt = createStdoutFormatter();

  if (hasFlag(parsed.flags, "--version")) {
    process.stdout.write(`${loadPackageVersion(assetRoot)}\n`);
    return;
  }

  const command = parsed.positional[0];

  if (hasFlag(parsed.flags, "--help")) {
    if (command === "init" || command === "run") {
      const helpCommand = getHelpCommand(command);
      if (!helpCommand) {
        fail(`unknown command: ${command}`);
      }
      process.stdout.write(renderCommandHelp(fmt, helpCommand!));
      return;
    }
    process.stdout.write(renderRootHelp(fmt));
    return;
  }

  if (cliMode.noCommand) {
    if (cliMode.shouldLaunchWizard) {
      await launchWizardTUI({ assetRoot });
      return;
    }
    process.stdout.write(renderRootHelp(fmt));
    return;
  }

  if (command === "init") {
    assertAllowedFlags(parsed.flags, []);
    runInit(assetRoot);
    return;
  }

  if (command === "run") {
    await runHeadless({
      assetRoot,
      args: cliMode.filteredArgs.slice(1)
    });
    return;
  }

  fail(`unknown command: ${command}`);
};

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
