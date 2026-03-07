/* This file is generated. Do not edit. */

export interface ArbiterDecisionContractPreset {
  id: string;
  schema: {
    [k: string]: unknown;
  };
  label_space: FiniteLabelSpace;
  embed_text_source: "decision" | "rationale" | "raw_content";
  rationale_max_chars?: number;
  description?: string;
}
export interface FiniteLabelSpace {
  type: "finite";
  /**
   * @minItems 1
   */
  labels: [string, ...string[]];
  description?: string;
}
