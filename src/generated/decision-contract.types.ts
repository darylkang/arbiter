/* This file is generated. Do not edit. */

export interface ArbiterDecisionContractPreset {
  id: string;
  schema: {
    [k: string]: unknown;
  };
  embed_text_source: "decision" | "rationale" | "raw_content";
  rationale_max_chars?: number;
  description?: string;
}
