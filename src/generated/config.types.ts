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
    evaluation?: QuestionEvaluation;
    metadata?: {
      [k: string]: unknown;
    };
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
    type: "independent" | "debate";
    participants?: number;
    rounds?: number;
    roles?: ("lead" | "challenger" | "counter" | "auditor")[];
    role_cycle?: ("challenger" | "counter" | "auditor")[];
    finalizer_slot?: string;
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
      label_space: FiniteLabelSpace;
      embed_text_source: "decision" | "rationale" | "raw_content";
      rationale_max_chars?: number;
    };
    prompts?: {
      lead_system: EmbeddedPrompt;
      challenger_system: EmbeddedPrompt;
      counter_system: EmbeddedPrompt;
      auditor_system: EmbeddedPrompt;
      lead_final_system: EmbeddedPrompt;
    };
    turn_instructions?: {
      lead_turn: EmbeddedPrompt;
      challenger_turn: EmbeddedPrompt;
      counter_turn: EmbeddedPrompt;
      auditor_turn: EmbeddedPrompt;
      lead_final_turn: EmbeddedPrompt;
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
    normalization: "newline_to_lf+trim_trailing";
    embed_text_strategy: "outcome_only" | "outcome_or_raw_assistant";
    similarity_metric: "cosine";
    novelty_threshold: number;
    clustering: {
      enabled: boolean;
      algorithm: "online_leader";
      tau: number;
      centroid_update_rule: "fixed_leader" | "incremental_mean";
      ordering_rule: "trial_id_asc";
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

export interface QuestionEvaluation {
  ground_truth_label?: string;
  label_space?: FiniteLabelSpace;
  reference_answer?: string;
  dataset?: {
    dataset_id?: string;
    split?: string;
    record_id?: string;
  };
  adjudication?: {
    source?: string;
    reference_id?: string;
    verified_at?: string;
    notes?: string;
  };
}
export interface FiniteLabelSpace {
  type: "finite";
  /**
   * @minItems 1
   */
  labels: [string, ...string[]];
  description?: string;
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
export interface EmbeddedPrompt {
  id: string;
  sha256: string;
  text: string;
}
