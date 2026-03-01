import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

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

const rootHelp = run(["--help"]);
assert.equal(rootHelp.status, 0);
assert.equal(rootHelp.stdout.includes("arbiter init"), true);
assert.equal(rootHelp.stdout.includes("arbiter run"), true);
assert.equal(rootHelp.stdout.includes("--headless"), false);
assert.equal(rootHelp.stdout.includes("--verbose"), false);
assert.equal(rootHelp.stdout.includes("verify"), false);
assert.equal(rootHelp.stdout.includes("report"), false);

const runHelp = run(["run", "--help"]);
assert.equal(runHelp.status, 0);
assert.equal(runHelp.stdout.includes("--config <path>"), true);
assert.equal(runHelp.stdout.includes("--dashboard"), true);
assert.equal(runHelp.stdout.includes("--mode <mock|live>"), true);
assert.equal(runHelp.stdout.includes("--live"), false);
assert.equal(runHelp.stdout.includes("--yes"), false);
assert.equal(runHelp.stdout.includes("--allow-free"), false);

const unknown = run(["does-not-exist"]);
assert.equal(unknown.status, 1);
assert.equal(unknown.stderr.includes("unknown command: does-not-exist"), true);

const version = run(["-V"]);
assert.equal(version.status, 0);
assert.match(version.stdout.trim(), /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/);

const nonTtyRoot = run([]);
assert.equal(nonTtyRoot.status, 0);
assert.equal(nonTtyRoot.stdout.includes("Commands:"), true);

const tempRoot = mkdtempSync(resolve(tmpdir(), "arbiter-cli-contracts-"));
try {
  const init1 = run(["init"], { cwd: tempRoot });
  assert.equal(init1.status, 0);
  assert.equal(init1.stdout.includes("created config:"), true);
  assert.equal(init1.stdout.includes("arbiter run --config"), true);
  assert.equal(existsSync(resolve(tempRoot, "arbiter.config.json")), true);

  const init2 = run(["init"], { cwd: tempRoot });
  assert.equal(init2.status, 0);
  assert.equal(existsSync(resolve(tempRoot, "arbiter.config.1.json")), true);

  const runHeadless = run(["run", "--config", "arbiter.config.json"], {
    cwd: tempRoot,
    env: { OPENROUTER_API_KEY: "" }
  });
  assert.equal(runHeadless.status, 0);
  assert.equal(runHeadless.stdout.trim(), "");

  const runDashboardNoTty = run(["run", "--config", "arbiter.config.json", "--dashboard"], {
    cwd: tempRoot,
    env: { OPENROUTER_API_KEY: "" }
  });
  assert.equal(runDashboardNoTty.status, 0);
  assert.equal(
    runDashboardNoTty.stderr.includes("--dashboard requires TTY stdout; continuing headless"),
    true
  );

  const missingConfig = run(["run", "--config", "missing.config.json"], { cwd: tempRoot });
  assert.equal(missingConfig.status, 1);
  assert.equal(missingConfig.stderr.toLowerCase().includes("no such file") || missingConfig.stderr.toLowerCase().includes("enoent"), true);
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}

console.log("cli output contracts: ok");
