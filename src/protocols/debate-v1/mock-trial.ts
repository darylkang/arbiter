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

const sortedSlots = (roleAssignments: NonNullable<ArbiterTrialRecord["role_assignments"]>): string[] =>
  Object.keys(roleAssignments).sort((a, b) => {
    if (a === "A") {
      return -1;
    }
    if (b === "A") {
      return 1;
    }
    return a.localeCompare(b);
  });

export const executeMockDebateTrial = async (input: {
  context: MockTrialExecutionContext;
  entry: TrialPlanEntry;
  embedRng: () => number;
}): Promise<TrialExecutionResult> => {
  const { context, entry, embedRng } = input;
  const { bus, resolvedConfig } = context;

  const roleAssignments = entry.role_assignments ?? { A: { model_slug: entry.assigned_config.model, persona_id: entry.assigned_config.persona } };
  const slots = sortedSlots(roleAssignments);
  const slotA = slots.includes("A") ? "A" : slots[0];
  const rounds = entry.debate?.rounds ?? resolvedConfig.protocol.rounds ?? 1;

  const calls: NonNullable<ArbiterTrialRecord["calls"]> = [];
  const transcript: NonNullable<ArbiterTrialRecord["transcript"]> = [];

  let callIndex = 0;
  let turn = 0;
  for (let round = 1; round <= rounds; round += 1) {
    for (const slotId of slots) {
      const content = `Slot ${slotId} round ${round} response for trial ${entry.trial_id}`;
      const assignment = roleAssignments[slotId] ?? roleAssignments[slotA];
      calls.push({
        call_index: callIndex,
        turn,
        role: slotId,
        model_requested: assignment.model_slug,
        model_actual: assignment.model_slug,
        request_payload: { mock: true, slot: slotId, round },
        response_payload: { content },
        attempt: {
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          latency_ms: 0,
          retry_count: 0
        },
        error_message: null
      });
      transcript.push({ turn, role: slotId, content });
      callIndex += 1;
      turn += 1;
    }
  }

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

  const slotAFinalAssignment = roleAssignments[slotA] ?? roleAssignments[slots[0]];
  calls.push({
    call_index: callIndex,
    turn,
    role: slotA,
    model_requested: slotAFinalAssignment.model_slug,
    model_actual: slotAFinalAssignment.model_slug,
    request_payload: { mock: true, slot: slotA, final: true },
    response_payload: { content: finalPayload },
    attempt: {
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      latency_ms: 0,
      retry_count: 0
    },
    error_message: null
  });
  transcript.push({ turn, role: slotA, content: finalPayload });

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

  const preparation = prepareEmbedText(
    context.forceEmptyEmbedText ? "" : parsedRecord.embed_text ?? "",
    context.embeddingMaxChars
  );
  parsedRecord.embed_text = preparation.text || undefined;

  const trialRecord: ArbiterTrialRecord = {
    trial_id: entry.trial_id,
    requested_model_slug: entry.assigned_config.model,
    actual_model: slotAFinalAssignment.model_slug,
    protocol: "debate_v1",
    status: "success",
    assigned_config: entry.assigned_config,
    role_assignments: roleAssignments,
    calls,
    transcript,
    raw_assistant_text: finalPayload,
    parsed: {
      parse_status: parsedRecord.parse_status,
      parser_version: parsedRecord.parser_version ?? "unknown",
      ...(parsedRecord.extraction_method !== undefined
        ? { extraction_method: parsedRecord.extraction_method }
        : {}),
      ...(parsedRecord.embed_text_source !== undefined
        ? { embed_text_source: parsedRecord.embed_text_source }
        : {}),
      confidence:
        parsedRecord.confidence === undefined || parsedRecord.confidence === null
          ? parsedRecord.confidence
          : String(parsedRecord.confidence),
      ...(parsedRecord.outcome !== undefined ? { outcome: parsedRecord.outcome } : {}),
      ...(parsedRecord.rationale !== undefined ? { rationale: parsedRecord.rationale } : {}),
      ...(parsedRecord.embed_text !== undefined ? { embed_text: parsedRecord.embed_text } : {}),
      ...(parsedRecord.parse_error !== undefined ? { parse_error: parsedRecord.parse_error } : {})
    }
  };

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
    const skipReason =
      embeddingRecord.embedding_status === "skipped" ? embeddingRecord.skip_reason : undefined;
    trialRecord.embedding = {
      status: "skipped",
      skip_reason: skipReason
    };
    bus.emit({ type: "trial.completed", payload: { trial_record: trialRecord } });
    bus.emit({ type: "parsed.output", payload: { parsed_record: parsedRecord } });
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
    const skipReason =
      embeddingRecord.embedding_status === "skipped" ? embeddingRecord.skip_reason : undefined;
    trialRecord.embedding = {
      status: "skipped",
      skip_reason: skipReason
    };
    bus.emit({ type: "trial.completed", payload: { trial_record: trialRecord } });
    bus.emit({ type: "parsed.output", payload: { parsed_record: parsedRecord } });
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

  trialRecord.embedding = {
    status: "success",
    generation_id: generationId
  };

  bus.emit({ type: "trial.completed", payload: { trial_record: trialRecord } });
  bus.emit({ type: "parsed.output", payload: { parsed_record: parsedRecord } });
  bus.emit({ type: "embedding.recorded", payload: { embedding_record: embeddingRecord } });

  return { trial_id: entry.trial_id, embedding: { status: "success", vector } };
};
