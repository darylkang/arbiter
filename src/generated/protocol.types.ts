/* This file is generated. Do not edit. */

export interface ArbiterProtocolSpec {
  schema_version: "1.0.0";
  protocol_id: "debate_v1";
  /**
   * @minItems 4
   */
  roles: [
    "lead" | "challenger" | "counter" | "auditor",
    "lead" | "challenger" | "counter" | "auditor",
    "lead" | "challenger" | "counter" | "auditor",
    "lead" | "challenger" | "counter" | "auditor",
    ...("lead" | "challenger" | "counter" | "auditor")[]
  ];
  /**
   * @minItems 3
   * @maxItems 3
   */
  role_cycle: [
    "challenger" | "counter" | "auditor",
    "challenger" | "counter" | "auditor",
    "challenger" | "counter" | "auditor"
  ];
  finalizer_slot: "A";
  prompts: {
    lead_system: string;
    challenger_system: string;
    counter_system: string;
    auditor_system: string;
    lead_final_system: string;
  };
  outcome_extraction: {
    method: "debate_v1_decision_contract";
  };
}
