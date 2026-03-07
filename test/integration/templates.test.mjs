import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import { runMockService } from "../../src/run/run-service.ts";
import { loadTemplateConfig } from "../helpers/scenarios.mjs";
import { REPO_ROOT, readJson, withTempWorkspace, writeJson } from "../helpers/workspace.mjs";

const noopWarningSink = { warn() {} };
const templateManifest = readJson(resolve(REPO_ROOT, "resources/templates/manifest.json"));
const templates = templateManifest.entries.map((entry) => entry.id);

test("template manifest defines exactly one init default", () => {
  const defaults = templateManifest.entries.filter((entry) => entry.init_default === true);
  assert.equal(defaults.length, 1);
  assert.equal(defaults[0]?.id, "default");
});

for (const templateName of templates) {
  test(`template ${templateName} resolves and runs under the mock service`, { concurrency: false }, async () => {
    await withTempWorkspace(`arbiter-template-${templateName}-`, async (cwd) => {
      const config = loadTemplateConfig(templateName);
      config.question = {
        text: `${templateName} smoke prompt`,
        question_id: `template_${templateName}`
      };
      config.execution.k_max = 2;
      config.execution.batch_size = 1;
      config.execution.workers = 1;
      config.execution.k_min = 0;
      config.output.runs_dir = "runs";

      const configPath = resolve(cwd, "arbiter.config.json");
      writeJson(configPath, config);

      const result = await runMockService({
        configPath,
        assetRoot: REPO_ROOT,
        runsDir: resolve(cwd, "runs"),
        quiet: true,
        debug: false,
        warningSink: noopWarningSink
      });

      const requiredFiles = [
        "config.source.json",
        "config.resolved.json",
        "manifest.json",
        "trial_plan.jsonl",
        "trials.jsonl",
        "monitoring.jsonl",
        "receipt.txt"
      ];
      for (const file of requiredFiles) {
        assert.equal(existsSync(resolve(result.runDir, file)), true, `missing ${file}`);
      }
      assert.equal(
        existsSync(resolve(result.runDir, "embeddings.arrow")) ||
          existsSync(resolve(result.runDir, "embeddings.jsonl")),
        true,
        "expected an embeddings artifact"
      );
    });
  });
}
