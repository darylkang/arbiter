import { execSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";

const root = process.cwd();
const packOutput = execSync("npm pack", { encoding: "utf8" }).trim().split("\n").pop();
if (!packOutput) {
  throw new Error("npm pack did not return a tarball name");
}

const tgzPath = resolve(root, packOutput);
const tempRoot = mkdtempSync(resolve(tmpdir(), "arbiter-pack-"));

try {
  execSync(`npm install ${tgzPath} --prefix ${tempRoot}`, { stdio: "inherit" });

  const binPath = resolve(tempRoot, "node_modules", ".bin", "arbiter");

  execSync(`${binPath} --help`, { stdio: "inherit" });
  execSync(`${binPath} init "Pack smoke question"`, { cwd: tempRoot, stdio: "inherit" });
  execSync(`${binPath} validate`, { cwd: tempRoot, stdio: "inherit" });
  execSync(
    `${binPath} run --config arbiter.config.json --out runs --max-trials 2 --batch-size 1 --workers 1`,
    { cwd: tempRoot, stdio: "pipe" }
  );

  const runsDir = resolve(tempRoot, "runs");
  const runDirs = readdirSync(runsDir);
  if (runDirs.length === 0) {
    throw new Error("No run directories created in pack test");
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
