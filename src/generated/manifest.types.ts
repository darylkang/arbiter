/* This file is generated. Do not edit. */

export interface ArbiterRunManifest {
  schema_version: "1.0.0";
  arbiter_version: string;
  run_id: string;
  started_at: string;
  completed_at?: string;
  timestamps?: {
    started_at?: string;
    completed_at?: string;
  };
  stop_reason: "completed" | "converged" | "k_max_reached" | "user_interrupt" | "error";
  stopping_mode?: string;
  incomplete: boolean;
  k_attempted: number;
  k_eligible: number;
  k_min: number;
  k_min_count_rule: "k_eligible" | "k_attempted";
  notes?: string;
  git_sha?: string;
  model_catalog_version?: string;
  model_catalog_sha256?: string;
  prompt_manifest_sha256?: string;
  hash_algorithm?: "sha256";
  config_sha256?: string;
  plan_sha256?: string;
  k_planned?: number;
  provenance?: {
    arbiter_version?: string;
    git_sha?: string;
    config_sha256?: string;
    plan_sha256?: string;
    model_catalog_version?: string;
    model_catalog_sha256?: string;
    prompt_manifest_sha256?: string;
    hash_algorithm?: "sha256";
  };
  artifacts?: {
    entries?: {
      path: string;
      record_count?: number;
      note?: string;
    }[];
  };
}
