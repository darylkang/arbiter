import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";

import { REPO_ROOT } from "../helpers/workspace.mjs";

test("packed tarball installs and runs the published bin successfully", { concurrency: false }, () => {
  const packRaw = execFileSync("npm", ["pack", "--json"], {
    cwd: REPO_ROOT,
    encoding: "utf8"
  });
  const packResults = JSON.parse(packRaw);
  const packOutput = packResults.at(-1)?.filename;
  assert.equal(typeof packOutput, "string");
  assert.notEqual(packOutput.trim(), "");

  const tgzPath = resolve(REPO_ROOT, packOutput);
  const tempRoot = mkdtempSync(resolve(tmpdir(), "arbiter-pack-"));

  try {
    execFileSync("npm", ["install", tgzPath, "--prefix", tempRoot], { stdio: "inherit" });

    const binPath = resolve(tempRoot, "node_modules", ".bin", "arbiter");
    execFileSync(binPath, ["--help"], { stdio: "inherit" });
    execFileSync(binPath, ["init"], { cwd: tempRoot, stdio: "inherit" });
    execFileSync(
      binPath,
      [
        "run",
        "--config",
        "arbiter.config.json",
        "--out",
        "runs",
        "--max-trials",
        "2",
        "--batch-size",
        "1",
        "--workers",
        "1"
      ],
      { cwd: tempRoot, stdio: "pipe" }
    );

    const runsDir = resolve(tempRoot, "runs");
    const runDirs = readdirSync(runsDir);
    assert.equal(runDirs.length, 1);
    const runDir = resolve(runsDir, runDirs[0]);
    assert.equal(existsSync(resolve(runDir, "manifest.json")), true);
    assert.equal(existsSync(resolve(runDir, "receipt.txt")), true);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
    rmSync(tgzPath, { force: true });
  }
});
