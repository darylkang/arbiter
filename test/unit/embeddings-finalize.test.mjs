import assert from "node:assert/strict";
import { copyFileSync, mkdtempSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

import { tableFromIPC } from "apache-arrow";

import { finalizeEmbeddingsToArrow } from "../../src/artifacts/embeddings.ts";
import { REPO_ROOT } from "../helpers/workspace.mjs";

const FIXTURE_PATH = resolve(REPO_ROOT, "test/fixtures/embeddings-fixture.jsonl");

test("finalizeEmbeddingsToArrow writes arrow output and provenance from the JSONL fixture", { concurrency: false }, async () => {
  const runRoot = mkdtempSync(join(tmpdir(), "arbiter-embeddings-test-"));
  const debugDir = resolve(runRoot, "debug");
  mkdirSync(debugDir, { recursive: true });

  try {
    const debugJsonl = resolve(debugDir, "embeddings.jsonl");
    copyFileSync(FIXTURE_PATH, debugJsonl);

    const { arrowPath, provenance } = await finalizeEmbeddingsToArrow({
      runDir: runRoot,
      dimensions: 4,
      debugJsonlPath: debugJsonl,
      provenance: {
        requestedEmbeddingModel: "openai/text-embedding-3-small",
        generationIds: ["gen-test-1", "gen-test-2"]
      }
    });

    assert.equal(typeof arrowPath, "string");
    const table = tableFromIPC(readFileSync(arrowPath));
    const batch = table.batches[0];
    const trialColumn = batch?.getChildAt(0);
    const vectorColumn = batch?.getChildAt(1);

    assert.ok(trialColumn);
    assert.ok(vectorColumn);
    assert.equal(table.numRows, 3);
    assert.deepEqual(Array.from(trialColumn.toArray()), [1, 2, 5]);

    const expectedVectors = [
      [1, 2, 3, 4],
      [1.25, 1.0, 1.75, 1.0],
      [0, 1.0, 2.0, 1.0]
    ];
    for (let row = 0; row < table.numRows; row += 1) {
      const rowVector = vectorColumn.get(row);
      for (let col = 0; col < 4; col += 1) {
        assert.ok(Math.abs(rowVector.get(col) - expectedVectors[row][col]) <= 1e-6);
      }
    }

    assert.equal(provenance.status, "arrow_generated");
    assert.deepEqual(provenance.generation_ids, ["gen-test-1", "gen-test-2"]);
  } finally {
    rmSync(runRoot, { recursive: true, force: true });
  }
});
