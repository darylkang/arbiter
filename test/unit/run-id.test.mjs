import assert from "node:assert/strict";
import test from "node:test";

import { generateRunId } from "../../dist/artifacts/run-id.js";

test("generateRunId uses deterministic suffix when provided", () => {
  const id = generateRunId(new Date("2026-02-07T00:00:00Z"), { suffix: "abc123" });
  assert.equal(id, "20260207T000000Z_abc123");
});

test("generateRunId normalizes non-hex deterministic suffix", () => {
  const id = generateRunId(new Date("2026-02-07T00:00:00Z"), { suffix: "X!" });
  assert.equal(id, "20260207T000000Z_000000");
});
