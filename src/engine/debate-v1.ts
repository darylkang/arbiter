import type { ArbiterParsedOutputRecord } from "../generated/parsed-output.types.js";
import { validateDebateDecisionContract } from "../config/schema-validation.js";

export type DebateExtractionResult = {
  outcome: string;
  rationale?: string;
  parse_status: "success" | "fallback";
  extraction_method: "fenced" | "unfenced" | "raw";
  embed_text_source: "decision" | "raw_content";
  embed_text: string;
  confidence?: "low" | "medium" | "high" | null;
};

export const composeSystemPrompt = (systemPrompt: string, personaPrompt?: string | null): string =>
  personaPrompt && personaPrompt.trim().length > 0
    ? `${personaPrompt}\n\n---\n\n${systemPrompt}`
    : systemPrompt;

export const buildDebateMessages = (input: {
  turn: 0 | 1 | 2;
  question: string;
  systemPrompt: string;
  personaPrompt?: string | null;
  proposerTurn?: string;
  criticTurn?: string;
}): Array<{ role: "system" | "user" | "assistant"; content: string }> => {
  const system = composeSystemPrompt(input.systemPrompt, input.personaPrompt);
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

export const extractDebateDecision = (content: string): DebateExtractionResult => {
  const trimmed = content.trim();
  const fenced = extractFencedJson(trimmed);
  if (fenced) {
    return {
      outcome: fenced.decision,
      rationale: fenced.reasoning,
      parse_status: "success",
      extraction_method: "fenced",
      embed_text_source: "decision",
      embed_text: fenced.decision,
      confidence: fenced.confidence ?? null
    };
  }

  const unfenced = extractUnfencedJson(trimmed);
  if (unfenced) {
    return {
      outcome: unfenced.decision,
      rationale: unfenced.reasoning,
      parse_status: "success",
      extraction_method: "unfenced",
      embed_text_source: "decision",
      embed_text: unfenced.decision,
      confidence: unfenced.confidence ?? null
    };
  }

  return {
    outcome: trimmed,
    parse_status: "fallback",
    extraction_method: "raw",
    embed_text_source: "raw_content",
    embed_text: trimmed
  };
};

export const buildDebateParsedOutput = (
  trialId: number,
  finalContent: string
): ArbiterParsedOutputRecord => {
  const extracted = extractDebateDecision(finalContent);
  return {
    trial_id: trialId,
    parse_status: extracted.parse_status,
    extraction_method: extracted.extraction_method,
    embed_text_source: extracted.embed_text_source,
    confidence: extracted.confidence ?? null,
    outcome: extracted.outcome,
    rationale: extracted.rationale,
    raw_assistant_text: finalContent,
    embed_text: extracted.embed_text,
    parser_version: "debate-v1"
  };
};

type DecisionObject = {
  decision: string;
  confidence?: "low" | "medium" | "high";
  reasoning?: string;
};

const extractFencedJson = (content: string): DecisionObject | null => {
  const regex = /```(?:json)?\s*([\s\S]*?)```/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content))) {
    const candidate = match[1]?.trim();
    if (!candidate) {
      continue;
    }
    const parsed = parseDecisionObject(candidate);
    if (parsed) {
      return parsed;
    }
  }
  return null;
};

const extractUnfencedJson = (content: string): DecisionObject | null => {
  for (let i = 0; i < content.length; i += 1) {
    if (content[i] !== "{") {
      continue;
    }
    let depth = 0;
    for (let j = i; j < content.length; j += 1) {
      const char = content[j];
      if (char === "{") depth += 1;
      if (char === "}") depth -= 1;
      if (depth === 0) {
        const candidate = content.slice(i, j + 1);
        const parsed = parseDecisionObject(candidate);
        if (parsed) {
          return parsed;
        }
        break;
      }
    }
  }
  return null;
};

const parseDecisionObject = (json: string): DecisionObject | null => {
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!validateDebateDecisionContract(parsed)) {
      return null;
    }
    const decision = (parsed as { decision: string }).decision;
    const confidence = (parsed as { confidence?: "low" | "medium" | "high" }).confidence;
    const reasoning = (parsed as { reasoning?: string }).reasoning;
    return { decision, confidence, reasoning };
  } catch {
    return null;
  }
};
