import assert from "node:assert/strict";
import test from "node:test";

import { evaluatePolicy } from "../../dist/config/policy.js";

const makeResolvedConfig = (overrides = {}) => ({
  sampling: {
    models: [{ model: "openai/gpt-4o-mini", catalog_status: "listed" }],
    personas: [{ id: "p1" }],
    protocols: [{ id: "default" }],
    ...(overrides.sampling ?? {})
  },
  protocol: {
    type: "independent",
    ...(overrides.protocol ?? {})
  },
  execution: {
    k_max: 4,
    k_min: 1,
    batch_size: 1,
    ...(overrides.execution ?? {})
  }
});

test("evaluatePolicy reports catalog, slug, and stability warnings", () => {
  const resolvedConfig = makeResolvedConfig({
    sampling: {
      models: [
        { model: "openai/gpt-4o-mini", catalog_status: "listed" },
        { model: "acme/unknown-model", catalog_status: "unknown_to_catalog" },
        { model: "bare-model", catalog_status: "listed" }
      ],
      personas: [{ id: "p1" }, { id: "p2" }],
      protocols: [{ id: "a" }, { id: "b" }]
    },
    execution: {
      k_max: 1,
      k_min: 1,
      batch_size: 2
    }
  });

  const catalog = {
    models: [{ slug: "openai/gpt-4o-mini", tier: "free", is_aliased: false }]
  };

  const result = evaluatePolicy({
    resolvedConfig,
    catalog,
    strict: false,
    allowFree: false,
    allowAliased: false,
    contractFailurePolicy: "warn"
  });

  assert.equal(result.errors.length, 0);
  assert.equal(result.policy.contract_failure_policy, "warn");
  assert.ok(
    result.warnings.some((warning) => warning.includes("Model slugs without provider prefix"))
  );
  assert.ok(result.warnings.some((warning) => warning.includes("Models not found in catalog")));
  assert.ok(result.warnings.some((warning) => warning.includes("Free-tier models")));
  assert.ok(result.warnings.some((warning) => warning.includes("Expected samples per configuration cell is low")));
  assert.ok(result.warnings.some((warning) => warning.includes("k_min is smaller than batch_size")));
});

test("evaluatePolicy enforces strict free and aliased model restrictions", () => {
  const resolvedConfig = makeResolvedConfig({
    sampling: {
      models: [
        { model: "openai/gpt-4o-mini", catalog_status: "listed" },
        { model: "anthropic/claude-sonnet", catalog_status: "listed" }
      ]
    }
  });

  const catalog = {
    models: [
      { slug: "openai/gpt-4o-mini", tier: "free", is_aliased: false },
      { slug: "anthropic/claude-sonnet", tier: "paid", is_aliased: true }
    ]
  };

  const result = evaluatePolicy({
    resolvedConfig,
    catalog,
    strict: true,
    allowFree: false,
    allowAliased: false,
    contractFailurePolicy: "fail"
  });

  assert.equal(result.policy.contract_failure_policy, "fail");
  assert.equal(result.errors.length, 2);
  assert.ok(result.errors.some((error) => error.includes("allow-free")));
  assert.ok(result.errors.some((error) => error.includes("allow-aliased")));
});

test("evaluatePolicy allows strict mode bypass with explicit flags", () => {
  const resolvedConfig = makeResolvedConfig({
    sampling: {
      models: [
        { model: "openai/gpt-4o-mini", catalog_status: "listed" },
        { model: "anthropic/claude-sonnet", catalog_status: "listed" }
      ]
    },
    execution: {
      k_max: 8,
      k_min: 2,
      batch_size: 2
    }
  });

  const catalog = {
    models: [
      { slug: "openai/gpt-4o-mini", tier: "free", is_aliased: false },
      { slug: "anthropic/claude-sonnet", tier: "paid", is_aliased: true }
    ]
  };

  const result = evaluatePolicy({
    resolvedConfig,
    catalog,
    strict: true,
    allowFree: true,
    allowAliased: true,
    contractFailurePolicy: "exclude"
  });

  assert.equal(result.errors.length, 0);
  assert.equal(result.policy.contract_failure_policy, "exclude");
  assert.ok(result.warnings.some((warning) => warning.includes("Free-tier models")));
  assert.ok(result.warnings.some((warning) => warning.includes("Aliased models")));
});
