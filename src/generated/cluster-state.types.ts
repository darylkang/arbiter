/* This file is generated. Do not edit. */

export interface ArbiterOnlineClusteringState {
  schema_version: "1.0.0";
  algorithm: "online_leader";
  params: {
    tau: number;
    centroid_update_rule: "fixed_leader" | "incremental_mean";
    ordering_rule: "trial_id_asc";
    cluster_limit: number;
  };
  clusters: {
    cluster_id: number;
    exemplar_trial_id: number;
    member_count: number;
    discovered_at_batch: number;
    centroid_vector_b64?: string;
  }[];
  totals: {
    total_assigned: number;
    total_excluded: number;
    forced_assignments: number;
  };
}
