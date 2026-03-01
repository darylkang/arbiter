import { OnlineLeaderClustering } from "../dist/clustering/online-leader.js";

const vectors = [
  [1, 0, 0],
  [0.9, 0.1, 0],
  [0, 1, 0],
  [0.1, 0.9, 0],
  [0, 0, 1]
];

const runOnce = () => {
  const clustering = new OnlineLeaderClustering({
    tau: 0.8,
    centroidUpdateRule: "fixed_leader",
    groupLimit: 500
  });
  return vectors.map((vector, index) =>
    clustering.assignEmbedding({
      trial_id: index,
      vector,
      batch_number: 0
    })
  );
};

const first = runOnce();
const second = runOnce();

const serialize = (assignments) => JSON.stringify(assignments);
if (serialize(first) !== serialize(second)) {
  throw new Error("Clustering assignments are not deterministic");
}

const groupIds = first.map((assignment) => assignment.group_id);
if (!groupIds.every((id) => Number.isInteger(id) && id >= 0)) {
  throw new Error("Group IDs are not valid integers");
}

console.log("Clustering determinism test OK");
