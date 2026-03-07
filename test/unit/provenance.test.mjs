import assert from "node:assert/strict";
import test from "node:test";

import { extractActualModel, extractResponseId } from "../../src/openrouter/client.ts";

test("OpenRouter provenance helpers prefer response-body identifiers", () => {
  const body = {
    model: "openai/gpt-4o-mini-2024-07-18",
    id: "gen-test-123"
  };

  assert.equal(extractActualModel(body), body.model);
  assert.equal(extractResponseId(body), body.id);
  assert.equal(extractActualModel({}), null);
  assert.equal(extractResponseId({}), null);
});
