/* This file is generated. Do not edit. */

export interface ArbiterTemplateManifest {
  schema_version: "1.0.0";
  hash_algorithm: "sha256";
  /**
   * @minItems 1
   */
  entries: [
    {
      id: string;
      path: string;
      sha256: string;
      role: "public" | "research" | "canary";
      init_default?: boolean;
      description?: string;
    },
    ...{
      id: string;
      path: string;
      sha256: string;
      role: "public" | "research" | "canary";
      init_default?: boolean;
      description?: string;
    }[]
  ];
}
