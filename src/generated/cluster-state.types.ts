/* This file is generated. Do not edit. */

export type ArbiterOnlineClusteringRecords = StateSnapshot | AssignmentRecord;

export interface StateSnapshot {
  record_type: "state_snapshot";
  run_id: string;
  updated_at: string;
  algorithm: "leader";
  threshold_tau: number;
  centroid_update_rule: "fixed_leader" | "incremental_mean";
  clusters: Cluster[];
}
export interface Cluster {
  cluster_id: string;
  size: number;
  /**
   * @minItems 1
   */
  centroid: [number, ...number[]];
}
export interface AssignmentRecord {
  record_type: "assignment";
  trial_id: number;
  cluster_id: string;
  similarity: number;
  created_new_cluster: boolean;
  algorithm?: "leader";
  threshold_tau?: number;
}
