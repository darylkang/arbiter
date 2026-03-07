import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import { runMockService, runResolveService } from "../../src/run/run-service.ts";
import { createUiRunLifecycleHooks } from "../../src/ui/run-lifecycle-hooks.ts";
import { formatVerifyReport, verifyRunDir } from "../../src/tools/verify-run.ts";
import { buildIndependentSmokeConfig } from "../helpers/scenarios.mjs";
import {
  PACKAGE_VERSION,
  REPO_ROOT,
  countJsonlLines,
  listFilesRecursive,
  normalizePath,
  withTempWorkspace,
  writeJson
} from "../helpers/workspace.mjs";

const noopWarningSink = {
  warn() {}
};

test("runResolveService writes resolve-only artifacts using asset-root package metadata", { concurrency: false }, async () => {
  await withTempWorkspace("arbiter-run-service-test-", async (cwd) => {
    const configPath = resolve(cwd, "arbiter.config.json");
    writeJson(
      configPath,
      buildIndependentSmokeConfig({ questionText: "resolve-only", questionId: "resolve_only_q1" })
    );

    const result = runResolveService({
      configPath,
      assetRoot: REPO_ROOT,
      runsDir: resolve(cwd, "runs"),
      warningSink: noopWarningSink
    });

    assert.deepEqual(listFilesRecursive(result.runDir), ["config.resolved.json", "manifest.json"]);

    const manifest = JSON.parse(readFileSync(resolve(result.runDir, "manifest.json"), "utf8"));
    assert.equal(manifest.arbiter_version, PACKAGE_VERSION);
    assert.equal(manifest.stopping_mode, "resolve_only");

    const report = verifyRunDir(result.runDir);
    assert.equal(report.ok, true, formatVerifyReport(report));
  });
});

test("runMockService writes complete artifact set with manifest/count consistency", { concurrency: false }, async () => {
  await withTempWorkspace("arbiter-run-service-test-", async (cwd) => {
    const configPath = resolve(cwd, "arbiter.config.json");
    writeJson(
      configPath,
      buildIndependentSmokeConfig({
        questionText: "Smoke test prompt",
        questionId: "qa_artifact_contract",
        kMax: 5,
        batchSize: 2,
        workers: 3,
        personaCount: 2
      })
    );

    const result = await runMockService({
      configPath,
      assetRoot: REPO_ROOT,
      runsDir: resolve(cwd, "runs"),
      quiet: true,
      debug: false,
      hooks: createUiRunLifecycleHooks(),
      receiptMode: "writeOnly",
      warningSink: noopWarningSink
    });

    const files = listFilesRecursive(result.runDir);
    const requiredFiles = [
      "config.resolved.json",
      "config.source.json",
      "manifest.json",
      "monitoring.jsonl",
      "receipt.txt",
      "trial_plan.jsonl",
      "trials.jsonl"
    ];
    for (const required of requiredFiles) {
      assert.equal(files.includes(required), true, `expected artifact ${required} in ${files.join(", ")}`);
    }
    assert.equal(files.some((path) => path.endsWith(".tmp")), false);

    const manifest = JSON.parse(readFileSync(resolve(result.runDir, "manifest.json"), "utf8"));
    const resolvedConfig = JSON.parse(readFileSync(resolve(result.runDir, "config.resolved.json"), "utf8"));

    assert.equal(normalizePath(result.runDir).startsWith(normalizePath(resolve(cwd, "runs"))), true);
    assert.equal(manifest.run_id, result.runId);
    assert.equal(manifest.k_planned, resolvedConfig.execution.k_max);
    assert.equal(manifest.k_attempted, result.kAttempted);
    assert.equal(manifest.k_eligible, result.kEligible);
    assert.equal(typeof manifest.plan_sha256, "string");
    assert.equal(manifest.plan_sha256.length, 64);
    assert.equal(manifest.measurement.embedding.embed_text_strategy, "outcome_only");
    assert.equal(manifest.measurement.embedding.normalization, "newline_to_lf+trim_trailing");
    assert.equal(manifest.measurement.grouping.enabled, false);
    assert.equal(manifest.measurement.grouping.params, null);
    assert.equal(manifest.metrics.final.k_attempted, result.kAttempted);
    assert.equal(manifest.metrics.final.k_eligible, result.kEligible);

    assert.equal(countJsonlLines(resolve(result.runDir, "trial_plan.jsonl")), resolvedConfig.execution.k_max);
    assert.equal(countJsonlLines(resolve(result.runDir, "trials.jsonl")), result.kAttempted);
    assert.equal(countJsonlLines(resolve(result.runDir, "monitoring.jsonl")) > 0, true);

    const artifactPaths = manifest.artifacts.entries.map((entry) => entry.path).sort();
    assert.equal(artifactPaths.includes("receipt.txt"), true);
    assert.equal(artifactPaths.includes("config.source.json"), true);
    assert.equal(artifactPaths.includes("monitoring.jsonl"), true);
    assert.equal(
      artifactPaths.includes("embeddings.arrow") || artifactPaths.includes("embeddings.jsonl"),
      true
    );

    const report = verifyRunDir(result.runDir);
    assert.equal(report.ok, true, formatVerifyReport(report));
  });
});

test("runs with no eligible embeddings record null novelty metrics and skip arrow output", { concurrency: false }, async () => {
  await withTempWorkspace("arbiter-zero-eligible-", async (cwd) => {
    const configPath = resolve(cwd, "arbiter.config.json");
    writeJson(
      configPath,
      buildIndependentSmokeConfig({
        questionText: "Zero eligible prompt",
        questionId: "zero_eligible_q1",
        kMax: 3,
        batchSize: 1,
        workers: 1
      })
    );

    const previous = process.env.ARBITER_MOCK_EMPTY_EMBED;
    process.env.ARBITER_MOCK_EMPTY_EMBED = "1";

    let result;
    try {
      result = await runMockService({
        configPath,
        assetRoot: REPO_ROOT,
        runsDir: resolve(cwd, "runs"),
        quiet: true,
        debug: false,
        warningSink: noopWarningSink
      });
    } finally {
      if (previous === undefined) {
        delete process.env.ARBITER_MOCK_EMPTY_EMBED;
      } else {
        process.env.ARBITER_MOCK_EMPTY_EMBED = previous;
      }
    }

    const monitoring = readFileSync(resolve(result.runDir, "monitoring.jsonl"), "utf8")
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line));

    for (const record of monitoring) {
      assert.equal(record.has_eligible_in_batch, false);
      assert.equal(record.novelty_rate, null);
      assert.equal(record.mean_max_sim_to_prior, null);
    }

    const manifest = JSON.parse(readFileSync(resolve(result.runDir, "manifest.json"), "utf8"));
    assert.equal(manifest.measurement.embedding.status, "not_generated");
    assert.equal(existsSync(resolve(result.runDir, "embeddings.arrow")), false);
  });
});
