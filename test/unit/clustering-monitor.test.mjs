import assert from "node:assert/strict";
import test from "node:test";

import { EventBus } from "../../dist/events/event-bus.js";
import { ClusteringMonitor } from "../../dist/clustering/monitor.js";
import { encodeFloat32Base64 } from "../../dist/utils/float32-base64.js";

const makeConfig = (overrides = {}) => ({
  measurement: {
    novelty_threshold: 0.5,
    clustering: {
      enabled: true,
      stop_mode: "advisory",
      tau: 0.95,
      centroid_update_rule: "fixed_leader",
      cluster_limit: 10
    },
    ...(overrides.measurement ?? {})
  },
  execution: {
    stop_mode: "enforcer",
    stop_policy: {
      novelty_epsilon: 0.0,
      similarity_threshold: 0.9,
      patience: 1
    },
    k_min: 2,
    ...(overrides.execution ?? {})
  }
});

const emitSuccessfulEmbedding = (bus, trialId, vector) => {
  bus.emit({
    type: "embedding.recorded",
    payload: {
      embedding_record: {
        trial_id: trialId,
        embedding_status: "success",
        vector_b64: encodeFloat32Base64(vector)
      }
    }
  });
};

test("ClusteringMonitor processes batch embeddings in trial_id order", () => {
  const bus = new EventBus();
  const monitor = new ClusteringMonitor(makeConfig(), bus);
  monitor.attach();

  const assignedTrialIds = [];
  let convergenceRecord = null;
  const unsubs = [
    bus.subscribe("cluster.assigned", (payload) => assignedTrialIds.push(payload.assignment.trial_id)),
    bus.subscribe("convergence.record", (payload) => {
      convergenceRecord = payload.convergence_record;
    })
  ];

  bus.emit({ type: "trial.completed", payload: { trial_record: {} } });
  bus.emit({ type: "trial.completed", payload: { trial_record: {} } });
  emitSuccessfulEmbedding(bus, 3, [0, 1]);
  emitSuccessfulEmbedding(bus, 1, [1, 0]);

  bus.emit({
    type: "batch.completed",
    payload: { batch_number: 1, trial_ids: [3, 1], elapsed_ms: 0 }
  });

  assert.deepEqual(assignedTrialIds, [1, 3]);
  assert.ok(convergenceRecord);
  assert.equal(convergenceRecord.k_attempted, 2);
  assert.equal(convergenceRecord.k_eligible, 2);

  unsubs.forEach((unsub) => unsub());
  monitor.detach();
});

test("ClusteringMonitor stops only in enforcer mode after convergence and k_min", () => {
  const bus = new EventBus();
  const monitor = new ClusteringMonitor(makeConfig({ execution: { stop_mode: "enforcer", k_min: 2 } }), bus);
  monitor.attach();

  const records = [];
  const unsub = bus.subscribe("convergence.record", (payload) => records.push(payload.convergence_record));

  bus.emit({ type: "trial.completed", payload: { trial_record: {} } });
  emitSuccessfulEmbedding(bus, 1, [1, 0]);
  bus.emit({ type: "batch.completed", payload: { batch_number: 1, trial_ids: [1], elapsed_ms: 0 } });

  bus.emit({ type: "trial.completed", payload: { trial_record: {} } });
  emitSuccessfulEmbedding(bus, 2, [1, 0]);
  bus.emit({ type: "batch.completed", payload: { batch_number: 2, trial_ids: [2], elapsed_ms: 0 } });

  assert.equal(records.length, 2);
  assert.equal(records[0].stop.should_stop, false);
  assert.equal(records[1].stop.would_stop, true);
  assert.equal(records[1].stop.should_stop, true);
  assert.equal(monitor.getShouldStop(), true);

  unsub();
  monitor.detach();
});

test("ClusteringMonitor keeps advisory stop mode non-blocking even when converged", () => {
  const bus = new EventBus();
  const monitor = new ClusteringMonitor(makeConfig({ execution: { stop_mode: "advisor", k_min: 2 } }), bus);
  monitor.attach();

  const records = [];
  const unsub = bus.subscribe("convergence.record", (payload) => records.push(payload.convergence_record));

  bus.emit({ type: "trial.completed", payload: { trial_record: {} } });
  emitSuccessfulEmbedding(bus, 1, [1, 0]);
  bus.emit({ type: "batch.completed", payload: { batch_number: 1, trial_ids: [1], elapsed_ms: 0 } });

  bus.emit({ type: "trial.completed", payload: { trial_record: {} } });
  emitSuccessfulEmbedding(bus, 2, [1, 0]);
  bus.emit({ type: "batch.completed", payload: { batch_number: 2, trial_ids: [2], elapsed_ms: 0 } });

  assert.equal(records.length, 2);
  assert.equal(records[1].stop.would_stop, true);
  assert.equal(records[1].stop.should_stop, false);
  assert.equal(monitor.getShouldStop(), false);

  unsub();
  monitor.detach();
});

test("ClusteringMonitor emits warning when a success embedding is missing vector_b64", () => {
  const bus = new EventBus();
  const monitor = new ClusteringMonitor(makeConfig(), bus);
  monitor.attach();

  const warnings = [];
  const unsub = bus.subscribe("warning.raised", (payload) => warnings.push(payload));

  bus.emit({
    type: "embedding.recorded",
    payload: {
      embedding_record: {
        trial_id: 7,
        embedding_status: "success"
      }
    }
  });

  assert.doesNotThrow(() => {
    bus.emit({
      type: "batch.completed",
      payload: { batch_number: 1, trial_ids: [7], elapsed_ms: 0 }
    });
  });

  assert.equal(warnings.length, 1);
  assert.match(warnings[0].message, /ClusteringMonitor handler failed for batch\.completed/);
  assert.match(warnings[0].message, /Missing decoded embedding for trial 7/);
  assert.equal(warnings[0].source, "clustering");

  unsub();
  monitor.detach();
});
