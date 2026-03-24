import assert from "node:assert/strict";
import test from "node:test";

import {
  listModels,
  OpenRouterError
} from "../../src/openrouter/client.ts";
import { resetOpenRouterRateLimiterForTests } from "../../src/openrouter/rate-limiter.ts";

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

test("listModels attaches a defensive timeout signal when caller omits one", async () => {
  resetOpenRouterRateLimiterForTests();
  const originalFetch = globalThis.fetch;
  let capturedSignal;
  globalThis.fetch = async (_url, init) => {
    capturedSignal = init?.signal ?? null;
    return new Response(JSON.stringify({ data: [] }), { status: 200 });
  };

  try {
    await listModels({
      apiKey: "test-key",
      baseUrl: "https://openrouter.ai/api/v1"
    });
    assert.equal(capturedSignal instanceof AbortSignal, true);
    assert.equal(capturedSignal.aborted, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
