import assert from "node:assert/strict";
import { EventBus } from "../dist/events/event-bus.js";

const bus = new EventBus();
let safeErrorCaptured = false;
const firstEnvelope = bus.emit({ type: "run.started", payload: { run_id: "seed-sequence" } });
assert.equal(firstEnvelope.sequence, 0, "Expected first envelope sequence to start at 0");
assert.equal(firstEnvelope.version, 1, "Expected event envelope version 1");
assert.equal(typeof firstEnvelope.emitted_at, "string", "Expected emitted_at to be a string");

bus.subscribeSafe(
  "run.started",
  () => {
    throw new Error("boom");
  },
  () => {
    safeErrorCaptured = true;
  }
);

bus.emit({ type: "run.started", payload: { run_id: "test" } });
assert.equal(safeErrorCaptured, true, "Expected safe handler error to be captured");

const strictBus = new EventBus();
strictBus.subscribe("run.started", () => {
  throw new Error("strict boom");
});
let threw = false;
try {
  strictBus.emit({ type: "run.started", payload: { run_id: "strict" } });
} catch {
  threw = true;
}
assert.equal(threw, true, "Expected strict handler error to bubble");

const envelopeBus = new EventBus();
let envelopeSeen = false;
envelopeBus.subscribeEnvelope("run.started", (event) => {
  envelopeSeen = true;
  assert.equal(event.type, "run.started");
  assert.equal(event.version, 1);
  assert.equal(event.sequence, 0);
  assert.equal(event.payload.run_id, "envelope");
});
envelopeBus.emit({ type: "run.started", payload: { run_id: "envelope" } });
assert.equal(envelopeSeen, true, "Expected envelope handler to receive event envelope");

const asyncBus = new EventBus();
let asyncCompleted = false;
asyncBus.subscribe("run.started", async () => {
  await Promise.resolve();
  asyncCompleted = true;
});
asyncBus.emit({ type: "run.started", payload: { run_id: "async" } });
await asyncBus.flush();
assert.equal(asyncCompleted, true, "Expected async handler to complete after flush");

const asyncFailBus = new EventBus();
asyncFailBus.subscribe("run.started", async () => {
  throw new Error("async boom");
});
asyncFailBus.emit({ type: "run.started", payload: { run_id: "async-fail" } });
let asyncFailed = false;
try {
  await asyncFailBus.flush();
} catch {
  asyncFailed = true;
}
assert.equal(asyncFailed, true, "Expected async strict handler error to surface on flush");

const safeAsyncBus = new EventBus();
let safeAsyncErrorCaptured = false;
safeAsyncBus.subscribeSafe(
  "run.started",
  async () => {
    throw new Error("safe async boom");
  },
  () => {
    safeAsyncErrorCaptured = true;
  }
);
safeAsyncBus.emit({ type: "run.started", payload: { run_id: "safe-async" } });
await safeAsyncBus.flush();
assert.equal(safeAsyncErrorCaptured, true, "Expected safe async handler error to be captured");

console.log("event bus safety: ok");
