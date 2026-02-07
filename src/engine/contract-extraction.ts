import Ajv2020 from "ajv/dist/2020.js";
import type { Options, ValidateFunction } from "ajv";

import { extractFencedJson, extractUnfencedJson } from "../core/json-extraction.js";
import type { ArbiterParsedOutputRecord } from "../generated/parsed-output.types.js";
import { canonicalStringify } from "../utils/canonical-json.js";

export type DecisionContractConfig = {
  id: string;
  schema: Record<string, unknown>;
  embed_text_source: "decision" | "rationale" | "raw_content";
  rationale_max_chars?: number;
};

export type ContractExtractionResult = {
  parse_status: "success" | "failed" | "fallback";
  extraction_method: "fenced" | "unfenced" | "raw";
  outcome: string;
  rationale?: string;
  confidence?: "low" | "medium" | "high" | number | null;
  embed_text_source: "decision" | "rationale" | "raw_content";
  embed_text: string;
  rationale_truncated?: boolean;
};

const AjvCtor = Ajv2020 as unknown as new (opts?: Options) => {
  compile: <T>(schema: unknown) => ValidateFunction<T>;
};

const ajv = new AjvCtor({ allErrors: false, strict: true });

export const buildContractValidator = (
  schema: Record<string, unknown>
): ((data: unknown) => boolean) => ajv.compile(schema);

export const formatDecisionContractClause = (schema: Record<string, unknown>): string =>
  `Respond with ONLY a JSON object matching this schema:\n${canonicalStringify(schema)}\nNo additional text.`;

const truncateRationale = (
  value: unknown,
  maxChars?: number
): { value: unknown; truncated: boolean } => {
  if (!maxChars || maxChars <= 0 || !value || typeof value !== "object") {
    return { value, truncated: false };
  }
  const record = value as Record<string, unknown>;
  const rationale = record.rationale;
  if (typeof rationale !== "string" || rationale.length <= maxChars) {
    return { value, truncated: false };
  }
  return {
    value: { ...record, rationale: rationale.slice(0, maxChars) },
    truncated: true
  };
};

export const extractContractOutput = (
  content: string,
  contract: DecisionContractConfig,
  validate: (data: unknown) => boolean
): ContractExtractionResult => {
  const trimmed = content.trim();
  if (!trimmed) {
    return {
      parse_status: "failed",
      extraction_method: "raw",
      outcome: "",
      embed_text_source: "raw_content",
      embed_text: ""
    };
  }
  const candidates: Array<{ method: "fenced" | "unfenced"; value: unknown | null }> = [
    { method: "fenced", value: extractFencedJson(trimmed) },
    { method: "unfenced", value: extractUnfencedJson(trimmed) }
  ];

  for (const candidate of candidates) {
    if (!candidate.value) {
      continue;
    }
    const { value, truncated } = truncateRationale(
      candidate.value,
      contract.rationale_max_chars
    );
    if (!validate(value)) {
      continue;
    }
    const record = value as Record<string, unknown>;
    const decision =
      typeof record.decision === "string" ? record.decision : "";
    if (!decision) {
      break;
    }
    const rationale =
      typeof record.rationale === "string" ? record.rationale : undefined;
    const confidenceValue = record.confidence;
    const confidence =
      typeof confidenceValue === "number"
        ? confidenceValue
        : typeof confidenceValue === "string" &&
          ["low", "medium", "high"].includes(confidenceValue)
          ? (confidenceValue as "low" | "medium" | "high")
          : null;

    let embedTextSource = contract.embed_text_source;
    let embedText = "";
    if (embedTextSource === "rationale" && rationale) {
      embedText = rationale;
    } else if (embedTextSource === "decision" && decision) {
      embedText = decision;
    } else if (embedTextSource === "raw_content") {
      embedText = trimmed;
    } else if (decision) {
      embedTextSource = "decision";
      embedText = decision;
    } else if (rationale) {
      embedTextSource = "rationale";
      embedText = rationale;
    } else {
      embedTextSource = "raw_content";
      embedText = trimmed;
    }

    return {
      parse_status: "success",
      extraction_method: candidate.method,
      outcome: decision,
      rationale,
      confidence,
      embed_text_source: embedTextSource,
      embed_text: embedText,
      rationale_truncated: truncated
    };
  }

  return {
    parse_status: "fallback",
    extraction_method: "raw",
    outcome: trimmed,
    embed_text_source: "raw_content",
    embed_text: trimmed
  };
};

export const buildParsedOutputWithContract = (input: {
  trialId: number;
  content: string;
  contract: DecisionContractConfig;
  parserVersion: string;
}): ArbiterParsedOutputRecord => {
  const validate = buildContractValidator(input.contract.schema);
  const extracted = extractContractOutput(input.content, input.contract, validate);

  return {
    trial_id: input.trialId,
    parse_status: extracted.parse_status,
    extraction_method: extracted.extraction_method,
    embed_text_source: extracted.embed_text_source,
    confidence: extracted.confidence ?? null,
    outcome: extracted.outcome,
    rationale: extracted.rationale,
    rationale_truncated: extracted.rationale_truncated ?? false,
    raw_assistant_text: input.content,
    embed_text: extracted.embed_text,
    parser_version: input.parserVersion,
    parse_error:
      extracted.parse_status === "failed"
        ? { message: "Decision contract parse failed" }
        : undefined
  };
};
