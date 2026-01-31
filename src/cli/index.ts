import { resolveConfig } from "../config/resolve-config.js";
import { writeRunSnapshots } from "../artifacts/run-snapshots.js";

const printUsage = (): void => {
  console.log("Usage:");
  console.log("  arbiter resolve --config <path> [--out <runs_dir>]");
};

const getArgValue = (args: string[], flag: string): string | undefined => {
  const index = args.indexOf(flag);
  if (index === -1 || index === args.length - 1) {
    return undefined;
  }
  return args[index + 1];
};

const runResolve = (args: string[]): void => {
  const configPath = getArgValue(args, "--config") ?? "arbiter.config.json";
  const runsDir = getArgValue(args, "--out") ?? "runs";

  const result = resolveConfig({ configPath });
  const snapshot = writeRunSnapshots({
    resolvedConfig: result.resolvedConfig,
    catalog: result.catalog,
    promptManifest: result.promptManifest,
    catalogSha256: result.catalogSha256,
    promptManifestSha256: result.promptManifestSha256,
    runsDir
  });

  if (result.warnings.length > 0) {
    console.warn("Warnings:");
    result.warnings.forEach((warning) => console.warn(`- ${warning}`));
  }

  console.log(`Output directory: ${snapshot.runDir}`);
  console.log(`Resolved config hash prefix: ${snapshot.runId}`);
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
