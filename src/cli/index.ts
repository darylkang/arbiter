import { resolveConfig } from "../config/resolve-config.js";
import { buildResolveManifest } from "../config/manifest.js";
import { generateRunId } from "../artifacts/run-id.js";
import { createRunDir } from "../artifacts/run-dir.js";
import { writeResolveArtifacts } from "../artifacts/resolve-artifacts.js";

const printUsage = (): void => {
  console.log("Usage:");
  console.log("  arbiter resolve --config <path> [--out <runs_dir>] [--debug]");
};

const getArgValue = (args: string[], flag: string): string | undefined => {
  const index = args.indexOf(flag);
  if (index === -1 || index === args.length - 1) {
    return undefined;
  }
  return args[index + 1];
};

const hasFlag = (args: string[], flag: string): boolean => args.includes(flag);

const runResolve = (args: string[]): void => {
  const configPath = getArgValue(args, "--config") ?? "arbiter.config.json";
  const runsDir = getArgValue(args, "--out") ?? "runs";
  const debug = hasFlag(args, "--debug");

  const result = resolveConfig({ configPath });
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

const main = (): void => {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    printUsage();
    process.exit(1);
  }

  const command = args[0];
  if (command !== "resolve") {
    printUsage();
    process.exit(1);
  }

  try {
    runResolve(args.slice(1));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  }
};

main();
