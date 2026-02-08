import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

const ANSI_REGEX = /\u001b\[[0-9;]*m/g;
const stripAnsi = (value) => value.replace(ANSI_REGEX, "");

const cli = resolve("dist/cli/index.js");

const run = (args, options = {}) => {
  const result = spawnSync("node", [cli, ...args], {
    cwd: options.cwd,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      ...options.env
    }
  });
  return {
    status: result.status ?? 0,
    stdout: result.stdout?.toString("utf8") ?? "",
    stderr: result.stderr?.toString("utf8") ?? ""
  };
};

const rootHelp = run(["--headless", "--help"]);
assert.equal(rootHelp.status, 0);
assert.equal(rootHelp.stdout.includes("quickstart"), false);
assert.equal(rootHelp.stdout.includes("mock-run"), false);
assert.equal(rootHelp.stdout.includes("arbiter run"), true);
assert.equal(rootHelp.stdout.includes("receipt"), true);
assert.equal(rootHelp.stdout.includes("Workflow:"), true);
assert.equal(rootHelp.stdout.match(/\u001b\[/), null);

const runHelp = run(["run", "--help"]);
assert.equal(runHelp.status, 0);
assert.equal(runHelp.stdout.includes("--live"), true);
assert.equal(runHelp.stdout.includes("--yes"), true);
assert.equal(runHelp.stdout.includes("--config"), true);
assert.equal(runHelp.stdout.includes("--allow-free"), true);
assert.equal(runHelp.stdout.includes("--allow-aliased"), true);
assert.equal(runHelp.stdout.includes("--contract-failure"), true);

const unknown = run(["does-not-exist"]);
assert.equal(unknown.status, 1);
assert.equal(stripAnsi(unknown.stderr).includes("unknown command: does-not-exist"), true);

const version = run(["--version"]);
assert.equal(version.status, 0);
assert.match(
  version.stdout.trim(),
  /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/
);

const tempRoot = mkdtempSync(resolve(tmpdir(), "arbiter-cli-contracts-"));
try {
  const init = run(["init", "contract test question"], { cwd: tempRoot });
  assert.equal(init.status, 0);

  const runMockDefault = run(["run", "--out", "runs"], {
    cwd: tempRoot,
    env: { OPENROUTER_API_KEY: "" }
  });
  assert.equal(runMockDefault.status, 0);
  assert.equal(stripAnsi(runMockDefault.stdout).includes("running in mock mode"), true);
  assert.equal(stripAnsi(runMockDefault.stdout).includes("run complete (mock)"), true);
  assert.equal(runMockDefault.stderr.match(ANSI_REGEX), null);

  const runDirMatch = stripAnsi(runMockDefault.stdout).match(/Run directory:\s+(.+)/);
  assert.ok(runDirMatch?.[1], "Expected run directory in run output");
  const runDir = runDirMatch[1].trim();

  const report = run(["report", runDir], { cwd: tempRoot });
  assert.equal(report.status, 0);
  assert.equal(stripAnsi(report.stdout).includes("Arbiter Report"), true);
  assert.equal(stripAnsi(report.stdout).includes("Counts:"), true);

  const verify = run(["verify", runDir], { cwd: tempRoot });
  assert.equal(verify.status, 0);
  assert.equal(stripAnsi(verify.stdout).includes("OK"), true);

  const receipt = run(["receipt", runDir], { cwd: tempRoot });
  assert.equal(receipt.status, 0);
  assert.equal(stripAnsi(receipt.stdout).includes("Arbiter Receipt"), true);

  const runLiveNoYes = run(["run", "--live"], {
    cwd: tempRoot,
    env: { OPENROUTER_API_KEY: "test-key", CI: "1" }
  });
  assert.equal(runLiveNoYes.status, 1);
  assert.equal(stripAnsi(runLiveNoYes.stderr).includes("non-interactive live runs require --yes"), true);

  const missingConfig = run(["run", "--config", "missing.config.json"], { cwd: tempRoot });
  assert.equal(missingConfig.status, 1);
  assert.equal(stripAnsi(missingConfig.stderr).includes("config not found"), true);
  assert.equal(
    stripAnsi(missingConfig.stderr).includes("arbiter init"),
    true
  );
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}

console.log("cli output contracts: ok");
