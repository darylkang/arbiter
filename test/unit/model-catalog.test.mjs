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
    "Use for Chinese-family diversity in mainstream cross-provider studies."
  );
});
