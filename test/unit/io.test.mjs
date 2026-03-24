import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createJsonlWriter } from "../../src/artifacts/io.ts";

test("createJsonlWriter surfaces write-stream errors on close", async () => {
  const root = mkdtempSync(join(tmpdir(), "arbiter-io-test-"));
  try {
    const missingPath = join(root, "missing", "records.jsonl");
    const writer = createJsonlWriter(missingPath);
    writer.append({ trial_id: 1 });

    await assert.rejects(writer.close(), /ENOENT|no such file or directory/i);
    assert.throws(() => writer.append({ trial_id: 2 }), /JSONL writer is closed/i);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("createJsonlWriter flushes all appended records before close resolves", async () => {
  const root = mkdtempSync(join(tmpdir(), "arbiter-io-test-"));
  try {
    const outputPath = join(root, "records.jsonl");
    const writer = createJsonlWriter(outputPath);

    for (let index = 0; index < 256; index += 1) {
      writer.append({ trial_id: index, text: "x".repeat(256) });
    }

    await writer.close();

    const lines = readFileSync(outputPath, "utf8")
      .trim()
      .split("\n");
    assert.equal(lines.length, 256);
    assert.deepEqual(JSON.parse(lines[0]), { trial_id: 0, text: "x".repeat(256) });
    assert.deepEqual(JSON.parse(lines.at(-1)), { trial_id: 255, text: "x".repeat(256) });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
