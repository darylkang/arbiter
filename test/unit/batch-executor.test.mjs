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

test("runBatchWithWorkers returns completion-order results", async () => {
  const results = await runBatchWithWorkers({
    entries: [1, 2],
    workerCount: 2,
    shouldStop: () => ({ stop: false }),
    execute: async (entry) => {
      if (entry === 1) {
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      return entry;
    }
  });

  assert.deepEqual(results, [2, 1]);
});

test("runBatchWithWorkers propagates execution failures", async () => {
  const executed = [];
  await assert.rejects(
    runBatchWithWorkers({
      entries: [1, 2, 3],
      workerCount: 2,
      shouldStop: () => ({ stop: false }),
      execute: async (entry) => {
        executed.push(entry);
        if (entry === 1) {
          await new Promise((resolve) => setTimeout(resolve, 20));
        }
        if (entry === 2) {
          throw new Error("boom");
        }
        return entry;
      }
    }),
    /boom/
  );

  assert.deepEqual(executed, [1, 2]);
});

test("runBatchWithWorkers emits worker status transitions", async () => {
  const events = [];
  const results = await runBatchWithWorkers({
    entries: [1, 2, 3],
    workerCount: 2,
    shouldStop: () => ({ stop: false }),
    execute: async (entry) => {
      if (entry === 1) {
        await new Promise((resolve) => setTimeout(resolve, 15));
      }
      return entry;
    },
    onWorkerStatus: (event) => {
      events.push({
        workerId: event.workerId,
        status: event.status,
        entry: event.entry
      });
    }
  });

  assert.equal(results.length, 3);
  assert.equal(
    events.filter((event) => event.status === "busy").length,
    3
  );
  assert.equal(
    events.filter((event) => event.status === "idle").length,
    3
  );
  assert.ok(events.every((event) => event.workerId === 1 || event.workerId === 2));
});

test("runBatchWithWorkers rejects invalid worker counts", async () => {
  await assert.rejects(
    runBatchWithWorkers({
      entries: [1],
      workerCount: 0,
      shouldStop: () => ({ stop: false }),
      execute: async (entry) => entry
    }),
    /workerCount must be >= 1/
  );
});
