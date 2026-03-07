import assert from "node:assert/strict";
import test from "node:test";

import { deriveFailureStatus } from "../../src/engine/status.ts";

test("deriveFailureStatus preserves precedence and fallback mapping", () => {
  assert.equal(
    deriveFailureStatus({ timeoutExhausted: true, modelUnavailable: true }),
    "timeout_exhausted"
  );
  assert.equal(
    deriveFailureStatus({ timeoutExhausted: true, modelUnavailable: false }),
    "timeout_exhausted"
  );
  assert.equal(
    deriveFailureStatus({ timeoutExhausted: false, modelUnavailable: true }),
    "model_unavailable"
  );
  assert.equal(
    deriveFailureStatus({ timeoutExhausted: false, modelUnavailable: false }),
    "error"
  );
});
