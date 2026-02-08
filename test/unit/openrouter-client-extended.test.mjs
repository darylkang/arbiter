import assert from "node:assert/strict";
import test from "node:test";

import {
  OpenRouterError,
  chatCompletion,
  embedText,
  listModels
} from "../../dist/openrouter/client.js";
import { resetOpenRouterRateLimiterForTests } from "../../dist/openrouter/rate-limiter.js";

const restoreEnv = (snapshot) => {
  for (const [key, value] of Object.entries(snapshot)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
};

const withOpenRouterEnv = async (
  fn,
  overrides = {
    OPENROUTER_API_KEY: "test-key",
    OPENROUTER_RATE_LIMIT: "0"
  }
) => {
  const keys = Object.keys(overrides);
  const snapshot = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  resetOpenRouterRateLimiterForTests();
  try {
    await fn();
  } finally {
    restoreEnv(snapshot);
    resetOpenRouterRateLimiterForTests();
  }
};

const withMockFetch = async (mockFetch, fn) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch;
  try {
    await fn();
  } finally {
    globalThis.fetch = originalFetch;
  }
};

const jsonResponse = (status, body, headers) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      ...(headers ?? {})
    }
  });

test("chatCompletion returns body model/id and normalized usage fields", async () => {
  await withOpenRouterEnv(async () => {
    let callCount = 0;
    await withMockFetch(async (url, init) => {
      callCount += 1;
      assert.equal(url, "https://openrouter.ai/api/v1/chat/completions");
      assert.equal(init?.method, "POST");
      const payload = JSON.parse(String(init?.body));
      assert.equal(payload.model, "openai/gpt-4o-mini");
      assert.deepEqual(payload.messages, [{ role: "user", content: "hello" }]);
      return jsonResponse(
        200,
        {
          id: "gen_123",
          model: "openai/gpt-4o-mini-actual",
          usage: { prompt_tokens: 3, completion_tokens: 2 }
        },
        { "x-model": "header-model" }
      );
    }, async () => {
      const result = await chatCompletion({
        model: "openai/gpt-4o-mini",
        messages: [{ role: "user", content: "hello" }]
      });

      assert.equal(callCount, 1);
      assert.equal(result.model, "openai/gpt-4o-mini-actual");
      assert.equal(result.modelHeader, "header-model");
      assert.equal(result.responseId, "gen_123");
      assert.deepEqual(result.usage, {
        prompt_tokens: 3,
        completion_tokens: 2,
        total_tokens: 5
      });
    });
  });
});

test("chatCompletion retries once on retryable 429 and then succeeds", async () => {
  await withOpenRouterEnv(async () => {
    let attempt = 0;
    await withMockFetch(async () => {
      attempt += 1;
      if (attempt === 1) {
        return jsonResponse(
          429,
          {
            error: {
              code: "rate_limit_exceeded",
              message: "slow down"
            }
          },
          { "retry-after": "0" }
        );
      }
      return jsonResponse(200, {
        id: "retry_gen",
        model: "retry-model",
        usage: {
          prompt_tokens: 1,
          completion_tokens: 1,
          total_tokens: 2
        }
      });
    }, async () => {
      const result = await chatCompletion({
        model: "openai/gpt-4o-mini",
        messages: [{ role: "user", content: "retry" }],
        options: {
          retry: {
            maxRetries: 1,
            backoffMs: 0,
            jitter: "none"
          }
        }
      });

      assert.equal(attempt, 2);
      assert.equal(result.retryCount, 1);
      assert.equal(result.model, "retry-model");
    });
  });
});

test("chatCompletion surfaces model-unavailable metadata for 404 responses", async () => {
  await withOpenRouterEnv(async () => {
    let attempt = 0;
    await withMockFetch(async () => {
      attempt += 1;
      return jsonResponse(404, {
        error: {
          code: "model_not_available",
          message: "model unavailable"
        }
      });
    }, async () => {
      await assert.rejects(
        () =>
          chatCompletion({
            model: "missing/model",
            messages: [{ role: "user", content: "hello" }],
            options: {
              retry: {
                maxRetries: 3,
                backoffMs: 0,
                jitter: "none"
              }
            }
          }),
        (error) => {
          assert.equal(error instanceof OpenRouterError, true);
          assert.equal(error.status, 404);
          assert.equal(error.modelUnavailable, true);
          assert.equal(error.retryable, false);
          return true;
        }
      );
      assert.equal(attempt, 1);
    });
  });
});

test("embedText rejects invalid embedding payloads with OpenRouterError", async () => {
  await withOpenRouterEnv(async () => {
    await withMockFetch(async () => jsonResponse(200, { data: [{ nope: true }] }), async () => {
      await assert.rejects(
        () =>
          embedText({
            model: "openai/text-embedding-3-small",
            text: "abc"
          }),
        (error) => {
          assert.equal(error instanceof OpenRouterError, true);
          assert.match(error.message, /missing or invalid vector/i);
          return true;
        }
      );
    });
  });
});

test("listModels returns headers with lower-cased keys", async () => {
  await withOpenRouterEnv(async () => {
    await withMockFetch(
      async () => jsonResponse(200, { data: [{ id: "a" }] }, { "X-Custom-Header": "value-1" }),
      async () => {
        const result = await listModels();
        assert.equal(result.headers["x-custom-header"], "value-1");
        assert.equal(Array.isArray(result.responseBody.data), true);
      }
    );
  });
});

test("chatCompletion wraps aborted requests as OpenRouterError", async () => {
  await withOpenRouterEnv(async () => {
    const signal = AbortSignal.abort();
    await assert.rejects(
      () =>
        chatCompletion({
          model: "openai/gpt-4o-mini",
          messages: [{ role: "user", content: "hello" }],
          options: { signal }
        }),
      (error) => {
        assert.equal(error instanceof OpenRouterError, true);
        assert.match(error.message, /aborted/i);
        return true;
      }
    );
  });
});

test("chatCompletion requires OPENROUTER_API_KEY when not explicitly provided", async () => {
  await withOpenRouterEnv(
    async () => {
      await assert.rejects(
        () =>
          chatCompletion({
            model: "openai/gpt-4o-mini",
            messages: [{ role: "user", content: "hello" }]
          }),
        (error) => {
          assert.equal(error instanceof OpenRouterError, true);
          assert.match(error.message, /OPENROUTER_API_KEY is required/i);
          return true;
        }
      );
    },
    {
      OPENROUTER_API_KEY: undefined,
      OPENROUTER_RATE_LIMIT: "0"
    }
  );
});
