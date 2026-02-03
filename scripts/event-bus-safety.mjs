import assert from "node:assert/strict";
import { EventBus } from "../dist/events/event-bus.js";

const bus = new EventBus();
let safeErrorCaptured = false;

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

console.log("event bus safety: ok");
