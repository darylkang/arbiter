import type { ArbiterEmbeddingsProvenance } from "../generated/embeddings-provenance.types.js";

export const buildResolveOnlyProvenance = (
  dimensions?: number | null,
  options?: {
    requestedEmbeddingModel?: string;
    embedTextStrategy?: string;
    normalization?: string;
  }
): ArbiterEmbeddingsProvenance => ({
  schema_version: "1.0.0",
  status: "not_generated",
  reason: "resolve_only",
  intended_primary_format: "arrow_ipc_file",
  primary_format: "none",
  dtype: "float32",
  dimensions: dimensions ?? null,
  note: "resolve_only run; embeddings not computed",
  requested_embedding_model: options?.requestedEmbeddingModel,
  actual_embedding_model: null,
  embed_text_strategy: options?.embedTextStrategy,
  normalization: options?.normalization
});

export type EmbeddingsProvenance = ArbiterEmbeddingsProvenance;
