import { execSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";

if (!process.env.OPENROUTER_API_KEY) {
  console.log("OPENROUTER_API_KEY not set; skipping live smoke test.");
  process.exit(0);
}

const tempRoot = resolve(tmpdir(), `arbiter-live-smoke-${Date.now()}`);
const runsDir = resolve(tempRoot, "runs");
mkdirSync(runsDir, { recursive: true });

const baseArgs = ["dist/cli/index.js", "run", "--config", "examples/debate_v1.smoke.json", "--out", runsDir, "--debug"];

console.log("Running live smoke test (baseline)...");
execSync(`node ${baseArgs.join(" ")} --max-trials 3 --batch-size 1 --workers 1`, { stdio: "inherit" });

console.log("Running live smoke test (concurrency)...");
execSync(`node ${baseArgs.join(" ")} --max-trials 6 --batch-size 2 --workers 3`, { stdio: "inherit" });

console.log(`Live smoke runs stored under ${runsDir}`);
