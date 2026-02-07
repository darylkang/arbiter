import assert from "node:assert/strict";
import test from "node:test";

import {
  listModels,
  OpenRouterError
} from "../../dist/openrouter/client.js";
import { resetOpenRouterRateLimiterForTests } from "../../dist/openrouter/rate-limiter.js";

test("listModels wraps pre-aborted requests in OpenRouterError", async () => {
  resetOpenRouterRateLimiterForTests();
  const signal = AbortSignal.abort();

  await assert.rejects(
    () =>
      listModels({
        apiKey: "test-key",
        baseUrl: "https://openrouter.ai/api/v1",
        signal
      }),
    (error) => {
      assert.equal(error instanceof OpenRouterError, true);
      assert.match(error.message, /aborted/i);
      return true;
    }
  );
});

test("listModels wraps fetch failures in OpenRouterError", async () => {
  resetOpenRouterRateLimiterForTests();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new TypeError("network down");
  };

  try {
    await assert.rejects(
      () =>
        listModels({
          apiKey: "test-key",
          baseUrl: "https://openrouter.ai/api/v1"
        }),
      (error) => {
        assert.equal(error instanceof OpenRouterError, true);
        assert.match(error.message, /request failed/i);
        return true;
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
