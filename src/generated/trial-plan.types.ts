/* This file is generated. Do not edit. */

export interface ArbiterTrialPlanRecord {
  trial_id: number;
  protocol: string;
  assigned_config: {
    model: string;
    persona: string;
    protocol: string;
    decode?: DecodeParams;
  };
  role_assignments?: {
    proposer: RoleAssignment;
    critic: RoleAssignment;
  };
}
export interface DecodeParams {
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
}
export interface RoleAssignment {
  model_slug: string;
  persona_id: string | null;
  decode?: DecodeParams;
}
