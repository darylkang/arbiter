/* This file is generated. Do not edit. */

export interface ArbiterLadderComparisonSummary {
  schema_version: "1.0.0";
  benchmark_id?: string;
  estimand_path: "labeled" | "semantic";
  primary_signal: "top_choice_mass" | "top_two_margin";
  evaluation_metric: "auroc" | "selective_prediction" | "calibration";
  budget_axis: "model_calls";
  resampling_unit: "instance";
  /**
   * @minItems 1
   */
  comparisons: [
    {
      baseline_rung: "H0" | "H1" | "H2" | "H3" | "H4";
      candidate_rung: "H0" | "H1" | "H2" | "H3" | "H4";
      value: number;
      interval?: Interval;
      instance_count: number;
    },
    ...{
      baseline_rung: "H0" | "H1" | "H2" | "H3" | "H4";
      candidate_rung: "H0" | "H1" | "H2" | "H3" | "H4";
      value: number;
      interval?: Interval;
      instance_count: number;
    }[]
  ];
  budget_summary?: {
    model_calls_per_instance?: number;
    mean_total_tokens?: number;
    mean_cost?: number;
  };
  notes?: string;
}
export interface Interval {
  lower: number;
  upper: number;
}
