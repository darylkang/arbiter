import assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";

import { verifyRunDir } from "../../src/tools/verify-run.ts";
import { getSingleRunDir, runBuiltCli, withTempWorkspace } from "../helpers/workspace.mjs";

test("built CLI init and run produce a verifiable quickstart run", { concurrency: false }, async () => {
  await withTempWorkspace("arbiter-quickstart-", async (cwd) => {
    const init = runBuiltCli(["init"], { cwd });
    assert.equal(init.status, 0, init.stderr);

    const run = runBuiltCli(["run", "--config", "arbiter.config.json", "--out", "runs"], { cwd });
    assert.equal(run.status, 0, run.stderr);

    const runDir = getSingleRunDir(resolve(cwd, "runs"));
    const report = verifyRunDir(runDir);
    assert.equal(report.ok, true);
  });
});
