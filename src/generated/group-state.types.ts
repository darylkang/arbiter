/* This file is generated. Do not edit. */

export interface ArbiterOnlineGroupingState {
  schema_version: "1.0.0";
  algorithm: "online_leader";
  params: {
    tau: number;
    centroid_update_rule: "fixed_leader" | "incremental_mean";
    ordering_rule: "trial_id_asc";
    group_limit: number;
  };
  groups: {
    group_id: number;
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
