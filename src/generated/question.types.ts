/* This file is generated. Do not edit. */

export interface ArbiterQuestion {
  schema_version?: string;
  question_id?: string;
  text: string;
  source?: string;
  created_at?: string;
  evaluation?: {
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
  };
  metadata?: {
    [k: string]: unknown;
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
