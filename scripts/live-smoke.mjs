import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

if (!process.env.OPENROUTER_API_KEY) {
  console.log("OPENROUTER_API_KEY not set; skipping live smoke test.");
  process.exit(0);
}

const tempRoot = mkdtempSync(resolve(tmpdir(), "arbiter-live-smoke-"));
const runsDir = resolve(tempRoot, "runs");
const configPath = resolve(tempRoot, "arbiter.config.json");

const template = JSON.parse(
  readFileSync(resolve("resources/templates/debate_v1.config.json"), "utf8")
);
template.question = {
  text: "Live smoke prompt",
  question_id: "live_smoke_q1"
};
template.output = { runs_dir: "runs" };
writeFileSync(configPath, `${JSON.stringify(template, null, 2)}\n`, "utf8");

const runCase = (label, extraArgs) => {
  console.log(`Running live smoke test (${label})...`);
  execFileSync(
      "node",
      [
        "dist/cli/index.js",
        "run",
        "--config",
        configPath,
        "--out",
        runsDir,
        "--mode",
      "live",
      ...extraArgs
    ],
    { encoding: "utf8", stdio: "pipe" }
  );
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
