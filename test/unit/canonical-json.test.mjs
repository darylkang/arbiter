import assert from "node:assert/strict";
import test from "node:test";

import { canonicalStringify } from "../../src/utils/canonical-json.ts";

test("canonicalStringify sorts object keys deterministically", () => {
  const value = { b: 2, a: 1, nested: { d: 4, c: 3 } };

  assert.equal(
    canonicalStringify(value),
    "{\"a\":1,\"b\":2,\"nested\":{\"c\":3,\"d\":4}}"
  );
});

test("canonicalStringify rejects circular structures with a clear error", () => {
  const value = { a: 1 };
  value.self = value;

  assert.throws(
    () => canonicalStringify(value),
    /circular structure/i
  );
});
