import type { EventBus } from "../events/event-bus.js";
import type { ArbiterResolvedConfig } from "../generated/config.types.js";
import type { ArbiterParsedOutputRecord } from "../generated/parsed-output.types.js";
import type { ArbiterDebugEmbeddingJSONLRecord } from "../generated/embedding.types.js";
import { sha256Hex } from "../utils/hash.js";
import type { EmbedTextPreparation } from "./embed-text.js";

export type MockTrialExecutionState = {
  contractFailures: {
    fallback: number;
    failed: number;
  };
  embeddingGenerationIds: Set<string>;
};

export type MockTrialExecutionContext = {
  bus: EventBus;
  resolvedConfig: ArbiterResolvedConfig;
  embeddingDimensions: number;
  embeddingMaxChars: number;
  forceEmptyEmbedText: boolean;
  delayMs: number;
  hasDecisionContract: boolean;
  contractFailurePolicy?: "warn" | "exclude" | "fail";
  state: MockTrialExecutionState;
};

export const buildMockIndependentParsedOutput = (
  trialId: number,
  outcome: string,
  rawAssistantText: string,
  embedText: string
): ArbiterParsedOutputRecord => ({
  trial_id: trialId,
  parse_status: "success",
  outcome,
  raw_assistant_text: rawAssistantText,
  embed_text: embedText,
  parser_version: "mock-v0"
});

export const shouldExcludeMockContractFailure = (input: {
  hasDecisionContract: boolean;
  parseStatus: ArbiterParsedOutputRecord["parse_status"];
  contractFailurePolicy?: "warn" | "exclude" | "fail";
}): boolean =>
  input.hasDecisionContract &&
  input.contractFailurePolicy === "exclude" &&
  input.parseStatus !== "success";

export const buildMockSkippedEmbedding = (
  trialId: number,
  reason: string,
  parsedRecord: ArbiterParsedOutputRecord,
  preparation: EmbedTextPreparation
): ArbiterDebugEmbeddingJSONLRecord => ({
  trial_id: trialId,
  embedding_status: "skipped",
  vector_b64: null,
  dtype: "float32",
  encoding: "float32le_base64",
  skip_reason: reason,
  embed_text_sha256: parsedRecord.embed_text ? sha256Hex(parsedRecord.embed_text) : undefined,
  embed_text_truncated: preparation.truncated,
  embed_text_original_chars: preparation.original_chars,
  embed_text_final_chars: preparation.final_chars,
  truncation_reason: preparation.truncation_reason
});
