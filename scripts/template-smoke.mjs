import { execSync } from "node:child_process";
import { mkdirSync, readdirSync, rmSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";

const templates = [
  "default",
  "quickstart_independent",
  "heterogeneity_mix",
  "debate_v1",
  "free_quickstart"
];

const cliPath = resolve("dist/cli/index.js");

for (const template of templates) {
  const tempRoot = resolve(tmpdir(), `arbiter-template-${template}-${Date.now()}`);
  const runsDir = resolve(tempRoot, "runs");
  mkdirSync(tempRoot, { recursive: true });
  mkdirSync(runsDir, { recursive: true });

  execSync(`node ${cliPath} init --template ${template}`, {
    cwd: tempRoot,
    stdio: "inherit"
  });

  execSync(
    `node ${cliPath} run --config arbiter.config.json --out ${runsDir} --max-trials 2 --batch-size 1 --workers 1`,
    { cwd: tempRoot, stdio: "inherit" }
  );

  const runDirs = readdirSync(runsDir);
  if (runDirs.length !== 1) {
    throw new Error(`Expected 1 run dir for template ${template}, got ${runDirs.length}`);
  }
  const runDir = resolve(runsDir, runDirs[0]);
  const requiredFiles = [
    "config.resolved.json",
    "manifest.json",
    "trial_plan.jsonl",
    "trials.jsonl",
    "parsed.jsonl",
    "convergence_trace.jsonl",
    "aggregates.json",
    "embeddings.arrow",
    "embeddings.provenance.json",
    "receipt.txt"
  ];
  for (const file of requiredFiles) {
    const path = resolve(runDir, file);
    readFileSync(path);
  }

  rmSync(tempRoot, { recursive: true, force: true });
}

console.log("Template smoke tests OK");
