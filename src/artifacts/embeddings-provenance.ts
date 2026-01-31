import type { ArbiterEmbeddingsProvenance } from "../generated/embeddings-provenance.types.js";

export const buildResolveOnlyProvenance = (
  dimensions?: number | null
): ArbiterEmbeddingsProvenance => ({
  schema_version: "1.0.0",
  status: "not_generated",
  reason: "resolve_only",
  intended_primary_format: "arrow_ipc_file",
  primary_format: "none",
  dtype: "float32",
  dimensions: dimensions ?? null,
  note: "resolve_only run; embeddings not computed"
});

export type EmbeddingsProvenance = ArbiterEmbeddingsProvenance;
