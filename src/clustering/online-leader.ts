import { cosineSimilarity, vectorNorm } from "../core/vector-math.js";
import { encodeFloat32Base64 } from "../utils/float32-base64.js";

export type CentroidUpdateRule = "fixed_leader" | "incremental_mean";

export type GroupAssignment = {
  trial_id: number;
  group_id: number;
  similarity: number;
  is_exemplar: boolean;
  forced: boolean;
  batch_number?: number;
};

export type GroupStateSnapshot = {
  schema_version: "1.0.0";
  algorithm: "online_leader";
  params: {
    tau: number;
    centroid_update_rule: CentroidUpdateRule;
    ordering_rule: "trial_id_asc";
    group_limit: number;
  };
  groups: Array<{
    group_id: number;
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

type Group = {
  group_id: number;
  exemplar_trial_id: number;
  member_count: number;
  discovered_at_batch: number;
  centroid: number[];
  norm: number;
};

export class OnlineLeaderClustering {
  private readonly tau: number;
  private readonly centroidUpdateRule: CentroidUpdateRule;
  private readonly groupLimit: number;
  private groups: Group[] = [];
  private totalAssigned = 0;
  private totalExcluded = 0;
  private forcedAssignments = 0;

  constructor(options: {
    tau: number;
    centroidUpdateRule: CentroidUpdateRule;
    groupLimit: number;
  }) {
    this.tau = options.tau;
    this.centroidUpdateRule = options.centroidUpdateRule;
    this.groupLimit = options.groupLimit;
  }

  recordExcluded(count: number): void {
    this.totalExcluded += count;
  }

  assignEmbedding(input: {
    trial_id: number;
    vector: number[];
    batch_number: number;
  }): GroupAssignment {
    const norm = vectorNorm(input.vector);

    if (this.groups.length === 0) {
      if (this.groupLimit < 1) {
        throw new Error("Group limit must be >= 1 to assign embeddings");
      }
      const group = this.createGroup(input.trial_id, input.vector, input.batch_number, norm);
      this.totalAssigned += 1;
      return {
        trial_id: input.trial_id,
        group_id: group.group_id,
        similarity: 1,
        is_exemplar: true,
        forced: false,
        batch_number: input.batch_number
      };
    }

    let bestGroup = this.groups[0];
    let bestSimilarity = cosineSimilarity(input.vector, bestGroup.centroid, {
      normA: norm,
      normB: bestGroup.norm
    });

    for (let i = 1; i < this.groups.length; i += 1) {
      const candidate = this.groups[i];
      const similarity = cosineSimilarity(input.vector, candidate.centroid, {
        normA: norm,
        normB: candidate.norm
      });
      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestGroup = candidate;
      } else if (similarity === bestSimilarity && candidate.group_id < bestGroup.group_id) {
        bestGroup = candidate;
      }
    }

    if (bestSimilarity < this.tau) {
      if (this.groups.length < this.groupLimit) {
        const group = this.createGroup(input.trial_id, input.vector, input.batch_number, norm);
        this.totalAssigned += 1;
        return {
          trial_id: input.trial_id,
          group_id: group.group_id,
          similarity: 1,
          is_exemplar: true,
          forced: false,
          batch_number: input.batch_number
        };
      }
      this.forcedAssignments += 1;
      this.totalAssigned += 1;
      this.updateGroup(bestGroup, input.vector, norm);
      return {
        trial_id: input.trial_id,
        group_id: bestGroup.group_id,
        similarity: bestSimilarity,
        is_exemplar: false,
        forced: true,
        batch_number: input.batch_number
      };
    }

    this.totalAssigned += 1;
    this.updateGroup(bestGroup, input.vector, norm);
    return {
      trial_id: input.trial_id,
      group_id: bestGroup.group_id,
      similarity: bestSimilarity,
      is_exemplar: false,
      forced: false,
      batch_number: input.batch_number
    };
  }

  getGroupCount(): number {
    return this.groups.length;
  }

  getTotals(): { totalAssigned: number; totalExcluded: number; forcedAssignments: number } {
    return {
      totalAssigned: this.totalAssigned,
      totalExcluded: this.totalExcluded,
      forcedAssignments: this.forcedAssignments
    };
  }

  snapshot(): GroupStateSnapshot {
    return {
      schema_version: "1.0.0",
      algorithm: "online_leader",
      params: {
        tau: this.tau,
        centroid_update_rule: this.centroidUpdateRule,
        ordering_rule: "trial_id_asc",
        group_limit: this.groupLimit
      },
      groups: this.groups.map((group) => ({
        group_id: group.group_id,
        exemplar_trial_id: group.exemplar_trial_id,
        member_count: group.member_count,
        discovered_at_batch: group.discovered_at_batch,
        centroid_vector_b64: encodeFloat32Base64(group.centroid)
      })),
      totals: {
        total_assigned: this.totalAssigned,
        total_excluded: this.totalExcluded,
        forced_assignments: this.forcedAssignments
      }
    };
  }

  private createGroup(
    trialId: number,
    vector: number[],
    batchNumber: number,
    norm: number
  ): Group {
    const group: Group = {
      group_id: this.groups.length,
      exemplar_trial_id: trialId,
      member_count: 1,
      discovered_at_batch: batchNumber,
      centroid: vector.slice(),
      norm
    };
    this.groups.push(group);
    return group;
  }

  private updateGroup(group: Group, vector: number[], norm: number): void {
    group.member_count += 1;
    if (this.centroidUpdateRule === "incremental_mean") {
      const count = group.member_count;
      for (let i = 0; i < vector.length; i += 1) {
        group.centroid[i] = (group.centroid[i] * (count - 1) + vector[i]) / count;
      }
      group.norm = vectorNorm(group.centroid);
    } else {
      group.norm = group.norm || norm;
    }
  }
}
