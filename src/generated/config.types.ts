/* This file is generated. Do not edit. */

export type ArbiterResolvedConfig = {
  [k: string]: unknown;
} & {
  _readme?: string;
  template_id?: string;
  display_name?: string;
  description?: string;
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
  protocol: {
    type: "independent" | "debate_v1";
    timeouts: {
      per_call_timeout_ms: number;
      per_call_max_retries: number;
      total_trial_timeout_ms: number;
    };
    decision_contract?: {
      id: string;
      sha256: string;
      schema: {
        [k: string]: unknown;
      };
      embed_text_source: "decision" | "rationale" | "raw_content";
      rationale_max_chars?: number;
    };
    prompts?: {
      proposer_system: EmbeddedPrompt;
      critic_system: EmbeddedPrompt;
      proposer_final_system: EmbeddedPrompt;
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
    stop_policy?: {
      novelty_epsilon: number;
      similarity_threshold: number;
      patience: number;
    };
    stop_mode: "advisor" | "enforcer";
    k_min: number;
    k_min_count_rule: "k_eligible" | "k_attempted";
  };
  measurement: {
    embedding_model: string;
    embedding_max_chars?: number;
    embed_text_strategy: "outcome_only" | "outcome_or_raw_assistant";
    novelty_threshold: number;
    clustering: {
      enabled: boolean;
      algorithm: "online_leader";
      tau: number;
      centroid_update_rule: "fixed_leader" | "incremental_mean";
      cluster_limit: number;
      stop_mode: "disabled" | "advisory" | "enforced";
    };
  };
  output: {
    runs_dir: string;
  };
};
export type Seed = number | string;
export type NumberOrRange = number | NumberRange;
export type IntegerOrRange = number | IntegerRange;

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
export interface EmbeddedPrompt {
  id: string;
  sha256: string;
  text: string;
}
