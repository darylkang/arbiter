import { OnlineLeaderClustering } from "../dist/clustering/online-leader.js";

const vectors = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
  [-1, 0, 0]
];

const clustering = new OnlineLeaderClustering({
  tau: 0.99,
  centroidUpdateRule: "fixed_leader",
  clusterLimit: 2
});

const assignments = vectors.map((vector, index) =>
  clustering.assignEmbedding({
    trial_id: index,
    vector,
    batch_number: 0
  })
);

const clusterCount = clustering.getClusterCount();
if (clusterCount !== 2) {
  throw new Error(`Expected 2 clusters, got ${clusterCount}`);
}

const forcedCount = assignments.filter((assignment) => assignment.forced).length;
if (forcedCount === 0) {
  throw new Error("Expected forced assignments after hitting cluster limit");
}

const totals = clustering.getTotals();
if (totals.forcedAssignments !== forcedCount) {
  throw new Error(
    `Forced assignment totals mismatch: expected ${forcedCount}, got ${totals.forcedAssignments}`
  );
}

console.log("Clustering cluster-limit test OK");
