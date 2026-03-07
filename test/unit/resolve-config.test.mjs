import assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";

import { resolveConfig } from "../../src/config/resolve-config.ts";
import { buildIndependentSmokeConfig } from "../helpers/scenarios.mjs";
import { REPO_ROOT, withTempWorkspace, writeJson } from "../helpers/workspace.mjs";

test("resolveConfig hydrates stable measurement defaults and decision-contract label space", async () => {
  await withTempWorkspace("arbiter-resolve-config-", async (cwd) => {
    const configPath = resolve(cwd, "arbiter.config.json");
    const config = buildIndependentSmokeConfig({
      questionText: "Contract hydration",
      questionId: "resolve_contract_q1"
    });
    config.protocol.decision_contract = { id: "binary_decision_v1" };

    writeJson(configPath, config);

    const result = resolveConfig({
      configPath,
      configRoot: cwd,
      assetRoot: REPO_ROOT
    });

    assert.equal(result.resolvedConfig.measurement.normalization, "newline_to_lf+trim_trailing");
    assert.equal(result.resolvedConfig.measurement.similarity_metric, "cosine");
    assert.equal(result.resolvedConfig.measurement.clustering.ordering_rule, "trial_id_asc");
    assert.deepEqual(result.resolvedConfig.protocol.decision_contract?.label_space.labels, ["yes", "no"]);
  });
});

test("resolveConfig rejects weighted pools with no positive probability mass", async () => {
  await withTempWorkspace("arbiter-resolve-config-", async (cwd) => {
    const configPath = resolve(cwd, "arbiter.config.json");
    const config = buildIndependentSmokeConfig({
      questionText: "Invalid weights",
      questionId: "resolve_weights_q1"
    });
    config.sampling.models = [{ model: config.sampling.models[0].model, weight: 0 }];

    writeJson(configPath, config);

    assert.throws(
      () =>
        resolveConfig({
          configPath,
          configRoot: cwd,
          assetRoot: REPO_ROOT
        }),
      /sampling\/models/
    );
  });
});

test("resolveConfig rejects inverted decode ranges", async () => {
  await withTempWorkspace("arbiter-resolve-config-", async (cwd) => {
    const configPath = resolve(cwd, "arbiter.config.json");
    const config = buildIndependentSmokeConfig({
      questionText: "Invalid decode range",
      questionId: "resolve_decode_q1",
      decode: {
        temperature: { min: 0.9, max: 0.1 }
      }
    });

    writeJson(configPath, config);

    assert.throws(
      () =>
        resolveConfig({
          configPath,
          configRoot: cwd,
          assetRoot: REPO_ROOT
        }),
      /sampling\/decode\/temperature\/max/
    );
  });
});
