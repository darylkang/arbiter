/* This file is generated. Do not edit. */

export interface ArbiterParsedOutputRecord {
  trial_id: number;
  parse_status: "success" | "failed" | "fallback";
  extraction_method?: "fenced" | "unfenced" | "raw";
  embed_text_source?: "decision" | "rationale" | "raw_content";
  confidence?: ("low" | "medium" | "high") | number | null;
  outcome?: string;
  rationale?: string;
  rationale_truncated?: boolean;
  trace_summary?: string;
  raw_assistant_text?: string;
  embed_text?: string;
  parser_version?: string;
  parse_error?: {
    message?: string;
    code?: string;
  };
}
