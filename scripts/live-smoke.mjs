import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

if (!process.env.OPENROUTER_API_KEY) {
  console.log("OPENROUTER_API_KEY not set; skipping live smoke test.");
  process.exit(0);
}

const tempRoot = mkdtempSync(resolve(tmpdir(), "arbiter-live-smoke-"));
const runsDir = resolve(tempRoot, "runs");

const runCase = (label, extraArgs) => {
  console.log(`Running live smoke test (${label})...`);
  const output = execFileSync(
    "node",
    [
      "dist/cli/index.js",
      "run",
      "--live",
      "--yes",
      "--config",
      "examples/debate_v1.smoke.json",
      "--out",
      runsDir,
      "--quiet",
      "--debug",
      ...extraArgs
    ],
    { encoding: "utf8", stdio: "pipe" }
  );
  if (!output.includes("run complete (live)")) {
    throw new Error(`Expected live completion marker in ${label} run output`);
  }
  if (output.includes("run complete (mock)")) {
    throw new Error(`Unexpected mock completion marker in ${label} run output`);
  }
};

try {
  runCase("baseline", ["--max-trials", "1", "--batch-size", "1", "--workers", "1"]);
  runCase("concurrency", ["--max-trials", "2", "--batch-size", "2", "--workers", "2"]);

  const runDirs = readdirSync(runsDir);
  if (runDirs.length !== 2) {
    throw new Error(`Expected 2 live run directories, got ${runDirs.length}`);
  }
  console.log("Live smoke test OK");
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
