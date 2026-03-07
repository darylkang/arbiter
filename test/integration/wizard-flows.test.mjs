import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import { loadTemplateConfig } from "../../src/cli/commands.ts";
import { runPreflight } from "../../src/ui/wizard/flows.ts";
import { REPO_ROOT, withTempWorkspace } from "../helpers/workspace.mjs";

test("runPreflight does not create the output directory during review", async () => {
  await withTempWorkspace("arbiter-wizard-flows-", async (cwd) => {
    const config = loadTemplateConfig(REPO_ROOT, "default");
    config.output.runs_dir = "runs/review-only/output";

    await runPreflight({
      config,
      assetRoot: REPO_ROOT,
      runMode: "mock",
      action: "save"
    });

    const outputPath = resolve(cwd, config.output.runs_dir);
    assert.equal(existsSync(outputPath), false);
  });
});

test("runPreflight does not probe OpenRouter connectivity during review", async () => {
  await withTempWorkspace("arbiter-wizard-flows-", async () => {
    const config = loadTemplateConfig(REPO_ROOT, "default");
    config.output.runs_dir = ".";

    const originalFetch = globalThis.fetch;
    const originalApiKey = process.env.OPENROUTER_API_KEY;
    let fetchCalls = 0;
    globalThis.fetch = async (...args) => {
      fetchCalls += 1;
      return await originalFetch(...args);
    };
    process.env.OPENROUTER_API_KEY = "test-key";

    try {
      await runPreflight({
        config,
        assetRoot: REPO_ROOT,
        runMode: "live",
        action: "run"
      });
      assert.equal(fetchCalls, 0);
    } finally {
      globalThis.fetch = originalFetch;
      if (originalApiKey === undefined) {
        delete process.env.OPENROUTER_API_KEY;
      } else {
        process.env.OPENROUTER_API_KEY = originalApiKey;
      }
    }
  });
});
