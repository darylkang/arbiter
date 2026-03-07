import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import { runMockService } from "../../src/run/run-service.ts";
import { formatVerifyReport, verifyRunDir } from "../../src/tools/verify-run.ts";
import { buildIndependentSmokeConfig } from "../helpers/scenarios.mjs";
import { REPO_ROOT, getSingleRunDir, withTempWorkspace, writeJson } from "../helpers/workspace.mjs";

const noopWarningSink = { warn() {} };

test("contract failure policy matrix preserves manifest semantics and verification behavior", { concurrency: false }, async () => {
  await withTempWorkspace("arbiter-contract-policy-", async (cwd) => {
    const configPath = resolve(cwd, "arbiter.config.json");
    const config = buildIndependentSmokeConfig({
      questionText: "Contract policy prompt",
      questionId: "qa_contract_policy",
      kMax: 4,
      batchSize: 2,
      workers: 1
    });
    config.protocol.decision_contract = { id: "binary_decision_v1" };
    writeJson(configPath, config);

    const runPolicy = async (policy, runsDirName) =>
      runMockService({
        configPath,
        assetRoot: REPO_ROOT,
        runsDir: resolve(cwd, runsDirName),
        quiet: true,
        debug: false,
        warningSink: noopWarningSink,
        policy: { contractFailurePolicy: policy }
      });

    const warnResult = await runPolicy("warn", "runs-warn");
    const warnManifest = JSON.parse(readFileSync(resolve(warnResult.runDir, "manifest.json"), "utf8"));
    const warnTrials = readFileSync(resolve(warnResult.runDir, "trials.jsonl"), "utf8")
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    assert.equal(warnManifest.policy.contract_failure_policy, "warn");
    assert.equal(warnTrials.some((record) => record?.parsed?.parse_status === "fallback"), true);
    assert.equal(warnManifest.k_eligible > 0, true);
    const warnVerify = verifyRunDir(warnResult.runDir);
    assert.equal(warnVerify.ok, true, formatVerifyReport(warnVerify));

    const excludeResult = await runPolicy("exclude", "runs-exclude");
    const excludeManifest = JSON.parse(readFileSync(resolve(excludeResult.runDir, "manifest.json"), "utf8"));
    const excludeTrials = readFileSync(resolve(excludeResult.runDir, "trials.jsonl"), "utf8")
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    assert.equal(excludeManifest.policy.contract_failure_policy, "exclude");
    assert.equal(excludeTrials.some((record) => record?.parsed?.parse_status === "fallback"), true);
    assert.equal(excludeManifest.k_eligible, 0);
    assert.equal(excludeManifest.measurement.embedding.status, "not_generated");
    assert.equal(existsSync(resolve(excludeResult.runDir, "embeddings.arrow")), false);
    const excludeVerify = verifyRunDir(excludeResult.runDir);
    assert.equal(excludeVerify.ok, true, formatVerifyReport(excludeVerify));

    await assert.rejects(() => runPolicy("fail", "runs-fail"), /Contract parse failures:/i);
    const failRunDir = getSingleRunDir(resolve(cwd, "runs-fail"));
    const failManifest = JSON.parse(readFileSync(resolve(failRunDir, "manifest.json"), "utf8"));
    assert.equal(failManifest.policy.contract_failure_policy, "fail");
    assert.equal(failManifest.stop_reason, "error");
    assert.equal(failManifest.incomplete, true);
    assert.equal(
      typeof failManifest.notes === "string" && failManifest.notes.includes("Contract parse failures"),
      true
    );
    const failVerify = verifyRunDir(failRunDir);
    assert.equal(failVerify.ok, true, formatVerifyReport(failVerify));
  });
});
