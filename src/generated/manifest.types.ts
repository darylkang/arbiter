/* This file is generated. Do not edit. */

export interface ArbiterRunManifest {
  schema_version: "1.0.0";
  arbiter_version: string;
  run_id: string;
  started_at: string;
  completed_at?: string;
  stop_reason: "completed" | "converged" | "k_max_reached" | "user_interrupt" | "error";
  incomplete: boolean;
  k_attempted: number;
  k_eligible: number;
  k_min: number;
  k_min_count_rule: "k_eligible" | "k_attempted";
  notes?: string;
}
