export type EmbeddingsProvenanceStatus =
  | "not_generated"
  | "arrow_generated"
  | "jsonl_fallback";

export interface EmbeddingsProvenance {
  status: EmbeddingsProvenanceStatus;
  reason?: string;
  intended_primary_format: "arrow_ipc_file";
  primary_format: "arrow" | "jsonl" | "none";
  dtype: "float32";
  dimensions?: number | null;
  embedding_model?: string;
  embed_text_strategy?: string;
  normalization?: string;
  counts?: {
    total_trials: number;
    successful_embeddings: number;
    failed_embeddings: number;
    skipped_embeddings: number;
  };
  debug_jsonl_present?: boolean;
  arrow_error?: string;
  note?: string;
}

export const buildResolveOnlyProvenance = (
  dimensions?: number | null
): EmbeddingsProvenance => ({
  status: "not_generated",
  reason: "resolve_only",
  intended_primary_format: "arrow_ipc_file",
  primary_format: "none",
  dtype: "float32",
  dimensions: dimensions ?? null,
  note: "resolve_only run; embeddings not computed"
});
