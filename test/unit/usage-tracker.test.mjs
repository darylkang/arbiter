import assert from "node:assert/strict";
import test from "node:test";

import { UsageTracker } from "../../dist/artifacts/usage-tracker.js";

const nearlyEqual = (a, b, epsilon = 1e-12) => Math.abs(a - b) <= epsilon;

test("UsageTracker returns undefined when no meaningful usage exists", () => {
  const tracker = new UsageTracker();

  tracker.ingestTrial({
    requested_model_slug: "openai/gpt-4.1",
    usage: {},
    calls: [{ model_requested: "openai/gpt-4.1", usage: {} }]
  });

  assert.equal(tracker.buildSummary(), undefined);
});

test("UsageTracker aggregates trial and call usage by actual/requested model", () => {
  const tracker = new UsageTracker();

  tracker.ingestTrial({
    requested_model_slug: "provider/requested-main",
    actual_model: "provider/actual-main",
    usage: {
      prompt_tokens: 10,
      completion_tokens: 5,
      cost: 0.01
    },
    calls: [
      {
        model_requested: "provider/call-a",
        model_actual: null,
        usage: {
          prompt_tokens: 2,
          completion_tokens: 3,
          total_tokens: 5,
          cost: 0.002
        }
      },
      {
        model_requested: "provider/call-a",
        model_actual: "provider/call-a-actual",
        usage: {
          prompt_tokens: 1,
          completion_tokens: 1,
          total_tokens: 2,
          cost: 0.001
        }
      },
      {
        model_requested: "provider/call-b",
        model_actual: null,
        usage: {}
      }
    ]
  });

  tracker.ingestTrial({
    requested_model_slug: "provider/requested-only",
    actual_model: null,
    usage: {
      total_tokens: 20
    },
    calls: [
      {
        model_requested: "provider/call-c",
        model_actual: null,
        usage: {
          cost: 0.5
        }
      }
    ]
  });

  const summary = tracker.buildSummary();
  assert.ok(summary);

  assert.equal(summary.totals.prompt_tokens, 13);
  assert.equal(summary.totals.completion_tokens, 9);
  assert.equal(summary.totals.total_tokens, 42);
  assert.ok(nearlyEqual(summary.totals.cost, 0.513));

  assert.deepEqual(summary.by_model["provider/actual-main"], {
    prompt_tokens: 10,
    completion_tokens: 5,
    total_tokens: 15,
    cost: 0.01
  });
  assert.deepEqual(summary.by_model["provider/requested-only"], {
    prompt_tokens: 0,
    completion_tokens: 0,
    total_tokens: 20
  });
  assert.deepEqual(summary.by_model["provider/call-a"], {
    prompt_tokens: 2,
    completion_tokens: 3,
    total_tokens: 5,
    cost: 0.002
  });
  assert.deepEqual(summary.by_model["provider/call-a-actual"], {
    prompt_tokens: 1,
    completion_tokens: 1,
    total_tokens: 2,
    cost: 0.001
  });
  assert.deepEqual(summary.by_model["provider/call-c"], {
    prompt_tokens: 0,
    completion_tokens: 0,
    total_tokens: 0,
    cost: 0.5
  });
  assert.equal("provider/call-b" in summary.by_model, false);
});
