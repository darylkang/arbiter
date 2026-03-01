import { execSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { formatVerifyReport, verifyRunDir } from "../dist/tools/verify-run.js";

const tempRoot = mkdtempSync(resolve(tmpdir(), "arbiter-quickstart-"));
const runsDir = resolve(tempRoot, "runs");
const cliPath = resolve("dist/cli/index.js");

try {
  execSync(`node ${cliPath} init`, { cwd: tempRoot, stdio: "inherit" });

  execSync(`node ${cliPath} run --config arbiter.config.json --out ${runsDir}`, {
    cwd: tempRoot,
    stdio: "inherit"
  });

  const runDirs = readdirSync(runsDir);
  if (runDirs.length !== 1) {
    throw new Error(`Expected 1 run dir, got ${runDirs.length}`);
  }

  const runDir = resolve(runsDir, runDirs[0]);
  const report = verifyRunDir(runDir);
  if (!report.ok) {
    throw new Error(`quickstart verify failed:\n${formatVerifyReport(report)}`);
  }
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}

console.log("Quickstart smoke test OK");
