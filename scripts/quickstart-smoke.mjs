import { execSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";

const tempRoot = mkdtempSync(resolve(tmpdir(), "arbiter-quickstart-"));
const runsDir = resolve(tempRoot, "runs");
const cliPath = resolve("dist/cli/index.js");

execSync(
  `node ${cliPath} init "Quickstart smoke question" --template quickstart_independent`,
  { cwd: tempRoot, stdio: "inherit" }
);

execSync(`node ${cliPath} run --out ${runsDir}`, {
  cwd: tempRoot,
  stdio: "inherit"
});

const runDirs = readdirSync(runsDir);
if (runDirs.length !== 1) {
  throw new Error(`Expected 1 run dir, got ${runDirs.length}`);
}

const runDir = resolve(runsDir, runDirs[0]);
execSync(`node ${cliPath} verify ${runDir}`, { stdio: "inherit" });

rmSync(tempRoot, { recursive: true, force: true });
console.log("Quickstart smoke test OK");
