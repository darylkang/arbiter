/* This file is generated. Do not edit. */

export type Seed = number | string;
export type NumberOrRange = number | NumberRange;
export type IntegerOrRange = number | IntegerRange;

export interface ArbiterResolvedConfig {
  schema_version: "1.0.0";
  run: {
    run_id: string;
    seed: Seed;
  };
  question: {
    text: string;
    question_id?: string;
    source?: string;
  };
  sampling: {
    /**
     * @minItems 1
     */
    models: [WeightedModel, ...WeightedModel[]];
    /**
     * @minItems 1
     */
    personas: [WeightedPersona, ...WeightedPersona[]];
    /**
     * @minItems 1
     */
    protocols: [WeightedProtocol, ...WeightedProtocol[]];
    instruments?: InstrumentPrompt[];
    decode?: {
      temperature?: NumberOrRange;
      top_p?: NumberOrRange;
      max_tokens?: IntegerOrRange;
      presence_penalty?: NumberOrRange;
      frequency_penalty?: NumberOrRange;
    };
  };
  execution: {
    k_max: number;
    batch_size: number;
    workers: number;
    timeout_ms?: number;
    retry_policy: {
      max_retries: number;
      backoff_ms?: number;
    };
    stop_mode: "advisor" | "enforcer";
    k_min: number;
    k_min_count_rule: "k_eligible" | "k_attempted";
  };
  measurement: {
    embedding_model: string;
    embed_text_strategy: "outcome_only" | "outcome_or_raw_assistant";
    novelty_threshold: number;
    clustering: {
      enabled: boolean;
      algorithm: "leader";
      threshold_tau: number;
      centroid_update_rule: "fixed_leader" | "incremental_mean";
    };
  };
  output: {
    runs_dir: string;
  };
}
export interface WeightedModel {
  model: string;
  weight: number;
  catalog_status?: "known" | "unknown_to_catalog";
}
export interface WeightedPersona {
  persona: string;
  weight: number;
  sha256?: string;
  text?: string;
}
export interface WeightedProtocol {
  protocol: string;
  weight: number;
  sha256?: string;
  text?: string;
}
export interface InstrumentPrompt {
  instrument: string;
  sha256?: string;
  text?: string;
}
export interface NumberRange {
  min: number;
  max: number;
}
export interface IntegerRange {
  min: number;
  max: number;
}
