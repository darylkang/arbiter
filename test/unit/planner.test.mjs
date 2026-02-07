import assert from "node:assert/strict";
import test from "node:test";

import { generateTrialPlan } from "../../dist/planning/planner.js";

const buildIndependentConfig = (seed = "planner-seed") => ({
  run: { seed },
  execution: { k_max: 6 },
  sampling: {
    models: [
      { model: "model-a", weight: 1 },
      { model: "model-b", weight: 1 }
    ],
    personas: [
      { persona: "persona-a", weight: 1 },
      { persona: "persona-b", weight: 1 }
    ],
    protocols: [
      { protocol: "independent_v1", weight: 1 },
      { protocol: "independent_v2", weight: 1 }
    ],
    decode: {
      temperature: { min: 0.1, max: 0.9 },
      max_tokens: { min: 30, max: 60 }
    }
  },
  protocol: {
    type: "independent"
  }
});

const buildDebateConfig = (seed = "debate-seed") => ({
  run: { seed },
  execution: { k_max: 4 },
  sampling: {
    models: [{ model: "model-x", weight: 1 }],
    personas: [
      { persona: "persona-a", weight: 1 },
      { persona: "persona-b", weight: 1 }
    ],
    protocols: [{ protocol: "debate_v1", weight: 1 }],
    decode: {
      max_tokens: { min: 10, max: 20 }
    }
  },
  protocol: {
    type: "debate_v1"
  }
});

test("generateTrialPlan is deterministic for a fixed config", () => {
  const config = buildIndependentConfig();
  const first = generateTrialPlan(config);
  const second = generateTrialPlan(config);

  assert.deepEqual(first.plan, second.plan);
  assert.equal(first.planSha256, second.planSha256);
});

test("generateTrialPlan changes when seed changes", () => {
  const first = generateTrialPlan(buildIndependentConfig("seed-1"));
  const second = generateTrialPlan(buildIndependentConfig("seed-2"));

  assert.notEqual(first.planSha256, second.planSha256);
});

test("generateTrialPlan assigns sequential trial ids", () => {
  const { plan } = generateTrialPlan(buildIndependentConfig());
  assert.deepEqual(
    plan.map((entry) => entry.trial_id),
    [0, 1, 2, 3, 4, 5]
  );
});

test("generateTrialPlan samples decode values within configured ranges", () => {
  const { plan } = generateTrialPlan(buildIndependentConfig());
  for (const entry of plan) {
    assert.equal(entry.protocol, "independent");
    assert.ok(entry.assigned_config.decode);
    assert.equal(entry.assigned_config.decode.temperature >= 0.1, true);
    assert.equal(entry.assigned_config.decode.temperature <= 0.9, true);
    assert.equal(Number.isInteger(entry.assigned_config.decode.max_tokens), true);
    assert.equal(entry.assigned_config.decode.max_tokens >= 30, true);
    assert.equal(entry.assigned_config.decode.max_tokens <= 60, true);
  }
});

test("generateTrialPlan emits debate role assignments", () => {
  const { plan } = generateTrialPlan(buildDebateConfig());

  for (const entry of plan) {
    assert.equal(entry.protocol, "debate_v1");
    assert.ok(entry.role_assignments);
    assert.equal(entry.role_assignments.proposer.model_slug, entry.assigned_config.model);
    assert.equal(entry.role_assignments.critic.model_slug, entry.assigned_config.model);
    assert.ok(entry.role_assignments.proposer.persona_id);
    assert.ok(entry.role_assignments.critic.persona_id);
  }
});
