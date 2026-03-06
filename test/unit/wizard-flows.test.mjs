import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

import { loadTemplateConfig } from "../../dist/cli/commands.js";
import { runPreflight } from "../../dist/ui/wizard/flows.js";

const REPO_ROOT = resolve(new URL("../../", import.meta.url).pathname);

const withTempCwd = async (fn) => {
  const previous = process.cwd();
  const cwd = mkdtempSync(join(tmpdir(), "arbiter-wizard-flows-"));
  process.chdir(cwd);
  try {
    await fn(cwd);
  } finally {
    process.chdir(previous);
    rmSync(cwd, { recursive: true, force: true });
  }
};

test("runPreflight does not create the output directory during review", async () => {
  await withTempCwd(async (cwd) => {
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
  await withTempCwd(async () => {
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
