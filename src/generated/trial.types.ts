/* This file is generated. Do not edit. */

export interface ArbiterTrialRecord {
  trial_id: number;
  requested_model_slug: string;
  actual_model: string | null;
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
  raw_assistant_text?: string;
  request_payload?: {
    [k: string]: unknown;
  };
  response_payload?: {
    [k: string]: unknown;
  };
  metadata?: {
    [k: string]: unknown;
  };
}
export interface DecodeParams {
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
}
