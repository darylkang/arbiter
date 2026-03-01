import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";

const root = process.cwd();
const packRaw = execFileSync("npm", ["pack", "--json"], { encoding: "utf8" });
const packResults = JSON.parse(packRaw);
const packOutput = packResults.at(-1)?.filename;
if (typeof packOutput !== "string" || packOutput.trim().length === 0) {
  throw new Error("npm pack did not return a tarball name");
}

const tgzPath = resolve(root, packOutput);
const tempRoot = mkdtempSync(resolve(tmpdir(), "arbiter-pack-"));

try {
  execFileSync("npm", ["install", tgzPath, "--prefix", tempRoot], { stdio: "inherit" });

  const binPath = resolve(tempRoot, "node_modules", ".bin", "arbiter");

  execFileSync(binPath, ["--help"], { stdio: "inherit" });
  execFileSync(binPath, ["init"], { cwd: tempRoot, stdio: "inherit" });
  execFileSync(
    binPath,
    ["run", "--config", "arbiter.config.json", "--out", "runs", "--max-trials", "2", "--batch-size", "1", "--workers", "1"],
    { cwd: tempRoot, stdio: "pipe" }
  );

  const runsDir = resolve(tempRoot, "runs");
  const runDirs = readdirSync(runsDir);
  if (runDirs.length !== 1) {
    throw new Error(`Expected exactly 1 run directory in pack test, got ${runDirs.length}`);
  }
  const runDir = resolve(runsDir, runDirs[0]);
  if (!existsSync(resolve(runDir, "manifest.json"))) {
    throw new Error("manifest.json missing after pack run");
  }
  if (!existsSync(resolve(runDir, "receipt.txt"))) {
    throw new Error("receipt.txt missing after pack run");
  }
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
  rmSync(tgzPath, { force: true });
}

console.log("Pack install smoke test OK");
