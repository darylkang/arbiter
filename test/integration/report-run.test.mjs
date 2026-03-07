import assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";

import { runMockService } from "../../src/run/run-service.ts";
import { buildReportModel, formatReportJson, formatReportText } from "../../src/tools/report-run.ts";
import { buildIndependentSmokeConfig } from "../helpers/scenarios.mjs";
import { REPO_ROOT, withTempWorkspace, writeJson } from "../helpers/workspace.mjs";

const noopWarningSink = { warn() {} };

test("report model and text summarize a generated run", { concurrency: false }, async () => {
  await withTempWorkspace("arbiter-report-run-", async (cwd) => {
    const configPath = resolve(cwd, "arbiter.config.json");
    writeJson(
      configPath,
      buildIndependentSmokeConfig({
        questionText: "Report smoke prompt",
        questionId: "report_q1",
        kMax: 4,
        batchSize: 2,
        workers: 2
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

    const model = buildReportModel(result.runDir);
    const text = formatReportText(model);
    const json = formatReportJson(model);

    assert.equal(text.includes("Arbiter Report"), true);
    assert.equal(text.includes("Counts:"), true);
    assert.equal(text.includes(`Output: ${result.runDir}`), true);
    assert.equal(JSON.parse(json).run_id, model.run_id);
  });
});
