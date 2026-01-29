/* This file is generated. Do not edit. */

export interface ArbiterConvergenceTraceRecord {
  batch_number: number;
  k_attempted: number;
  k_eligible: number;
  novelty_rate: number;
  mean_max_sim_to_prior: number;
  recorded_at?: string;
  stop: {
    mode: "advisor" | "enforcer";
    would_stop: boolean;
    should_stop: boolean;
    stop_reason?: string;
  };
}
