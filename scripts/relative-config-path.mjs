import { execSync } from "node:child_process";
import { mkdirSync, readdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";

const tempRoot = resolve(tmpdir(), `arbiter-relpath-${Date.now()}`);
const runsDir = resolve(tempRoot, "runs");
mkdirSync(runsDir, { recursive: true });

execSync(
  `node dist/cli/index.js mock-run templates/free_quickstart.config.json --out ${runsDir} --debug --quiet`,
  { stdio: "ignore" }
);

const runDirs = readdirSync(runsDir);
if (runDirs.length !== 1) {
  throw new Error(`Expected 1 run dir, got ${runDirs.length}`);
}

rmSync(tempRoot, { recursive: true, force: true });
console.log("Relative config path smoke test OK");
