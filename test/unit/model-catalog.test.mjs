import assert from "node:assert/strict";
import test from "node:test";

import { loadCatalogModels } from "../../src/ui/wizard/resources.ts";
import { REPO_ROOT } from "../helpers/workspace.mjs";

test("loadCatalogModels reads presentation metadata from the model catalog", () => {
  const models = loadCatalogModels(REPO_ROOT);

  assert.deepEqual(
    models.slice(0, 5).map((model) => ({
      slug: model.slug,
      display: model.display,
      providerLabel: model.providerLabel,
      tier: model.tier,
      tierLabel: model.tierLabel,
      isDefault: model.isDefault
    })),
    [
      {
        slug: "openai/gpt-5.4",
        display: "GPT-5.4",
        providerLabel: "OpenAI",
        tier: "flagship",
        tierLabel: "Flagship",
        isDefault: false
      },
      {
        slug: "anthropic/claude-opus-4.6",
        display: "Claude Opus 4.6",
        providerLabel: "Anthropic",
        tier: "flagship",
        tierLabel: "Flagship",
        isDefault: false
      },
      {
        slug: "google/gemini-2.5-pro",
        display: "Gemini 2.5 Pro",
        providerLabel: "Google",
        tier: "flagship",
        tierLabel: "Flagship",
        isDefault: false
      },
      {
        slug: "x-ai/grok-4",
        display: "Grok 4",
        providerLabel: "xAI",
        tier: "flagship",
        tierLabel: "Flagship",
        isDefault: false
      },
      {
        slug: "openai/gpt-5.4-mini",
        display: "GPT-5.4 Mini",
        providerLabel: "OpenAI",
        tier: "mid",
        tierLabel: "Mid",
        isDefault: true
      }
    ]
  );

  assert.deepEqual(
    models.filter((model) => model.isDefault).map((model) => model.slug),
    ["openai/gpt-5.4-mini"]
  );

  assert.equal(
    models.find((model) => model.slug === "openai/gpt-5.4-mini")?.openrouter.canonicalSlug,
    "openai/gpt-5.4-mini-20260317"
  );
  assert.equal(
    models.find((model) => model.slug === "deepseek/deepseek-v3.2")?.researchNote,
    "Useful for text-first DeepSeek coverage in mainstream cross-provider studies."
  );
  assert.deepEqual(
    models.map((model) => model.isAliased),
    models.map((model) => model.slug.replace(/:free$/, "") !== model.openrouter.canonicalSlug)
  );
  const tierOrder = ["flagship", "mid", "budget", "free"];
  const providerOrder = ["openai", "anthropic", "google", "x-ai", "meta-llama", "deepseek", "qwen", "mistralai", "minimax", "moonshotai"];
  const tierRank = new Map(tierOrder.map((tier, index) => [tier, index]));
  const providerRank = new Map(providerOrder.map((provider, index) => [provider, index]));
  const orderingSignature = models.map((model) => `${model.tier}:${model.provider}:${model.sortOrder}`);
  const expectedSignature = [...models]
    .sort((left, right) => {
      const tierDelta =
        (tierRank.get(left.tier) ?? Number.MAX_SAFE_INTEGER) - (tierRank.get(right.tier) ?? Number.MAX_SAFE_INTEGER);
      if (tierDelta !== 0) {
        return tierDelta;
      }
      const providerDelta =
        (providerRank.get(left.provider) ?? Number.MAX_SAFE_INTEGER) -
        (providerRank.get(right.provider) ?? Number.MAX_SAFE_INTEGER);
      if (providerDelta !== 0) {
        return providerDelta;
      }
      return left.sortOrder - right.sortOrder;
    })
    .map((model) => `${model.tier}:${model.provider}:${model.sortOrder}`);
  assert.deepEqual(orderingSignature, expectedSignature);
});
