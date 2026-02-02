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
    code?: string;
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
    proposer: RoleAssignment;
    critic: RoleAssignment;
  };
  calls?: CallRecord[];
  transcript?: TranscriptEntry[];
  metadata?: {
    [k: string]: unknown;
  };
  usage?: UsageStats;
}
export interface DecodeParams {
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
}
export interface RoleAssignment {
  model_slug: string;
  persona_id: string | null;
  decode?: DecodeParams;
}
export interface CallRecord {
  call_index: number;
  turn: number;
  role: "proposer" | "critic";
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
  role: "proposer" | "critic";
  content: string;
}
