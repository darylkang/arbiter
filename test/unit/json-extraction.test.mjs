import assert from "node:assert/strict";
import test from "node:test";

import {
  extractFencedJson,
  extractUnfencedJson
} from "../../dist/core/json-extraction.js";

test("extractFencedJson extracts JSON from fenced block", () => {
  const value = extractFencedJson("```json\n{\"decision\":\"yes\"}\n```");
  assert.deepEqual(value, { decision: "yes" });
});

test("extractUnfencedJson extracts first valid object", () => {
  const value = extractUnfencedJson("prefix {\"decision\":\"yes\"} suffix");
  assert.deepEqual(value, { decision: "yes" });
});

test("extract helpers support parser predicates", () => {
  const parser = (value) => {
    if (!value || typeof value !== "object") {
      return null;
    }
    const decision = value.decision;
    return typeof decision === "string" ? { decision } : null;
  };

  const fenced = extractFencedJson("```json\n{\"decision\":\"yes\"}\n```", parser);
  const unfenced = extractUnfencedJson("noise {\"decision\":\"no\"}", parser);

  assert.deepEqual(fenced, { decision: "yes" });
  assert.deepEqual(unfenced, { decision: "no" });
});
