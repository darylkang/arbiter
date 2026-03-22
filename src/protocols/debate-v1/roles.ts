export type DebateRoleKind = "lead" | "challenger" | "counter" | "auditor";
export type DebateConditionId = "D1" | "D2" | "D3" | "D4";

export const DEBATE_RESPONDER_ROLE_CYCLE: DebateRoleKind[] = ["challenger", "counter", "auditor"];

export const resolveDebateSlotId = (index: number): string => {
  if (index < 26) {
    return String.fromCharCode(65 + index);
  }
  return `P${index + 1}`;
};

const slotIndexFromId = (slotId: string): number => {
  if (slotId === "A") {
    return 0;
  }
  if (/^[A-Z]$/.test(slotId)) {
    return slotId.charCodeAt(0) - 65;
  }
  const match = /^P(\d+)$/.exec(slotId);
  if (match) {
    return Number(match[1]) - 1;
  }
  throw new Error(`Unsupported debate slot id: ${slotId}`);
};

export const resolveDebateRoleKind = (slotId: string): DebateRoleKind => {
  const index = slotIndexFromId(slotId);
  if (index <= 0) {
    return "lead";
  }
  return DEBATE_RESPONDER_ROLE_CYCLE[(index - 1) % DEBATE_RESPONDER_ROLE_CYCLE.length] ?? "challenger";
};

export const debateRolePromptKey = (
  roleKind: DebateRoleKind,
  isFinal: boolean
):
  | "lead_system"
  | "challenger_system"
  | "counter_system"
  | "auditor_system"
  | "lead_final_system" => {
  if (roleKind === "lead") {
    return isFinal ? "lead_final_system" : "lead_system";
  }
  if (roleKind === "challenger") {
    return "challenger_system";
  }
  if (roleKind === "counter") {
    return "counter_system";
  }
  return "auditor_system";
};

export const debateTurnInstructionPromptKey = (
  roleKind: DebateRoleKind,
  isFinal: boolean
):
  | "lead_turn"
  | "challenger_turn"
  | "counter_turn"
  | "auditor_turn"
  | "lead_final_turn" => {
  if (roleKind === "lead") {
    return isFinal ? "lead_final_turn" : "lead_turn";
  }
  if (roleKind === "challenger") {
    return "challenger_turn";
  }
  if (roleKind === "counter") {
    return "counter_turn";
  }
  return "auditor_turn";
};

export const resolveDebateCondition = (
  participants: number,
  rounds: number
): DebateConditionId | null => {
  if (participants === 2 && rounds === 1) {
    return "D1";
  }
  if (participants === 3 && rounds === 1) {
    return "D2";
  }
  if (participants === 2 && rounds === 2) {
    return "D3";
  }
  if (participants === 4 && rounds === 1) {
    return "D4";
  }
  return null;
};

export const debateRoleReviewSummary = (participants: number): string =>
  Array.from({ length: participants }, (_, index) => {
    const slotId = resolveDebateSlotId(index);
    const roleKind = resolveDebateRoleKind(slotId);
    return `${slotId} ${roleKind}`;
  }).join(" · ");
