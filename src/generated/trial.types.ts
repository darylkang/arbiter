/* This file is generated. Do not edit. */

export interface ArbiterTrialRecord {
  trial_id: number;
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
  };
  error?: {
    message?: string;
    code?: string;
    retryable?: boolean;
  };
  raw_assistant_text?: string;
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
