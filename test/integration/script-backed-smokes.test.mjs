import assert from "node:assert/strict";
import test from "node:test";

import { runNodeScript } from "../helpers/workspace.mjs";

const scripts = [
  "scripts/mock-run-smoke.mjs",
  "scripts/verify-smoke.mjs",
  "scripts/report-smoke.mjs",
  "scripts/template-smoke.mjs",
  "scripts/resolve-only.mjs",
  "scripts/contract-fallback.mjs",
  "scripts/contract-policy.mjs",
  "scripts/clustering-determinism.mjs",
  "scripts/clustering-limit.mjs",
  "scripts/mock-run-interrupt.mjs",
  "scripts/mock-run-debate.mjs",
  "scripts/debate-empty.mjs",
  "scripts/validate-embeddings-arrow.mjs",
  "scripts/receipt-failure.mjs",
  "scripts/zero-eligible.mjs",
  "scripts/error-code-null.mjs",
  "scripts/relative-config-path.mjs"
];

for (const scriptPath of scripts) {
  test(`script-backed smoke: ${scriptPath}`, { concurrency: false }, () => {
    const result = runNodeScript(scriptPath);
    assert.equal(result.status, 0, `${scriptPath} failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
  });
}
