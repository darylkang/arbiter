/* This file is generated. Do not edit. */

export interface ArbiterMonitoringRecord {
  batch_number: number;
  k_attempted: number;
  k_eligible: number;
  has_eligible_in_batch: boolean;
  novelty_rate: number | null;
  mean_max_sim_to_prior: number | null;
  group_count?: number;
  new_groups_this_batch?: number;
  largest_group_share?: number;
  /**
   * Dense cumulative counts aligned to group_id; group_distribution[i] is count for group_id i.
   */
  group_distribution?: number[];
  /**
   * Jensen-Shannon divergence (log2) between current cumulative distribution and previous cumulative distribution; null when prior undefined.
   */
  js_divergence?: number | null;
  group_limit_hit?: boolean;
  forced_assignments_this_batch?: number;
  forced_assignments_cumulative?: number;
  entropy?: number;
  effective_group_count?: number;
  singleton_group_count?: number;
  recorded_at?: string;
  stop: {
    mode: "advisor" | "enforcer";
    would_stop: boolean;
    should_stop: boolean;
    stop_reason?: string;
  };
}
