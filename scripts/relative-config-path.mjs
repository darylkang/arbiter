import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";

const tempRoot = mkdtempSync(resolve(tmpdir(), "arbiter-relpath-"));
const runsDir = resolve(tempRoot, "runs");
const configDir = resolve(tempRoot, "configs");
const cliPath = resolve("dist/cli/index.js");
mkdirSync(configDir, { recursive: true });

try {
  const template = JSON.parse(
    readFileSync(resolve("resources/templates/free_quickstart.config.json"), "utf8")
  );
  template.question = {
    text: "Relative config path prompt",
    question_id: "relative_path_q1"
  };

  const configPath = resolve(configDir, "relative.config.json");
  writeFileSync(configPath, `${JSON.stringify(template, null, 2)}\n`, "utf8");

  execFileSync(
    "node",
    [cliPath, "run", "configs/relative.config.json", "--out", "runs", "--debug", "--quiet"],
    { cwd: tempRoot, stdio: "ignore" }
  );

  const runDirs = readdirSync(runsDir);
  if (runDirs.length !== 1) {
    throw new Error(`Expected 1 run dir, got ${runDirs.length}`);
  }

  const runDir = resolve(runsDir, runDirs[0]);
  const resolved = JSON.parse(readFileSync(resolve(runDir, "config.resolved.json"), "utf8"));
  if (resolved.question?.question_id !== "relative_path_q1") {
    throw new Error("CLI did not resolve the positional relative config path from cwd");
  }
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}

console.log("Relative config path smoke test OK");
