import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { DIST_CLI_ENTRY, runBuiltCli, withTempWorkspace } from "../helpers/workspace.mjs";

test("built CLI entry exists for command-surface tests", () => {
  assert.equal(existsSync(DIST_CLI_ENTRY), true);
});

test("root and run help expose the intended command surface", async () => {
  await withTempWorkspace("arbiter-cli-contracts-", async (cwd) => {
    const rootHelp = runBuiltCli(["--help"], { cwd });
    assert.equal(rootHelp.status, 0);
    assert.equal(rootHelp.stdout.includes("arbiter init"), true);
    assert.equal(rootHelp.stdout.includes("arbiter run"), true);
    assert.equal(rootHelp.stdout.includes("--headless"), false);
    assert.equal(rootHelp.stdout.includes("--verbose"), false);
    assert.equal(rootHelp.stdout.includes("verify"), false);
    assert.equal(rootHelp.stdout.includes("report"), false);
    assert.equal(rootHelp.stdout.includes("/run"), false);
    assert.equal(rootHelp.stdout.includes("/quit"), false);
    assert.equal(rootHelp.stdout.toLowerCase().includes("slash"), false);

    const runHelp = runBuiltCli(["run", "--help"], { cwd });
    assert.equal(runHelp.status, 0);
    assert.equal(runHelp.stdout.includes("--config <path>"), true);
    assert.equal(runHelp.stdout.includes("--dashboard"), true);
    assert.equal(runHelp.stdout.includes("--mode <mock|live>"), true);
    assert.equal(runHelp.stdout.includes("--live"), false);
    assert.equal(runHelp.stdout.includes("--yes"), false);
    assert.equal(runHelp.stdout.includes("--allow-free"), false);
  });
});

test("built CLI handles version, unknown command, non-tty root, init collisions, and missing configs", async () => {
  await withTempWorkspace("arbiter-cli-contracts-", async (cwd) => {
    const unknown = runBuiltCli(["does-not-exist"], { cwd });
    assert.equal(unknown.status, 1);
    assert.equal(unknown.stderr.includes("unknown command: does-not-exist"), true);

    const version = runBuiltCli(["-V"], { cwd });
    assert.equal(version.status, 0);
    assert.match(version.stdout.trim(), /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/);

    const nonTtyRoot = runBuiltCli([], { cwd });
    assert.equal(nonTtyRoot.status, 0);
    assert.equal(nonTtyRoot.stdout.includes("TTY not detected. Showing headless help."), true);
    assert.equal(nonTtyRoot.stdout.includes("Commands:"), true);

    const init1 = runBuiltCli(["init"], { cwd });
    assert.equal(init1.status, 0);
    assert.equal(init1.stdout.includes("created config:"), true);
    assert.equal(init1.stdout.includes("arbiter run --config"), true);
    assert.equal(existsSync(join(cwd, "arbiter.config.json")), true);

    const init2 = runBuiltCli(["init"], { cwd });
    assert.equal(init2.status, 0);
    assert.equal(existsSync(join(cwd, "arbiter.config.1.json")), true);

    const runHeadless = runBuiltCli(["run", "--config", "arbiter.config.json"], {
      cwd,
      env: { OPENROUTER_API_KEY: "" }
    });
    assert.equal(runHeadless.status, 0);
    assert.equal(runHeadless.stdout.trim(), "");

    const runDashboardNoTty = runBuiltCli([
      "run",
      "--config",
      "arbiter.config.json",
      "--dashboard"
    ], {
      cwd,
      env: { OPENROUTER_API_KEY: "" }
    });
    assert.equal(runDashboardNoTty.status, 0);
    assert.equal(
      runDashboardNoTty.stderr.includes(
        "Dashboard requested without TTY; continuing in headless mode."
      ),
      true
    );

    const missingConfig = runBuiltCli(["run", "--config", "missing.config.json"], { cwd });
    assert.equal(missingConfig.status, 1);
    assert.equal(
      missingConfig.stderr.toLowerCase().includes("no such file") ||
        missingConfig.stderr.toLowerCase().includes("enoent"),
      true
    );
  });
});
