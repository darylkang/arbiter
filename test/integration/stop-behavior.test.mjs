import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import { runMockService } from "../../src/run/run-service.ts";
import { buildIndependentSmokeConfig } from "../helpers/scenarios.mjs";
import { REPO_ROOT, withTempWorkspace, writeJson } from "../helpers/workspace.mjs";

const noopWarningSink = { warn() {} };

const runStopScenario = async ({ cwd, stopMode }) => {
  const configPath = resolve(cwd, `arbiter.${stopMode}.config.json`);
  writeJson(
    configPath,
    buildIndependentSmokeConfig({
      questionText: "Early stop prompt",
      questionId: `early_stop_${stopMode}`,
      kMax: 6,
      batchSize: 2,
      workers: 1,
      stopMode,
      stopPolicy: {
        novelty_epsilon: 1,
        similarity_threshold: 0,
        patience: 1
      }
    })
  );

  const result = await runMockService({
    configPath,
    assetRoot: REPO_ROOT,
    runsDir: resolve(cwd, `${stopMode}-runs`),
    quiet: true,
    debug: false,
    warningSink: noopWarningSink
  });

  const manifest = JSON.parse(readFileSync(resolve(result.runDir, "manifest.json"), "utf8"));
  const monitoring = readFileSync(resolve(result.runDir, "monitoring.jsonl"), "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));

  return { manifest, monitoring };
};

test("enforcer stop mode halts before k_max while advisor records would-stop only", { concurrency: false }, async () => {
  await withTempWorkspace("arbiter-stop-mode-", async (cwd) => {
    const enforced = await runStopScenario({ cwd, stopMode: "enforcer" });
    assert.equal(enforced.manifest.stop_reason, "converged");
    assert.equal(enforced.manifest.k_attempted < 6, true);
    assert.equal(enforced.monitoring.some((record) => record.stop?.would_stop === true), true);

    const advisory = await runStopScenario({ cwd, stopMode: "advisor" });
    assert.equal(advisory.manifest.stop_reason, "k_max_reached");
    assert.equal(advisory.monitoring.some((record) => record.stop?.would_stop === true), true);
    assert.equal(advisory.monitoring.some((record) => record.stop?.should_stop === true), false);
  });
});
