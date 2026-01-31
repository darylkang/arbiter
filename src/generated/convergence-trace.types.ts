/* This file is generated. Do not edit. */

export interface ArbiterConvergenceTraceRecord {
  batch_number: number;
  k_attempted: number;
  k_eligible: number;
  novelty_rate: number;
  mean_max_sim_to_prior: number;
  cluster_count?: number;
  new_clusters_this_batch?: number;
  largest_cluster_share?: number;
  /**
   * Dense cumulative counts aligned to cluster_id; cluster_distribution[i] is count for cluster_id i.
   */
  cluster_distribution?: number[];
  /**
   * Jensen-Shannon divergence (log2) between current cumulative distribution and previous cumulative distribution; null when prior undefined.
   */
  js_divergence?: number | null;
  cluster_limit_hit?: boolean;
  forced_assignments_this_batch?: number;
  forced_assignments_cumulative?: number;
  entropy?: number;
  effective_cluster_count?: number;
  singleton_count?: number;
  recorded_at?: string;
  stop: {
    mode: "advisor" | "enforcer";
    would_stop: boolean;
    should_stop: boolean;
    stop_reason?: string;
  };
}
