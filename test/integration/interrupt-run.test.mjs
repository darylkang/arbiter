import assert from "node:assert/strict";
import { mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import test from "node:test";

import {
  validateGroupAssignment,
  validateGroupState,
  validateManifest
} from "../../src/config/schema-validation.ts";
import { buildIndependentSmokeConfig } from "../helpers/scenarios.mjs";
import {
  DIST_CLI_ENTRY,
  getSingleRunDir,
  readJsonl,
  withTempWorkspace,
  writeJson
} from "../helpers/workspace.mjs";

const waitForExit = (child) =>
  new Promise((resolveExit, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => resolveExit(code ?? 1));
  });

test("SIGINT produces an incomplete run with valid grouping artifacts", { concurrency: false }, async () => {
  await withTempWorkspace("arbiter-interrupt-", async (cwd) => {
    const runsDir = resolve(cwd, "runs");
    mkdirSync(runsDir, { recursive: true });
    const configPath = resolve(cwd, "arbiter.config.json");
    writeJson(
      configPath,
      buildIndependentSmokeConfig({
        questionText: "Interrupt smoke prompt",
        questionId: "mock_interrupt_q1",
        kMax: 40,
        batchSize: 5,
        workers: 2,
        clustering: {
          enabled: true,
          tau: 0.75,
          cluster_limit: 10,
          stop_mode: "advisory"
        }
      })
    );

    const child = spawn(
      "node",
      [DIST_CLI_ENTRY, "run", "--config", configPath, "--out", runsDir],
      {
        cwd,
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, ARBITER_MOCK_DELAY_MS: "25" }
      }
    );

    setTimeout(() => {
      child.kill("SIGINT");
    }, 500);

    const exitCode = await waitForExit(child);
    assert.equal(exitCode, 0);

    const runDir = getSingleRunDir(runsDir);
    const manifest = JSON.parse(readFileSync(resolve(runDir, "manifest.json"), "utf8"));
    assert.equal(validateManifest(manifest), true);
    assert.equal(manifest.stop_reason, "user_interrupt");
    assert.equal(manifest.incomplete, true);

    const state = JSON.parse(readFileSync(resolve(runDir, "groups/state.json"), "utf8"));
    assert.equal(validateGroupState(state), true);

    const assignments = readJsonl(resolve(runDir, "groups/assignments.jsonl"));
    for (const record of assignments) {
      assert.equal(validateGroupAssignment(record), true);
    }

    const monitoring = readJsonl(resolve(runDir, "monitoring.jsonl"));
    let sawDistribution = false;
    for (const record of monitoring) {
      if (record.group_distribution === undefined) {
        continue;
      }
      assert.equal(Array.isArray(record.group_distribution), true);
      assert.equal(record.group_count, record.group_distribution.length);
      assert.equal(
        record.group_distribution.reduce((sum, value) => sum + value, 0),
        record.k_eligible
      );
      if (!sawDistribution) {
        assert.equal(record.js_divergence, null);
        sawDistribution = true;
      } else {
        assert.equal(typeof record.js_divergence, "number");
      }
    }
    assert.equal(sawDistribution, true);
  });
});
