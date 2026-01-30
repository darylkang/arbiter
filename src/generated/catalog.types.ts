/* This file is generated. Do not edit. */

export interface ArbiterModelCatalog {
  schema_version: "1.0.0";
  catalog_version: string;
  /**
   * @minItems 1
   */
  models: [
    {
      slug: string;
      display_name: string;
      provider: string;
      context_window: number;
      is_aliased: boolean;
      notes?: string;
    },
    ...{
      slug: string;
      display_name: string;
      provider: string;
      context_window: number;
      is_aliased: boolean;
      notes?: string;
    }[]
  ];
}
