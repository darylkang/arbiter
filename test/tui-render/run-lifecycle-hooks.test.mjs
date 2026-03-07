import assert from "node:assert/strict";
import test from "node:test";

import { createPlainFormatter } from "../../src/ui/fmt.ts";
import { buildReceiptDisplayText, buildRunDashboardText } from "../../src/ui/run-lifecycle-hooks.ts";

const buildDashboardVm = (overrides = {}) => ({
  statusContext: "run / monitoring",
  elapsedMs: 1_000,
  progressLabel: "Trials: 0/10 · Workers: 2",
  progressPct: 0,
  eta: "—",
  monitoringRows: [
    { key: "Novelty rate", value: "— (threshold 0.100)" },
    { key: "Patience", value: "0/2" },
    { key: "Status", value: "sampling continues" }
  ],
  caveatLines: [{ text: "Stopping indicates diminishing novelty, not correctness.", tone: "muted" }],
  workerRows: [
    { id: 1, state: "idle", model: "—", tick: 1 },
    { id: 2, state: "running", trialId: 4, model: "openai/gpt-4o-mini-2024-07-18", tick: 1 }
  ],
  usageLines: [{ text: "Usage so far: 0 tokens (in 0, out 0)", tone: "text" }],
  footerText: "Ctrl+C graceful stop",
  ...overrides
});

test("dashboard omits embedding-group caveat when grouping is disabled", () => {
  const text = buildRunDashboardText(buildDashboardVm());
  assert.equal(text.includes("Groups reflect embedding similarity, not semantic categories."), false);
  assert.equal(text.includes("Embedding groups"), false);
});

test("dashboard includes embedding-group caveat when grouping is enabled", () => {
  const text = buildRunDashboardText(
    buildDashboardVm({
      monitoringRows: [
        { key: "Novelty rate", value: "0.060 (threshold 0.050)" },
        { key: "Patience", value: "1/4" },
        { key: "Status", value: "sampling continues" },
        { key: "Embedding groups", value: "3" }
      ],
      caveatLines: [
        { text: "Stopping indicates diminishing novelty, not correctness.", tone: "muted" },
        { text: "Groups reflect embedding similarity, not semantic categories.", tone: "muted" }
      ]
    })
  );
  assert.equal(text.includes("Groups reflect embedding similarity, not semantic categories."), true);
  assert.equal(text.includes("Embedding groups"), true);
  assert.equal(text.includes("3"), true);
});

test("dashboard shows unknown ETA when insufficient data", () => {
  const text = buildRunDashboardText(buildDashboardVm({ eta: "—" }));
  assert.equal(text.includes("ETA —"), true);
});

test("dashboard marks usage as not applicable in mock mode", () => {
  const text = buildRunDashboardText(
    buildDashboardVm({
      usageLines: [{ text: "Usage not applicable", tone: "muted" }]
    })
  );
  assert.equal(text.includes("Usage not applicable"), true);
});

test("dashboard worker rows show assigned model labels for active trials", () => {
  const text = buildRunDashboardText(buildDashboardVm());
  assert.equal(text.includes("openai/gpt-4o-mini-2024-07-18"), true);
  assert.equal(text.includes("trial 4"), true);
});

test("receipt display text remains ANSI-free under the plain formatter", () => {
  const fmt = createPlainFormatter({ columns: 80 });
  const text = buildReceiptDisplayText(
    {
      statusContext: "run / receipt",
      stopBanner: "Stopped: sampling complete",
      caveatLines: [{ text: "Stopping indicates diminishing novelty, not correctness.", tone: "muted" }],
      summaryRows: [{ key: "Trials", value: "10 / 10 / 10 (planned / completed / eligible)" }],
      groupLines: [],
      artifactRows: ["receipt.txt"],
      reproduceCommand: "arbiter run --config runs/example/config.resolved.json",
      footerText: "Run complete."
    },
    { width: 80, fmt }
  );

  assert.equal(/\u001b\[/.test(text), false);
  assert.equal(text.includes("Stopped: sampling complete"), true);
});
