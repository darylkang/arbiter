import { execSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

const tempRoot = resolve(tmpdir(), `arbiter-resolve-only-${Date.now()}`);
const runsDir = resolve(tempRoot, "runs");
mkdirSync(runsDir, { recursive: true });

try {
  const config = JSON.parse(readFileSync(resolve("resources/templates/default.config.json"), "utf8"));
  config.question = { text: "Resolve-only smoke prompt", question_id: "resolve_only_q1" };
  const configPath = resolve(tempRoot, "arbiter.config.json");
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");

  execSync(`node dist/cli/index.js resolve --config ${configPath} --out ${runsDir}`, {
    stdio: "ignore"
  });

  const runDirs = readdirSync(runsDir);
  if (runDirs.length !== 1) {
    throw new Error(`Expected 1 run dir, got ${runDirs.length}`);
  }
  const runDir = resolve(runsDir, runDirs[0]);
  const entries = readdirSync(runDir).sort();
  const expected = ["config.resolved.json", "manifest.json"];
  if (entries.length !== expected.length || entries.some((entry, i) => entry !== expected[i])) {
    throw new Error(
      `Resolve-only run should only contain ${expected.join(", ")}. Got ${entries.join(", ")}`
    );
  }

  execSync(`node dist/cli/index.js verify ${runDir}`, { stdio: "inherit" });
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}

console.log("Resolve-only smoke test OK");
