import assert from "node:assert/strict";
import test from "node:test";

import { EventBus } from "../../dist/events/event-bus.js";

test("EventBus flush aggregates async errors from unsafe subscribers", async () => {
  const bus = new EventBus();
  bus.subscribe("run.started", async () => {
    throw new Error("async unsafe failure");
  });

  bus.emit({
    type: "run.started",
    payload: {
      run_id: "run_1",
      started_at: "2026-02-08T00:00:00.000Z",
      resolved_config: { protocol: { type: "independent" } },
      debug_enabled: false
    }
  });

  await assert.rejects(
    bus.flush(),
    (error) => {
      assert.equal(error instanceof AggregateError, true);
      assert.match(error.message, /async handlers failed/i);
      return true;
    }
  );
});

test("subscribeSafe captures sync handler failures via onError without failing emit", async () => {
  const bus = new EventBus();
  const errors = [];

  bus.subscribeSafe(
    "run.started",
    () => {
      throw new Error("sync safe failure");
    },
    (error) => {
      errors.push(error);
    }
  );

  assert.doesNotThrow(() => {
    bus.emit({
      type: "run.started",
      payload: {
        run_id: "run_2",
        started_at: "2026-02-08T00:00:00.000Z",
        resolved_config: { protocol: { type: "independent" } },
        debug_enabled: false
      }
    });
  });

  await bus.flush();
  assert.equal(errors.length, 1);
  assert.match(String(errors[0]), /sync safe failure/);
});

test("subscribeSafe captures async handler failures via onError and flush stays clean", async () => {
  const bus = new EventBus();
  const errors = [];

  bus.subscribeSafe(
    "run.started",
    async () => {
      throw new Error("async safe failure");
    },
    (error) => {
      errors.push(error);
    }
  );

  bus.emit({
    type: "run.started",
    payload: {
      run_id: "run_3",
      started_at: "2026-02-08T00:00:00.000Z",
      resolved_config: { protocol: { type: "independent" } },
      debug_enabled: false
    }
  });

  await bus.flush();
  assert.equal(errors.length, 1);
  assert.match(String(errors[0]), /async safe failure/);
});

test("unsubscribe prevents further events for payload and envelope subscribers", () => {
  const bus = new EventBus();
  const payloadHits = [];
  const envelopeHits = [];

  const unsubPayload = bus.subscribe("run.started", (payload) => {
    payloadHits.push(payload.run_id);
  });
  const unsubEnvelope = bus.subscribeEnvelope("run.started", (event) => {
    envelopeHits.push(event.sequence);
  });

  bus.emit({
    type: "run.started",
    payload: {
      run_id: "run_before_unsub",
      started_at: "2026-02-08T00:00:00.000Z",
      resolved_config: { protocol: { type: "independent" } },
      debug_enabled: false
    }
  });

  unsubPayload();
  unsubEnvelope();

  bus.emit({
    type: "run.started",
    payload: {
      run_id: "run_after_unsub",
      started_at: "2026-02-08T00:00:00.000Z",
      resolved_config: { protocol: { type: "independent" } },
      debug_enabled: false
    }
  });

  assert.deepEqual(payloadHits, ["run_before_unsub"]);
  assert.deepEqual(envelopeHits, [0]);
});
