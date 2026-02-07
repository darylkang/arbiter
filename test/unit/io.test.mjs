import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createJsonlWriter } from "../../dist/artifacts/io.js";

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
