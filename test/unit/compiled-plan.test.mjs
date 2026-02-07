import assert from "node:assert/strict";
import test from "node:test";

import { compileRunPlan } from "../../dist/planning/compiled-plan.js";

const buildConfig = () => ({
  run: {
    run_id: "seed-run",
    seed: "compiled-plan-seed"
  },
  protocol: {
    type: "independent"
  },
  sampling: {
    models: [{ model: "openai/gpt-4o-mini-2024-07-18", weight: 1 }],
    personas: [{ persona: "neutral", weight: 1 }],
    protocols: [{ protocol: "independent_v1", weight: 1 }],
    decode: {
      temperature: { min: 0.2, max: 0.6 },
      max_tokens: { min: 10, max: 20 }
    }
  },
  execution: {
    k_max: 3
  }
});

const policy = {
  strict: false,
  allow_free: false,
  allow_aliased: false,
  contract_failure_policy: "warn"
};

test("compileRunPlan freezes config, policy, and trial plan", () => {
  const compiled = compileRunPlan({
    runId: "run_1",
    runDir: "/tmp/run_1",
    resolvedConfig: buildConfig(),
    policy
  });

  assert.equal(Object.isFrozen(compiled), true);
  assert.equal(Object.isFrozen(compiled.resolvedConfig), true);
  assert.equal(Object.isFrozen(compiled.policy), true);
  assert.equal(Object.isFrozen(compiled.plan), true);
  assert.equal(Object.isFrozen(compiled.plan[0]), true);
  assert.equal(compiled.plan.length, 3);

  assert.throws(() => {
    compiled.plan[0].trial_id = 99;
  });
  assert.throws(() => {
    compiled.policy.strict = true;
  });
});

test("compileRunPlan is deterministic for the same inputs", () => {
  const first = compileRunPlan({
    runId: "run_a",
    runDir: "/tmp/run_a",
    resolvedConfig: buildConfig(),
    policy
  });
  const second = compileRunPlan({
    runId: "run_a",
    runDir: "/tmp/run_a",
    resolvedConfig: buildConfig(),
    policy
  });

  assert.equal(first.planSha256, second.planSha256);
  assert.deepEqual(first.plan, second.plan);
});
