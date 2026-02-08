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
assert.equal(runHelp.stdout.includes("--contract-failure"), true);

const unknown = run(["does-not-exist"]);
assert.equal(unknown.status, 1);
assert.equal(stripAnsi(unknown.stderr).includes("unknown command: does-not-exist"), true);

const version = run(["--version"]);
assert.equal(version.status, 0);
assert.match(version.stdout.trim(), /^\d+\.\d+\.\d+/);

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

  const runLiveNoYes = run(["run", "--live"], {
    cwd: tempRoot,
    env: { OPENROUTER_API_KEY: "test-key", CI: "1" }
  });
  assert.equal(runLiveNoYes.status, 1);
  assert.equal(stripAnsi(runLiveNoYes.stderr).includes("non-interactive live runs require --yes"), true);
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}

console.log("cli output contracts: ok");
