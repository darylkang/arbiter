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
  cluster_distribution?: {
    /**
     * This interface was referenced by `undefined`'s JSON-Schema definition
     * via the `patternProperty` "^[0-9]+$".
     */
    [k: string]: number;
  };
  js_divergence?: number | null;
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
