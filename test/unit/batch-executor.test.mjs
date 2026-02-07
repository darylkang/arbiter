import assert from "node:assert/strict";
import test from "node:test";

import { runBatchWithWorkers } from "../../dist/engine/batch-executor.js";

test("runBatchWithWorkers executes all entries with bounded workers", async () => {
  const entries = [1, 2, 3, 4, 5];
  const results = await runBatchWithWorkers({
    entries,
    workerCount: 2,
    shouldStop: () => ({ stop: false }),
    execute: async (entry) => entry * 2
  });

  assert.deepEqual(results.slice().sort((a, b) => a - b), [2, 4, 6, 8, 10]);
});

test("runBatchWithWorkers short-circuits when stop is requested", async () => {
  const results = await runBatchWithWorkers({
    entries: [1, 2, 3],
    workerCount: 2,
    shouldStop: () => ({ stop: true }),
    execute: async (entry) => entry
  });

  assert.deepEqual(results, []);
});

test("runBatchWithWorkers propagates execution failures", async () => {
  await assert.rejects(
    runBatchWithWorkers({
      entries: [1, 2, 3],
      workerCount: 2,
      shouldStop: () => ({ stop: false }),
      execute: async (entry) => {
        if (entry === 2) {
          throw new Error("boom");
        }
        return entry;
      }
    }),
    /boom/
  );
});
