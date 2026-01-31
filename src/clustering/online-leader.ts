import { encodeFloat32Base64 } from "./vector-codec.js";

export type CentroidUpdateRule = "fixed_leader" | "incremental_mean";

export type ClusterAssignment = {
  trial_id: number;
  cluster_id: number;
  similarity: number;
  is_exemplar: boolean;
  forced: boolean;
  batch_number?: number;
};

export type ClusterStateSnapshot = {
  schema_version: "1.0.0";
  algorithm: "online_leader";
  params: {
    tau: number;
    centroid_update_rule: CentroidUpdateRule;
    ordering_rule: "trial_id_asc";
    cluster_limit: number;
  };
  clusters: Array<{
    cluster_id: number;
    exemplar_trial_id: number;
    member_count: number;
    discovered_at_batch: number;
    centroid_vector_b64: string;
  }>;
  totals: {
    total_assigned: number;
    total_excluded: number;
    forced_assignments: number;
  };
};

type Cluster = {
  cluster_id: number;
  exemplar_trial_id: number;
  member_count: number;
  discovered_at_batch: number;
  centroid: number[];
  norm: number;
};

const vectorNorm = (vector: number[]): number => {
  let sum = 0;
  for (const value of vector) {
    sum += value * value;
  }
  return Math.sqrt(sum);
};

const cosineSimilarity = (vector: number[], norm: number, cluster: Cluster): number => {
  if (norm === 0 || cluster.norm === 0) {
    return 0;
  }
  let dot = 0;
  for (let i = 0; i < vector.length; i += 1) {
    dot += vector[i] * cluster.centroid[i];
  }
  return dot / (norm * cluster.norm);
};

export class OnlineLeaderClustering {
  private readonly tau: number;
  private readonly centroidUpdateRule: CentroidUpdateRule;
  private readonly clusterLimit: number;
  private clusters: Cluster[] = [];
  private totalAssigned = 0;
  private totalExcluded = 0;
  private forcedAssignments = 0;

  constructor(options: {
    tau: number;
    centroidUpdateRule: CentroidUpdateRule;
    clusterLimit: number;
  }) {
    this.tau = options.tau;
    this.centroidUpdateRule = options.centroidUpdateRule;
    this.clusterLimit = options.clusterLimit;
  }

  recordExcluded(count: number): void {
    this.totalExcluded += count;
  }

  assignEmbedding(input: {
    trial_id: number;
    vector: number[];
    batch_number: number;
  }): ClusterAssignment {
    const norm = vectorNorm(input.vector);

    if (this.clusters.length === 0) {
      if (this.clusterLimit < 1) {
        throw new Error("Cluster limit must be >= 1 to assign embeddings");
      }
      const cluster = this.createCluster(input.trial_id, input.vector, input.batch_number, norm);
      this.totalAssigned += 1;
      return {
        trial_id: input.trial_id,
        cluster_id: cluster.cluster_id,
        similarity: 1,
        is_exemplar: true,
        forced: false,
        batch_number: input.batch_number
      };
    }

    let bestCluster = this.clusters[0];
    let bestSimilarity = cosineSimilarity(input.vector, norm, bestCluster);

    for (let i = 1; i < this.clusters.length; i += 1) {
      const candidate = this.clusters[i];
      const similarity = cosineSimilarity(input.vector, norm, candidate);
      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestCluster = candidate;
      } else if (similarity === bestSimilarity && candidate.cluster_id < bestCluster.cluster_id) {
        bestCluster = candidate;
      }
    }

    if (bestSimilarity < this.tau) {
      if (this.clusters.length < this.clusterLimit) {
        const cluster = this.createCluster(input.trial_id, input.vector, input.batch_number, norm);
        this.totalAssigned += 1;
        return {
          trial_id: input.trial_id,
          cluster_id: cluster.cluster_id,
          similarity: 1,
          is_exemplar: true,
          forced: false,
          batch_number: input.batch_number
        };
      }
      this.forcedAssignments += 1;
      this.totalAssigned += 1;
      this.updateCluster(bestCluster, input.vector, norm);
      return {
        trial_id: input.trial_id,
        cluster_id: bestCluster.cluster_id,
        similarity: bestSimilarity,
        is_exemplar: false,
        forced: true,
        batch_number: input.batch_number
      };
    }

    this.totalAssigned += 1;
    this.updateCluster(bestCluster, input.vector, norm);
    return {
      trial_id: input.trial_id,
      cluster_id: bestCluster.cluster_id,
      similarity: bestSimilarity,
      is_exemplar: false,
      forced: false,
      batch_number: input.batch_number
    };
  }

  getClusterCount(): number {
    return this.clusters.length;
  }

  getTotals(): { totalAssigned: number; totalExcluded: number; forcedAssignments: number } {
    return {
      totalAssigned: this.totalAssigned,
      totalExcluded: this.totalExcluded,
      forcedAssignments: this.forcedAssignments
    };
  }

  snapshot(): ClusterStateSnapshot {
    return {
      schema_version: "1.0.0",
      algorithm: "online_leader",
      params: {
        tau: this.tau,
        centroid_update_rule: this.centroidUpdateRule,
        ordering_rule: "trial_id_asc",
        cluster_limit: this.clusterLimit
      },
      clusters: this.clusters.map((cluster) => ({
        cluster_id: cluster.cluster_id,
        exemplar_trial_id: cluster.exemplar_trial_id,
        member_count: cluster.member_count,
        discovered_at_batch: cluster.discovered_at_batch,
        centroid_vector_b64: encodeFloat32Base64(cluster.centroid)
      })),
      totals: {
        total_assigned: this.totalAssigned,
        total_excluded: this.totalExcluded,
        forced_assignments: this.forcedAssignments
      }
    };
  }

  private createCluster(
    trialId: number,
    vector: number[],
    batchNumber: number,
    norm: number
  ): Cluster {
    const cluster: Cluster = {
      cluster_id: this.clusters.length,
      exemplar_trial_id: trialId,
      member_count: 1,
      discovered_at_batch: batchNumber,
      centroid: vector.slice(),
      norm
    };
    this.clusters.push(cluster);
    return cluster;
  }

  private updateCluster(cluster: Cluster, vector: number[], norm: number): void {
    cluster.member_count += 1;
    if (this.centroidUpdateRule === "incremental_mean") {
      const count = cluster.member_count;
      for (let i = 0; i < vector.length; i += 1) {
        cluster.centroid[i] = (cluster.centroid[i] * (count - 1) + vector[i]) / count;
      }
      cluster.norm = vectorNorm(cluster.centroid);
    } else {
      cluster.norm = cluster.norm || norm;
    }
  }
}
