import type { ArbiterDebugEmbeddingJSONLRecord } from "../../generated/embedding.types.js";
import type { ArbiterTrialRecord } from "../../generated/trial.types.js";
import type { TrialPlanEntry } from "../../planning/planner.js";
import { encodeFloat32Base64 } from "../../utils/float32-base64.js";
import { sha256Hex } from "../../utils/hash.js";
import { buildParsedOutputWithContract } from "../contract/extraction.js";
import { prepareEmbedText } from "../../engine/embed-text.js";
import type { TrialExecutionResult } from "../../engine/trial-executor.js";
import {
  buildMockIndependentParsedOutput,
  buildMockSkippedEmbedding,
  shouldExcludeMockContractFailure,
  type MockTrialExecutionContext
} from "../../engine/mock-trial-context.js";

export const executeMockIndependentTrial = async (input: {
  context: MockTrialExecutionContext;
  entry: TrialPlanEntry;
  embedRng: () => number;
}): Promise<TrialExecutionResult> => {
  const { context, entry, embedRng } = input;
  const { bus, resolvedConfig } = context;

  const outcomeVariant = entry.trial_id % 3;
  const outcome = `Answer variant ${outcomeVariant}`;
  const rawAssistantText = `${outcome}\n`;

  const embedTextValue =
    resolvedConfig.measurement.embed_text_strategy === "outcome_only"
      ? outcome
      : outcome || rawAssistantText;

  const trialRecord: ArbiterTrialRecord = {
    trial_id: entry.trial_id,
    requested_model_slug: entry.assigned_config.model,
    actual_model: entry.assigned_config.model,
    protocol: "independent",
    status: "success",
    assigned_config: entry.assigned_config,
    raw_assistant_text: rawAssistantText
  };

  bus.emit({ type: "trial.completed", payload: { trial_record: trialRecord } });

  const parsedRecord = resolvedConfig.protocol.decision_contract
    ? buildParsedOutputWithContract({
        trialId: entry.trial_id,
        content: rawAssistantText,
        contract: resolvedConfig.protocol.decision_contract,
        parserVersion: "independent-v1"
      })
    : buildMockIndependentParsedOutput(
        entry.trial_id,
        outcome,
        rawAssistantText,
        embedTextValue
      );

  const preparation = prepareEmbedText(
    context.forceEmptyEmbedText ? "" : parsedRecord.embed_text ?? "",
    context.embeddingMaxChars
  );
  if (context.hasDecisionContract && parsedRecord.parse_status !== "success") {
    if (parsedRecord.parse_status === "fallback") {
      context.state.contractFailures.fallback += 1;
    } else if (parsedRecord.parse_status === "failed") {
      context.state.contractFailures.failed += 1;
    }
  }
  parsedRecord.embed_text = preparation.text || undefined;
  bus.emit({ type: "parsed.output", payload: { parsed_record: parsedRecord } });

  if (
    shouldExcludeMockContractFailure({
      hasDecisionContract: context.hasDecisionContract,
      parseStatus: parsedRecord.parse_status,
      contractFailurePolicy: context.contractFailurePolicy
    })
  ) {
    const embeddingRecord = buildMockSkippedEmbedding(
      entry.trial_id,
      "contract_parse_excluded",
      parsedRecord,
      preparation
    );
    bus.emit({ type: "embedding.recorded", payload: { embedding_record: embeddingRecord } });
    return { trial_id: entry.trial_id, embedding: { status: "skipped" } };
  }

  if (preparation.was_empty) {
    const embeddingRecord = buildMockSkippedEmbedding(
      entry.trial_id,
      "empty_embed_text",
      parsedRecord,
      preparation
    );
    bus.emit({ type: "embedding.recorded", payload: { embedding_record: embeddingRecord } });
    return { trial_id: entry.trial_id, embedding: { status: "skipped" } };
  }

  const vector = Array.from({ length: context.embeddingDimensions }, () => embedRng());
  const generationId = `mock-embed-${entry.trial_id}`;
  context.state.embeddingGenerationIds.add(generationId);

  const embeddingRecord: ArbiterDebugEmbeddingJSONLRecord = {
    trial_id: entry.trial_id,
    embedding_status: "success",
    vector_b64: encodeFloat32Base64(vector),
    dtype: "float32",
    encoding: "float32le_base64",
    dimensions: context.embeddingDimensions,
    embed_text_sha256: sha256Hex(preparation.text),
    generation_id: generationId,
    embed_text_truncated: preparation.truncated,
    embed_text_original_chars: preparation.original_chars,
    embed_text_final_chars: preparation.final_chars,
    truncation_reason: preparation.truncation_reason
  };
  bus.emit({ type: "embedding.recorded", payload: { embedding_record: embeddingRecord } });

  return { trial_id: entry.trial_id, embedding: { status: "success", vector } };
};
