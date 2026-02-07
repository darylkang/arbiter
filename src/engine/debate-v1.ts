import type { ArbiterParsedOutputRecord } from "../generated/parsed-output.types.js";
import { validateDebateDecisionContract } from "../config/schema-validation.js";
import { extractFencedJson, extractUnfencedJson } from "../core/json-extraction.js";
import {
  buildParsedOutputWithContract,
  type DecisionContractConfig
} from "./contract-extraction.js";

export type DebateExtractionResult = {
  outcome: string;
  rationale?: string;
  parse_status: "success" | "fallback" | "failed";
  extraction_method: "fenced" | "unfenced" | "raw";
  embed_text_source: "decision" | "raw_content" | "rationale";
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

export const extractDebateDecision = (content: string): DebateExtractionResult => {
  const trimmed = content.trim();
  if (!trimmed) {
    return {
      outcome: "",
      parse_status: "failed",
      extraction_method: "raw",
      embed_text_source: "raw_content",
      embed_text: ""
    };
  }
  const fenced = extractFencedJson(trimmed, parseDecisionObject);
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

  const unfenced = extractUnfencedJson(trimmed, parseDecisionObject);
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
  finalContent: string,
  decisionContract?: DecisionContractConfig
): ArbiterParsedOutputRecord => {
  if (decisionContract) {
    return buildParsedOutputWithContract({
      trialId,
      content: finalContent,
      contract: decisionContract,
      parserVersion: "debate-v1"
    });
  }
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
    parser_version: "debate-v1",
    parse_error:
      extracted.parse_status === "failed"
        ? { message: "Debate output empty or unusable" }
        : undefined
  };
};

type DecisionObject = {
  decision: string;
  confidence?: "low" | "medium" | "high";
  reasoning?: string;
};
const parseDecisionObject = (value: unknown): DecisionObject | null => {
  if (!validateDebateDecisionContract(value)) {
    return null;
  }
  const decision = (value as { decision: string }).decision;
  const confidence = (value as { confidence?: "low" | "medium" | "high" }).confidence;
  const reasoning = (value as { reasoning?: string }).reasoning;
  return { decision, confidence, reasoning };
};
