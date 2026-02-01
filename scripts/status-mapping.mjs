import { deriveFailureStatus } from "../dist/engine/status.js";

const assertEqual = (actual, expected, message) => {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
};

assertEqual(
  deriveFailureStatus({ timeoutExhausted: true, modelUnavailable: true }),
  "timeout_exhausted",
  "Timeout must take precedence"
);
assertEqual(
  deriveFailureStatus({ timeoutExhausted: true, modelUnavailable: false }),
  "timeout_exhausted",
  "Timeout status mapping failed"
);
assertEqual(
  deriveFailureStatus({ timeoutExhausted: false, modelUnavailable: true }),
  "model_unavailable",
  "Model unavailable status mapping failed"
);
assertEqual(
  deriveFailureStatus({ timeoutExhausted: false, modelUnavailable: false }),
  "error",
  "Default error status mapping failed"
);

console.log("Status mapping test OK");
