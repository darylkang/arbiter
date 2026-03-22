export type DebateRoleKind = "lead" | "challenger" | "counter" | "auditor";

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

export const debateRoleTurnInstruction = (roleKind: DebateRoleKind, isFinal: boolean): string => {
  if (roleKind === "lead") {
    return isFinal
      ? "Synthesize the debate into the final answer."
      : "Advance the current best answer while engaging prior objections and counters.";
  }
  if (roleKind === "challenger") {
    return "Apply the strongest objection or failure-mode pressure to the current lead answer.";
  }
  if (roleKind === "counter") {
    return "Present the strongest competing answer that differs from the current lead position.";
  }
  return "Surface the most important unstated assumption and explain what changes if it fails.";
};

export const debateRoleReviewSummary = (participants: number): string =>
  Array.from({ length: participants }, (_, index) => {
    const slotId = resolveDebateSlotId(index);
    const roleKind = resolveDebateRoleKind(slotId);
    return `${slotId} ${roleKind}`;
  }).join(" · ");
