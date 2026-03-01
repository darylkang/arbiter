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
    [k: string]: RoleAssignment;
  };
  debate?: {
    participants: number;
    rounds: number;
  };
}
export interface DecodeParams {
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
}
/**
 * This interface was referenced by `undefined`'s JSON-Schema definition
 * via the `patternProperty` "^[A-Z][A-Z0-9_]*$".
 */
export interface RoleAssignment {
  model_slug: string;
  persona_id: string | null;
  decode?: DecodeParams;
}
