import assert from "node:assert/strict";
import test from "node:test";

import { buildRunDashboardText } from "../../dist/ui/run-lifecycle-hooks.js";

const buildSnapshot = (overrides = {}) => ({
  runId: "run_123",
  questionExcerpt: "What does the dashboard show?",
  mode: "live",
  protocolLabel: "Independent",
  groupingEnabled: false,
  groupCount: null,
  planned: 10,
  attempted: 0,
  eligible: 0,
  workers: 2,
  kMinEligible: 5,
  stopMode: "advisor",
  noveltyThreshold: 0.1,
  similarityThreshold: 0.85,
  patience: 2,
  lowNoveltyStreak: 0,
  noveltyRate: null,
  meanMaxSimilarity: null,
  stopState: "sampling continues",
  startedAtMs: Date.now() - 1_000,
  renderTick: 1,
  usage: {
    prompt: 0,
    completion: 0,
    total: 0
  },
  workerStatus: new Map([
    [1, { status: "idle" }],
    [2, { status: "running", trialId: 4 }]
  ]),
  ...overrides
});

test("dashboard omits embedding-group caveat when grouping is disabled", () => {
  const text = buildRunDashboardText(buildSnapshot({ groupingEnabled: false }));
  assert.equal(text.includes("Embedding groups reflect similarity, not semantic categories."), false);
  assert.equal(text.includes("embedding groups:"), false);
});

test("dashboard includes embedding-group caveat when grouping is enabled", () => {
  const text = buildRunDashboardText(
    buildSnapshot({
      groupingEnabled: true,
      groupCount: 3
    })
  );
  assert.equal(text.includes("Embedding groups reflect similarity, not semantic categories."), true);
  assert.equal(text.includes("embedding groups: 3"), true);
});

test("dashboard uses best-effort ETA and shows unknown when insufficient data", () => {
  const text = buildRunDashboardText(buildSnapshot({ attempted: 0, planned: 10 }));
  assert.equal(text.includes("ETA —"), true);
});

test("dashboard marks usage as not applicable in mock mode", () => {
  const text = buildRunDashboardText(buildSnapshot({ mode: "mock" }));
  assert.equal(text.includes("usage not applicable (mock mode)"), true);
});
