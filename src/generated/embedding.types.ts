/* This file is generated. Do not edit. */

export type ArbiterEmbeddingRecord = {
  [k: string]: unknown;
} & {
  trial_id: number;
  embedding_status: "success" | "failed" | "skipped";
  embedding_model: string;
  /**
   * @minItems 1
   */
  embedding?: [number, ...number[]];
  dimensions?: number;
  embed_text?: string;
  skip_reason?: "empty_embed_text" | "other";
  error?: {
    message?: string;
    code?: string;
    retryable?: boolean;
  };
  truncation?: {
    applied: boolean;
    original_length: number;
    final_length: number;
    unit: "chars" | "tokens";
  };
};
