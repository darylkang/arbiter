/* This file is generated. Do not edit. */

export interface ArbiterPromptManifest {
  schema_version: "1.0.0";
  hash_algorithm: "sha256";
  /**
   * @minItems 1
   */
  entries: [
    {
      id: string;
      type: "participant_persona" | "participant_protocol_template" | "instrument_prompt";
      path: string;
      sha256: string;
      description?: string;
    },
    ...{
      id: string;
      type: "participant_persona" | "participant_protocol_template" | "instrument_prompt";
      path: string;
      sha256: string;
      description?: string;
    }[]
  ];
}
