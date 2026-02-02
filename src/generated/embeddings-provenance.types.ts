/* This file is generated. Do not edit. */

export type ArbiterEmbeddingsProvenance =
  | {
      schema_version: "1.0.0";
      status: "not_generated";
      reason: string;
      primary_format: "none";
      intended_primary_format: "arrow_ipc_file";
      dtype: "float32";
      dimensions?: number | null;
      note?: string;
      requested_embedding_model?: string;
      actual_embedding_model?: string | null;
      embed_text_strategy?: string;
      normalization?: string;
    }
  | {
      schema_version: "1.0.0";
      status: "arrow_generated";
      primary_format: "arrow";
      intended_primary_format: "arrow_ipc_file";
      dtype: "float32";
      dimensions: number;
      counts: {
        total_trials: number;
        successful_embeddings: number;
        failed_embeddings: number;
        skipped_embeddings: number;
      };
      debug_jsonl_present: boolean;
      embedding_model?: string;
      embed_text_strategy?: string;
      normalization?: string;
      requested_embedding_model?: string;
      actual_embedding_model?: string | null;
      jsonl_encoding?: "float32le_base64";
    }
  | {
      schema_version: "1.0.0";
      status: "jsonl_fallback";
      primary_format: "jsonl";
      intended_primary_format: "arrow_ipc_file";
      dtype: "float32";
      dimensions: number;
      arrow_error: string;
      debug_jsonl_present: boolean;
      jsonl_encoding: "float32le_base64";
      requested_embedding_model?: string;
      actual_embedding_model?: string | null;
      embed_text_strategy?: string;
      normalization?: string;
      counts?: {
        total_trials: number;
        successful_embeddings: number;
        failed_embeddings: number;
        skipped_embeddings: number;
      };
    };
