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
      context_window: number | null;
      is_aliased: boolean | null;
      tier: "default" | "extended" | "free";
      notes?: string;
    },
    ...{
      slug: string;
      display_name: string;
      provider: string;
      context_window: number | null;
      is_aliased: boolean | null;
      tier: "default" | "extended" | "free";
      notes?: string;
    }[]
  ];
}
