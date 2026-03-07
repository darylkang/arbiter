import assert from "node:assert/strict";
import test from "node:test";

import { prepareEmbedText } from "../../src/engine/embed-text.ts";

test("prepareEmbedText is deterministic and normalizes newlines before truncation", () => {
  const input = "Line1\r\nLine2   \r\n";
  const first = prepareEmbedText(input, 6);
  const second = prepareEmbedText(input, 6);

  assert.deepEqual(first, second);
  assert.equal(first.text, "Line1\n");
  assert.equal(first.text.includes("\r"), false);
  assert.equal(first.original_chars > first.final_chars, true);
  assert.equal(first.truncated, true);
  assert.equal(first.truncation_reason, "max_chars_exceeded");
});

test("prepareEmbedText reports empty normalized content cleanly", () => {
  const empty = prepareEmbedText("   \r\n", 6);

  assert.equal(empty.was_empty, true);
  assert.equal(empty.text, "");
  assert.equal(empty.truncated, false);
  assert.equal(empty.truncation_reason, null);
});
