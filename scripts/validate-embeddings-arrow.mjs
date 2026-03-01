import { copyFileSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { tableFromIPC } from "apache-arrow";
import { finalizeEmbeddingsToArrow } from "../dist/artifacts/embeddings.js";

const runRoot = mkdtempSync(resolve(tmpdir(), "arbiter-embeddings-test-"));
const debugDir = resolve(runRoot, "debug");
mkdirSync(debugDir, { recursive: true });

try {
  const sourceFixture = resolve("scripts/embeddings-fixture.jsonl");
  const debugJsonl = resolve(debugDir, "embeddings.jsonl");
  copyFileSync(sourceFixture, debugJsonl);

  const { arrowPath, provenance } = await finalizeEmbeddingsToArrow({
    runDir: runRoot,
    dimensions: 4,
    debugJsonlPath: debugJsonl,
    provenance: {
      requestedEmbeddingModel: "openai/text-embedding-3-small",
      generationIds: ["gen-test-1", "gen-test-2"]
    }
  });

  if (!arrowPath || !existsSync(arrowPath)) {
    throw new Error("Arrow file was not created");
  }

  const buffer = readFileSync(arrowPath);
  const table = tableFromIPC(buffer);
  const batch = table.batches[0];
  const trialColumn = batch.getChildAt(0);
  const vectorColumn = batch.getChildAt(1);

  if (!trialColumn || !vectorColumn) {
    throw new Error("Missing columns in Arrow file");
  }

  if (table.numRows !== 3) {
    throw new Error(`Expected 3 rows, got ${table.numRows}`);
  }

  const expectedTrials = [1, 2, 5];
  const actualTrials = Array.from(trialColumn.toArray());
  for (let i = 0; i < expectedTrials.length; i += 1) {
    if (actualTrials[i] !== expectedTrials[i]) {
      throw new Error(`Trial id mismatch at row ${i}`);
    }
  }

  const expectedVectors = [
    [1, 2, 3, 4],
    [1.25, 1.0, 1.75, 1.0],
    [0, 1.0, 2.0, 1.0]
  ];

  for (let row = 0; row < table.numRows; row += 1) {
    const rowVector = vectorColumn.get(row);
    for (let col = 0; col < 4; col += 1) {
      const actual = rowVector.get(col);
      const expected = expectedVectors[row][col];
      if (Math.abs(actual - expected) > 1e-6) {
        throw new Error(`Vector mismatch at row ${row} col ${col}`);
      }
    }
  }

  if (provenance.status !== "arrow_generated") {
    throw new Error(`Expected arrow_generated provenance status, got ${provenance.status}`);
  }
  if (!Array.isArray(provenance.generation_ids) || provenance.generation_ids.length !== 2) {
    throw new Error("Expected generation_ids in embeddings provenance");
  }
} finally {
  rmSync(runRoot, { recursive: true, force: true });
}

console.log("Embeddings Arrow conversion OK");
