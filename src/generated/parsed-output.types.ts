/* This file is generated. Do not edit. */

export interface ArbiterParsedOutputRecord {
  trial_id: number;
  parse_status: "success" | "failed";
  outcome?: string;
  rationale?: string;
  trace_summary?: string;
  raw_assistant_text?: string;
  embed_text?: string;
  parser_version?: string;
  parse_error?: {
    message?: string;
    code?: string;
  };
}
