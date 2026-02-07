import type { ArbiterTrialRecord } from "../../generated/trial.types.js";
import type { ArbiterDebugEmbeddingJSONLRecord } from "../../generated/embedding.types.js";
import type { TrialPlanEntry } from "../../planning/planner.js";
import { encodeFloat32Base64 } from "../../utils/float32-base64.js";
import { sha256Hex } from "../../utils/hash.js";
import { buildDebateParsedOutput } from "./parser.js";
import { prepareEmbedText } from "../../engine/embed-text.js";
import type { TrialExecutionResult } from "../../engine/trial-executor.js";
import {
  buildMockSkippedEmbedding,
  shouldExcludeMockContractFailure,
  type MockTrialExecutionContext
} from "../../engine/mock-trial-context.js";

export const executeMockDebateTrial = async (input: {
  context: MockTrialExecutionContext;
  entry: TrialPlanEntry;
  embedRng: () => number;
}): Promise<TrialExecutionResult> => {
  const { context, entry, embedRng } = input;
  const { bus, resolvedConfig } = context;

  const proposerIntro = `Proposer opening ${entry.trial_id}`;
  const criticReply = `Critic response ${entry.trial_id}`;
  const finalPayload =
    entry.trial_id % 3 === 0
      ? `Here is the decision:\n\`\`\`json\n${JSON.stringify({
          decision: `Decision ${entry.trial_id}`,
          confidence: "medium",
          reasoning: "Mock reasoning"
        })}\n\`\`\``
      : entry.trial_id % 3 === 1
        ? `${JSON.stringify({
            decision: `Decision ${entry.trial_id}`,
            confidence: "low",
            reasoning: "Mock reasoning unfenced"
          })}`
        : `Raw final content ${entry.trial_id}`;

  const calls: NonNullable<ArbiterTrialRecord["calls"]> = [
    {
      call_index: 0,
      turn: 0,
      role: "proposer",
      model_requested: entry.assigned_config.model,
      model_actual: entry.assigned_config.model,
      request_payload: { mock: true, turn: 0 },
      response_payload: { content: proposerIntro },
      attempt: {
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        latency_ms: 0,
        retry_count: 0
      },
      error_message: null
    },
    {
      call_index: 1,
      turn: 1,
      role: "critic",
      model_requested: entry.assigned_config.model,
      model_actual: entry.assigned_config.model,
      request_payload: { mock: true, turn: 1 },
      response_payload: { content: criticReply },
      attempt: {
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        latency_ms: 0,
        retry_count: 0
      },
      error_message: null
    },
    {
      call_index: 2,
      turn: 2,
      role: "proposer",
      model_requested: entry.assigned_config.model,
      model_actual: entry.assigned_config.model,
      request_payload: { mock: true, turn: 2 },
      response_payload: { content: finalPayload },
      attempt: {
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        latency_ms: 0,
        retry_count: 0
      },
      error_message: null
    }
  ];

  const transcript: NonNullable<ArbiterTrialRecord["transcript"]> = [
    { turn: 0, role: "proposer", content: proposerIntro },
    { turn: 1, role: "critic", content: criticReply },
    { turn: 2, role: "proposer", content: finalPayload }
  ];

  const trialRecord: ArbiterTrialRecord = {
    trial_id: entry.trial_id,
    requested_model_slug: entry.assigned_config.model,
    actual_model: entry.assigned_config.model,
    protocol: "debate_v1",
    status: "success",
    assigned_config: entry.assigned_config,
    role_assignments: entry.role_assignments,
    calls,
    transcript,
    raw_assistant_text: finalPayload
  };

  bus.emit({ type: "trial.completed", payload: { trial_record: trialRecord } });

  const parsedRecord = buildDebateParsedOutput(
    entry.trial_id,
    finalPayload,
    resolvedConfig.protocol.decision_contract ?? undefined
  );
  if (context.hasDecisionContract && parsedRecord.parse_status !== "success") {
    if (parsedRecord.parse_status === "fallback") {
      context.state.contractFailures.fallback += 1;
    } else if (parsedRecord.parse_status === "failed") {
      context.state.contractFailures.failed += 1;
    }
  }
  const rawEmbedText = context.forceEmptyEmbedText ? "" : parsedRecord.embed_text ?? "";
  const preparation = prepareEmbedText(rawEmbedText, context.embeddingMaxChars);
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
