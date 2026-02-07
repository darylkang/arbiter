import type { EventBus } from "../events/event-bus.js";
import type { ArbiterResolvedConfig } from "../generated/config.types.js";
import type { ArbiterTrialRecord } from "../generated/trial.types.js";
import type { ArbiterParsedOutputRecord } from "../generated/parsed-output.types.js";
import type { ArbiterDebugEmbeddingJSONLRecord } from "../generated/embedding.types.js";
import { createRngForTrial } from "../utils/seeded-rng.js";
import { sha256Hex } from "../utils/hash.js";
import { encodeFloat32Base64 } from "../utils/float32-base64.js";
import type { TrialPlanEntry } from "../planning/planner.js";
import { buildDebateParsedOutput } from "../protocols/debate-v1/parser.js";
import { buildParsedOutputWithContract } from "../protocols/contract/extraction.js";
import { prepareEmbedText } from "./embed-text.js";
import type { TrialExecutor } from "./trial-executor.js";

export type MockTrialExecutionState = {
  contractFailures: {
    fallback: number;
    failed: number;
  };
  embeddingGenerationIds: Set<string>;
};

export type CreateMockTrialExecutorOptions = {
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

const buildIndependentParsedOutput = (
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

const shouldExcludeContractFailure = (input: {
  hasDecisionContract: boolean;
  parseStatus: ArbiterParsedOutputRecord["parse_status"];
  contractFailurePolicy?: "warn" | "exclude" | "fail";
}): boolean =>
  input.hasDecisionContract &&
  input.contractFailurePolicy === "exclude" &&
  input.parseStatus !== "success";

const buildSkippedEmbedding = (
  trialId: number,
  reason: string,
  parsedRecord: ArbiterParsedOutputRecord,
  preparation: ReturnType<typeof prepareEmbedText>
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

export const createMockTrialExecutor = (
  options: CreateMockTrialExecutorOptions
): TrialExecutor => {
  const {
    bus,
    resolvedConfig,
    embeddingDimensions,
    embeddingMaxChars,
    forceEmptyEmbedText,
    delayMs,
    hasDecisionContract,
    contractFailurePolicy,
    state
  } = options;

  return async (entry: TrialPlanEntry) => {
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    const embedRng = createRngForTrial(resolvedConfig.run.seed, "embedding", entry.trial_id);

    const outcomeVariant = entry.trial_id % 3;
    const outcome = `Answer variant ${outcomeVariant}`;
    const rawAssistantText = `${outcome}\n`;

    if (entry.protocol === "debate_v1") {
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
      if (hasDecisionContract && parsedRecord.parse_status !== "success") {
        if (parsedRecord.parse_status === "fallback") {
          state.contractFailures.fallback += 1;
        } else if (parsedRecord.parse_status === "failed") {
          state.contractFailures.failed += 1;
        }
      }
      const rawEmbedText = forceEmptyEmbedText ? "" : parsedRecord.embed_text ?? "";
      const preparation = prepareEmbedText(rawEmbedText, embeddingMaxChars);
      parsedRecord.embed_text = preparation.text || undefined;
      bus.emit({ type: "parsed.output", payload: { parsed_record: parsedRecord } });

      if (
        shouldExcludeContractFailure({
          hasDecisionContract,
          parseStatus: parsedRecord.parse_status,
          contractFailurePolicy
        })
      ) {
        const embeddingRecord = buildSkippedEmbedding(
          entry.trial_id,
          "contract_parse_excluded",
          parsedRecord,
          preparation
        );
        bus.emit({ type: "embedding.recorded", payload: { embedding_record: embeddingRecord } });
        return { trial_id: entry.trial_id, embedding: { status: "skipped" } };
      }

      if (preparation.was_empty) {
        const embeddingRecord = buildSkippedEmbedding(
          entry.trial_id,
          "empty_embed_text",
          parsedRecord,
          preparation
        );
        bus.emit({ type: "embedding.recorded", payload: { embedding_record: embeddingRecord } });
        return { trial_id: entry.trial_id, embedding: { status: "skipped" } };
      }

      const vector = Array.from({ length: embeddingDimensions }, () => embedRng());
      const generationId = `mock-embed-${entry.trial_id}`;
      state.embeddingGenerationIds.add(generationId);
      const embeddingRecord: ArbiterDebugEmbeddingJSONLRecord = {
        trial_id: entry.trial_id,
        embedding_status: "success",
        vector_b64: encodeFloat32Base64(vector),
        dtype: "float32",
        encoding: "float32le_base64",
        dimensions: embeddingDimensions,
        embed_text_sha256: sha256Hex(preparation.text),
        generation_id: generationId,
        embed_text_truncated: preparation.truncated,
        embed_text_original_chars: preparation.original_chars,
        embed_text_final_chars: preparation.final_chars,
        truncation_reason: preparation.truncation_reason
      };
      bus.emit({ type: "embedding.recorded", payload: { embedding_record: embeddingRecord } });

      return { trial_id: entry.trial_id, embedding: { status: "success", vector } };
    }

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
      : buildIndependentParsedOutput(
          entry.trial_id,
          outcome,
          rawAssistantText,
          embedTextValue
        );
    const preparation = prepareEmbedText(
      forceEmptyEmbedText ? "" : parsedRecord.embed_text ?? "",
      embeddingMaxChars
    );
    if (hasDecisionContract && parsedRecord.parse_status !== "success") {
      if (parsedRecord.parse_status === "fallback") {
        state.contractFailures.fallback += 1;
      } else if (parsedRecord.parse_status === "failed") {
        state.contractFailures.failed += 1;
      }
    }
    parsedRecord.embed_text = preparation.text || undefined;
    bus.emit({ type: "parsed.output", payload: { parsed_record: parsedRecord } });

    if (
      shouldExcludeContractFailure({
        hasDecisionContract,
        parseStatus: parsedRecord.parse_status,
        contractFailurePolicy
      })
    ) {
      const embeddingRecord = buildSkippedEmbedding(
        entry.trial_id,
        "contract_parse_excluded",
        parsedRecord,
        preparation
      );
      bus.emit({ type: "embedding.recorded", payload: { embedding_record: embeddingRecord } });
      return { trial_id: entry.trial_id, embedding: { status: "skipped" } };
    }

    if (preparation.was_empty) {
      const embeddingRecord = buildSkippedEmbedding(
        entry.trial_id,
        "empty_embed_text",
        parsedRecord,
        preparation
      );
      bus.emit({ type: "embedding.recorded", payload: { embedding_record: embeddingRecord } });
      return { trial_id: entry.trial_id, embedding: { status: "skipped" } };
    }

    const vector = Array.from({ length: embeddingDimensions }, () => embedRng());
    const generationId = `mock-embed-${entry.trial_id}`;
    state.embeddingGenerationIds.add(generationId);
    const embeddingRecord: ArbiterDebugEmbeddingJSONLRecord = {
      trial_id: entry.trial_id,
      embedding_status: "success",
      vector_b64: encodeFloat32Base64(vector),
      dtype: "float32",
      encoding: "float32le_base64",
      dimensions: embeddingDimensions,
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
};
