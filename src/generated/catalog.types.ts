/* This file is generated. Do not edit. */

export interface ArbiterModelCatalog {
  schema_version: "1.0.0";
  catalog_version: string;
  catalog_stage: "dev" | "curated" | "research";
  metadata_complete: boolean;
  hash_algorithm?: "sha256";
  model_catalog_sha256?: string;
  unknown_model_slugs?: string[];
  /**
   * @minItems 1
   */
  models: [
    {
      slug: string;
      display_name: string;
      provider: string;
      is_aliased: boolean;
      tier: "budget" | "mid" | "flagship" | "free";
      summary_line: string;
      research_note: string;
      default: boolean;
      sort_order: number;
      notes?: string;
      openrouter: {
        canonical_slug: string;
        created: number | null;
        description: string | null;
        context_length: number | null;
        pricing: {
          prompt: string;
          completion: string;
          input_cache_read?: string;
          input_cache_write?: string;
          web_search?: string;
          audio?: string;
          image?: string;
          internal_reasoning?: string;
          request?: string;
        };
        top_provider: {
          context_length: number | null;
          max_completion_tokens: number | null;
          is_moderated: boolean | null;
        };
        architecture: {
          modality: string | null;
          input_modalities: string[];
          output_modalities: string[];
          tokenizer: string | null;
          instruct_type: string | null;
        };
        expiration_date: number | null | string;
      };
    },
    ...{
      slug: string;
      display_name: string;
      provider: string;
      is_aliased: boolean;
      tier: "budget" | "mid" | "flagship" | "free";
      summary_line: string;
      research_note: string;
      default: boolean;
      sort_order: number;
      notes?: string;
      openrouter: {
        canonical_slug: string;
        created: number | null;
        description: string | null;
        context_length: number | null;
        pricing: {
          prompt: string;
          completion: string;
          input_cache_read?: string;
          input_cache_write?: string;
          web_search?: string;
          audio?: string;
          image?: string;
          internal_reasoning?: string;
          request?: string;
        };
        top_provider: {
          context_length: number | null;
          max_completion_tokens: number | null;
          is_moderated: boolean | null;
        };
        architecture: {
          modality: string | null;
          input_modalities: string[];
          output_modalities: string[];
          tokenizer: string | null;
          instruct_type: string | null;
        };
        expiration_date: number | null | string;
      };
    }[]
  ];
}
