/* This file is generated. Do not edit. */

export interface ArbiterDecisionContractManifest {
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
      description?: string;
    },
    ...{
      id: string;
      path: string;
      sha256: string;
      description?: string;
    }[]
  ];
}
