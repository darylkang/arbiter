/* This file is generated. Do not edit. */

export interface ArbiterInstanceAnalysisRecord {
  schema_version: "1.0.0";
  run_id?: string;
  question_id: string;
  rung?: "H0" | "H1" | "H2" | "H3" | "H4";
  estimand_path: "labeled" | "semantic";
  outcome_source?: "task_label" | "decision_contract" | "semantic_grouping";
  trial_count: number;
  /**
   * @minItems 1
   */
  outcome_distribution: [
    {
      outcome: string;
      display_label?: string;
      count: number;
      mass: number;
      rank: number;
    },
    ...{
      outcome: string;
      display_label?: string;
      count: number;
      mass: number;
      rank: number;
    }[]
  ];
  primary_signals: {
    top_choice_mass: number;
    top_two_margin: number | null;
    entropy?: number | null;
  };
  estimation_uncertainty: {
    method: "wilson" | "bootstrap_percentile" | "bootstrap_bca" | "other";
    confidence_level?: number;
    bootstrap_replicates?: number;
    resampling_unit: "trial";
    intervals: {
      top_choice_mass?: Interval;
      top_two_margin?: Interval;
      entropy?: Interval;
    };
  };
  reference_evaluation?: {
    ground_truth_label?: string;
    top_choice_label?: string;
    top_choice_correct?: boolean;
  };
  budget_snapshot?: {
    model_calls?: number;
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    cost?: number;
  };
}
export interface Interval {
  lower: number;
  upper: number;
}
