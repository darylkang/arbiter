/* This file is generated. Do not edit. */

export interface ArbiterTrialRecord {
  trial_id: number;
  requested_model_slug: string;
  actual_model: string | null;
  protocol: string;
  status: "success" | "error" | "model_unavailable" | "timeout_exhausted";
  assigned_config: {
    model: string;
    persona: string;
    protocol: string;
    decode?: DecodeParams;
  };
  attempt?: {
    started_at?: string;
    completed_at?: string;
    latency_ms?: number;
    retry_count?: number;
  };
  error?: {
    message?: string;
    code?: string | null;
    retryable?: boolean;
  };
  error_code?: string | null;
  raw_assistant_text?: string;
  request_payload?: {
    [k: string]: unknown;
  };
  response_payload?: {
    [k: string]: unknown;
  };
  role_assignments?: {
    [k: string]: RoleAssignment;
  };
  calls?: CallRecord[];
  transcript?: TranscriptEntry[];
  metadata?: {
    [k: string]: unknown;
  };
  usage?: UsageStats;
  parsed?: {
    parse_status: "success" | "fallback" | "failed";
    parser_version: string;
    extraction_method?: string;
    embed_text_source?: string;
    confidence?: string | null;
    outcome?: string;
    rationale?: string;
    embed_text?: string;
    parse_error?: {
      [k: string]: unknown;
    };
  };
  embedding?: {
    status: "success" | "failed" | "skipped";
    generation_id?: string;
    skip_reason?: string;
    error?: string;
  };
  grouping?: {
    embedding_group_id?: number;
    similarity_to_exemplar?: number;
  };
}
export interface DecodeParams {
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
}
/**
 * This interface was referenced by `undefined`'s JSON-Schema definition
 * via the `patternProperty` "^[A-Z][A-Z0-9_]*$".
 */
export interface RoleAssignment {
  model_slug: string;
  persona_id: string | null;
  decode?: DecodeParams;
}
export interface CallRecord {
  call_index: number;
  turn: number;
  role: string;
  model_requested: string;
  model_actual: string | null;
  request_payload: {
    [k: string]: unknown;
  };
  response_payload: {
    [k: string]: unknown;
  } | null;
  usage?: UsageStats;
  attempt: {
    started_at: string;
    completed_at: string;
    latency_ms: number;
    retry_count: number;
  };
  error_message: string | null;
}
export interface UsageStats {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost?: number;
}
export interface TranscriptEntry {
  turn: number;
  role: string;
  content: string;
}
