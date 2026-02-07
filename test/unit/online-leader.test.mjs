import assert from "node:assert/strict";
import test from "node:test";

import { OnlineLeaderClustering } from "../../dist/clustering/online-leader.js";

test("OnlineLeaderClustering creates, matches, and force-assigns clusters", () => {
  const clustering = new OnlineLeaderClustering({
    tau: 0.9,
    centroidUpdateRule: "incremental_mean",
    clusterLimit: 2
  });

  const a0 = clustering.assignEmbedding({ trial_id: 0, vector: [1, 0], batch_number: 0 });
  const a1 = clustering.assignEmbedding({ trial_id: 1, vector: [0.99, 0.01], batch_number: 0 });
  const a2 = clustering.assignEmbedding({ trial_id: 2, vector: [-1, 0], batch_number: 1 });
  const a3 = clustering.assignEmbedding({ trial_id: 3, vector: [0, -1], batch_number: 1 });

  assert.equal(a0.is_exemplar, true);
  assert.equal(a1.cluster_id, a0.cluster_id);
  assert.equal(a2.is_exemplar, true);
  assert.equal(a3.forced, true);
  assert.equal(clustering.getClusterCount(), 2);

  const totals = clustering.getTotals();
  assert.equal(totals.totalAssigned, 4);
  assert.equal(totals.forcedAssignments, 1);
});

test("OnlineLeaderClustering records excluded totals", () => {
  const clustering = new OnlineLeaderClustering({
    tau: 0.8,
    centroidUpdateRule: "fixed_leader",
    clusterLimit: 2
  });

  clustering.recordExcluded(3);
  const totals = clustering.getTotals();
  assert.equal(totals.totalExcluded, 3);
});
