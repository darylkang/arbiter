/* This file is generated. Do not edit. */

export interface ArbiterProtocolSpec {
  schema_version: "1.0.0";
  protocol_id: "debate_v1";
  /**
   * @minItems 2
   */
  roles: ["proposer" | "critic", "proposer" | "critic", ...("proposer" | "critic")[]];
  /**
   * @minItems 3
   * @maxItems 3
   */
  turns: [
    {
      turn: number;
      role: "proposer" | "critic";
    },
    {
      turn: number;
      role: "proposer" | "critic";
    },
    {
      turn: number;
      role: "proposer" | "critic";
    }
  ];
  prompts: {
    proposer_system: string;
    critic_system: string;
    proposer_final_system: string;
  };
  outcome_extraction: {
    method: "debate_v1_decision_contract";
  };
}
