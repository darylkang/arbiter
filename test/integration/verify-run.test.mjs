import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import { runMockService, runResolveService } from "../../src/run/run-service.ts";
import { formatVerifyReport, verifyRunDir } from "../../src/tools/verify-run.ts";
import { buildIndependentSmokeConfig } from "../helpers/scenarios.mjs";
import { REPO_ROOT, withTempWorkspace, writeJson } from "../helpers/workspace.mjs";

const noopWarningSink = { warn() {} };

test("verifyRunDir passes for a completed mock run", { concurrency: false }, async () => {
  await withTempWorkspace("arbiter-verify-run-", async (cwd) => {
    const configPath = resolve(cwd, "arbiter.config.json");
    writeJson(
      configPath,
      buildIndependentSmokeConfig({
        questionText: "Verify smoke prompt",
        questionId: "verify_q1",
        kMax: 4,
        batchSize: 2,
        workers: 2,
        stopMode: "advisor",
        stopPolicy: {
          novelty_epsilon: 0.1,
          similarity_threshold: 0.85,
          patience: 2
        }
      })
    );

    const result = await runMockService({
      configPath,
      assetRoot: REPO_ROOT,
      runsDir: resolve(cwd, "runs"),
      quiet: true,
      debug: false,
      warningSink: noopWarningSink
    });

    const report = verifyRunDir(result.runDir);
    assert.equal(report.ok, true, formatVerifyReport(report));
    const manifest = JSON.parse(readFileSync(resolve(result.runDir, "manifest.json"), "utf8"));
    assert.equal(manifest.monitoring_complete, true);
    assert.equal(manifest.monitoring_expected_records, manifest.monitoring_recorded_records);
  });
});

test("verifyRunDir passes for resolve-only runs", { concurrency: false }, async () => {
  await withTempWorkspace("arbiter-verify-resolve-", async (cwd) => {
    const configPath = resolve(cwd, "arbiter.config.json");
    writeJson(configPath, buildIndependentSmokeConfig({ questionText: "Resolve-only prompt", questionId: "resolve_only_q1" }));

    const result = runResolveService({
      configPath,
      assetRoot: REPO_ROOT,
      runsDir: resolve(cwd, "runs"),
      warningSink: noopWarningSink
    });

    const report = verifyRunDir(result.runDir);
    assert.equal(report.ok, true, formatVerifyReport(report));
    const manifest = JSON.parse(readFileSync(resolve(result.runDir, "manifest.json"), "utf8"));
    assert.equal(manifest.stopping_mode, "resolve_only");
    assert.equal(manifest.monitoring_complete, true);
    assert.equal(manifest.monitoring_expected_records, 0);
    assert.equal(manifest.monitoring_recorded_records, 0);
  });
});
