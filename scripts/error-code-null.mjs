import { validateTrial, formatAjvErrors } from "../dist/config/schema-validation.js";

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

if (!validateTrial(trial)) {
  const errors = formatAjvErrors("trial", validateTrial.errors);
  throw new Error(`Expected trial with null error.code to validate. Errors: ${errors.join("; ")}`);
}

console.log("Null error.code schema test OK");
