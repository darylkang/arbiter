import assert from "node:assert/strict";
import test from "node:test";

import { cosineSimilarity, vectorNorm } from "../../dist/core/vector-math.js";

test("vectorNorm computes Euclidean norm", () => {
  assert.equal(vectorNorm([3, 4]), 5);
});

test("cosineSimilarity returns 1 for identical vectors", () => {
  assert.equal(cosineSimilarity([1, 2, 3], [1, 2, 3]), 1);
});

test("cosineSimilarity returns 0 for orthogonal vectors", () => {
  assert.equal(cosineSimilarity([1, 0], [0, 1]), 0);
});

test("cosineSimilarity supports precomputed norms", () => {
  const result = cosineSimilarity([1, 1], [1, 1], {
    normA: Math.sqrt(2),
    normB: Math.sqrt(2)
  });
  assert.ok(Math.abs(result - 1) < 1e-12);
});
