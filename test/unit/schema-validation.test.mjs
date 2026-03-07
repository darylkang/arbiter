import assert from "node:assert/strict";
import test from "node:test";

import { formatAjvErrors, validateTrial } from "../../src/config/schema-validation.ts";

test("trial schema accepts null error.code for error records", () => {
  const trial = {
    trial_id: 0,
    status: "error",
    protocol: "independent",
    assigned_config: {
      model: "mock-model",
      persona: "mock-persona",
      protocol: "independent"
    },
    requested_model_slug: "mock-model",
    actual_model: null,
    error: {
      message: "simulated error",
      code: null,
      retryable: false
    }
  };

  const valid = validateTrial(trial);
  assert.equal(valid, true, formatAjvErrors("trial", validateTrial.errors).join("; "));
});
