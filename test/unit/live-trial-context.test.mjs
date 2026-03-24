import assert from "node:assert/strict";
import test from "node:test";

import { applyEmbeddingMetadata } from "../../src/engine/live-trial-context.ts";

test("applyEmbeddingMetadata records stable embedding provenance for the first model", () => {
  const state = {
    contractFailures: { fallback: 0, failed: 0 },
    embeddingDimensions: null,
    actualEmbeddingModel: null,
    embeddingModelConflict: false,
    embeddingGenerationIds: new Set()
  };

  applyEmbeddingMetadata(state, 3, "openai/text-embedding-3-small", "gen-1");

  assert.equal(state.embeddingDimensions, 3);
  assert.equal(state.actualEmbeddingModel, "openai/text-embedding-3-small");
  assert.equal(state.embeddingModelConflict, false);
  assert.deepEqual(Array.from(state.embeddingGenerationIds), ["gen-1"]);
});

test("applyEmbeddingMetadata flags and preserves embedding model conflicts", () => {
  const state = {
    contractFailures: { fallback: 0, failed: 0 },
    embeddingDimensions: 3,
    actualEmbeddingModel: "openai/text-embedding-3-small",
    embeddingModelConflict: false,
    embeddingGenerationIds: new Set()
  };

  applyEmbeddingMetadata(state, 3, "openai/text-embedding-3-large", "gen-2");

  assert.equal(state.actualEmbeddingModel, null);
  assert.equal(state.embeddingModelConflict, true);
  assert.deepEqual(Array.from(state.embeddingGenerationIds), ["gen-2"]);
});
