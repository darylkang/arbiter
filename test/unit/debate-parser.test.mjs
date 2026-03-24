import assert from "node:assert/strict";
import test from "node:test";

import { buildDebateParsedOutput, extractDebateDecision } from "../../src/protocols/debate/parser.ts";

test("extractDebateDecision parses fenced structured output", () => {
  const parsed = extractDebateDecision(
    '```json\n{"decision":"A","confidence":"high","reasoning":"Because."}\n```'
  );

  assert.equal(parsed.parse_status, "success");
  assert.equal(parsed.extraction_method, "fenced");
  assert.equal(parsed.outcome, "A");
  assert.equal(parsed.embed_text_source, "decision");
  assert.equal(parsed.embed_text, "A");
  assert.equal(parsed.rationale, "Because.");
});

test("buildDebateParsedOutput treats empty content as failed", () => {
  const parsed = buildDebateParsedOutput(1, "   ");

  assert.equal(parsed.parse_status, "failed");
  assert.equal(parsed.embed_text, "");
  assert.equal(parsed.parse_error?.message, "Debate output empty or unusable");
});

test("buildDebateParsedOutput falls back to raw content when structure is unusable", () => {
  const raw = "Not JSON but still content.";
  const parsed = buildDebateParsedOutput(2, raw);

  assert.equal(parsed.parse_status, "fallback");
  assert.equal(parsed.extraction_method, "raw");
  assert.equal(parsed.embed_text_source, "raw_content");
  assert.equal(parsed.embed_text, raw);
});
