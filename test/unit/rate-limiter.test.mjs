import assert from "node:assert/strict";
import test from "node:test";

import {
  TokenBucketRateLimiter,
  resolveOpenRouterRateLimit,
  resetOpenRouterRateLimiterForTests,
  waitForOpenRouterToken
} from "../../dist/openrouter/rate-limiter.js";

test("resolveOpenRouterRateLimit uses defaults and disable semantics", () => {
  assert.equal(resolveOpenRouterRateLimit(undefined), 10);
  assert.equal(resolveOpenRouterRateLimit(""), 10);
  assert.equal(resolveOpenRouterRateLimit("abc"), 10);
  assert.equal(resolveOpenRouterRateLimit("25"), 25);
  assert.equal(resolveOpenRouterRateLimit("0"), null);
  assert.equal(resolveOpenRouterRateLimit("-5"), null);
});

test("TokenBucketRateLimiter enforces pacing when burst is exhausted", async () => {
  const limiter = new TokenBucketRateLimiter(20, 1);

  await limiter.take();
  const started = Date.now();
  await limiter.take();
  const elapsedMs = Date.now() - started;

  assert.equal(elapsedMs >= 35, true);
});

test("waitForOpenRouterToken supports disabled limiter via env", async () => {
  const previous = process.env.OPENROUTER_RATE_LIMIT;
  process.env.OPENROUTER_RATE_LIMIT = "0";
  resetOpenRouterRateLimiterForTests();

  try {
    const started = Date.now();
    await waitForOpenRouterToken();
    await waitForOpenRouterToken();
    const elapsedMs = Date.now() - started;
    assert.equal(elapsedMs < 25, true);
  } finally {
    if (previous === undefined) {
      delete process.env.OPENROUTER_RATE_LIMIT;
    } else {
      process.env.OPENROUTER_RATE_LIMIT = previous;
    }
    resetOpenRouterRateLimiterForTests();
  }
});
