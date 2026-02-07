export const composeSystemPrompt = (systemPrompt: string, personaPrompt?: string | null): string =>
  personaPrompt && personaPrompt.trim().length > 0
    ? `${personaPrompt}\n\n---\n\n${systemPrompt}`
    : systemPrompt;

export const buildDebateMessages = (input: {
  turn: 0 | 1 | 2;
  question: string;
  systemPrompt: string;
  personaPrompt?: string | null;
  contractClause?: string;
  proposerTurn?: string;
  criticTurn?: string;
}): Array<{ role: "system" | "user" | "assistant"; content: string }> => {
  const rolePrompt =
    input.turn === 2 && input.contractClause
      ? `${input.systemPrompt}\n\n${input.contractClause}`
      : input.systemPrompt;
  const system = composeSystemPrompt(rolePrompt, input.personaPrompt);
  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: system },
    { role: "user", content: input.question }
  ];

  if (input.turn >= 1) {
    if (!input.proposerTurn) {
      throw new Error("Missing proposer turn content for debate turn >= 1");
    }
    messages.push({ role: "assistant", content: input.proposerTurn });
    messages.push({ role: "user", content: "Please provide your critique." });
  }

  if (input.turn >= 2) {
    if (!input.criticTurn) {
      throw new Error("Missing critic turn content for debate turn 2");
    }
    messages.push({ role: "assistant", content: input.criticTurn });
    messages.push({
      role: "user",
      content: "Please provide your final answer in the specified JSON format."
    });
  }

  return messages;
};
