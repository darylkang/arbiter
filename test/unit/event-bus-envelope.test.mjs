import assert from "node:assert/strict";
import test from "node:test";

import { EventBus } from "../../dist/events/event-bus.js";

test("EventBus emits envelope metadata with monotonic sequence", () => {
  const bus = new EventBus();
  const seen = [];

  bus.subscribeEnvelope("run.started", (event) => {
    seen.push(event.sequence);
    assert.equal(event.version, 1);
    assert.equal(typeof event.emitted_at, "string");
  });

  const first = bus.emit({ type: "run.started", payload: { run_id: "r1" } });
  const second = bus.emit({ type: "run.started", payload: { run_id: "r2" } });

  assert.equal(first.sequence, 0);
  assert.equal(second.sequence, 1);
  assert.deepEqual(seen, [0, 1]);
});

test("EventBus keeps payload subscribers compatible", () => {
  const bus = new EventBus();
  const runIds = [];

  bus.subscribe("run.started", (payload) => {
    runIds.push(payload.run_id);
  });

  bus.emit({ type: "run.started", payload: { run_id: "a" } });
  bus.emit({ type: "run.started", payload: { run_id: "b" } });

  assert.deepEqual(runIds, ["a", "b"]);
});
