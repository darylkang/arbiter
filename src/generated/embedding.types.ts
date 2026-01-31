/* This file is generated. Do not edit. */

export type ArbiterDebugEmbeddingJSONLRecord =
  | {
      trial_id: number;
      embedding_status: "success";
      vector_b64: string;
      dtype: "float32";
      encoding: "float32le_base64";
      dimensions: number;
      embed_text_sha256?: string;
    }
  | {
      trial_id: number;
      embedding_status: "failed";
      vector_b64: null;
      dtype: "float32";
      encoding: "float32le_base64";
      error: string;
      dimensions?: number;
      embed_text_sha256?: string;
    }
  | {
      trial_id: number;
      embedding_status: "skipped";
      vector_b64: null;
      dtype: "float32";
      encoding: "float32le_base64";
      skip_reason: string;
      dimensions?: number;
      embed_text_sha256?: string;
    };
