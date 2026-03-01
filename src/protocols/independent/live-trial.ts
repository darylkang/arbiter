import type { ArbiterTrialRecord } from "../../generated/trial.types.js";
import type { TrialPlanEntry } from "../../planning/planner.js";
import {
  chatCompletion,
  embedText,
  OpenRouterError,
  extractActualModel
} from "../../openrouter/client.js";
import { buildParsedOutputWithContract } from "../contract/extraction.js";
import { deriveFailureStatus } from "../../engine/status.js";
import { prepareEmbedText } from "../../engine/embed-text.js";
import type { TrialExecutionResult } from "../../engine/trial-executor.js";
import {
  applyEmbeddingMetadata,
  asObject,
  buildFailedEmbedding,
  buildIndependentMessages,
  buildIndependentParsedOutput,
  buildSkippedEmbedding,
  buildSuccessEmbedding,
  createTimeoutSignal,
  extractAssistantText,
  isContractParseFailure,
  normalizeErrorCode,
  shouldExcludeContractFailure,
  type LiveTrialExecutionContext
} from "../../engine/live-trial-context.js";

export const executeLiveIndependentTrial = async (input: {
  context: LiveTrialExecutionContext;
  entry: TrialPlanEntry;
}): Promise<TrialExecutionResult> => {
  const { context, entry } = input;
  const { bus, resolvedConfig } = context;

  const persona = context.personaMap.get(entry.assigned_config.persona);
  const protocol = context.protocolMap.get(entry.assigned_config.protocol);
  if (!persona || !protocol) {
    throw new Error(`Missing persona/protocol for trial ${entry.trial_id}`);
  }

  const messages = buildIndependentMessages(resolvedConfig, persona.text ?? "", protocol.text ?? "");
  const timeout = createTimeoutSignal(
    resolvedConfig.protocol.timeouts.per_call_timeout_ms,
    context.abortSignal
  );

  const attemptStarted = new Date().toISOString();
  let trialRecord: ArbiterTrialRecord;
  let rawAssistantText = "";

  try {
    const chatResult = await chatCompletion({
      model: entry.assigned_config.model,
      messages,
      params: entry.assigned_config.decode,
      options: {
        retry: {
          maxRetries: resolvedConfig.protocol.timeouts.per_call_max_retries,
          backoffMs: resolvedConfig.execution.retry_policy.backoff_ms ?? 0
        },
        signal: timeout.signal
      }
    });

    rawAssistantText = extractAssistantText(chatResult.responseBody);

    trialRecord = {
      trial_id: entry.trial_id,
      requested_model_slug: entry.assigned_config.model,
      actual_model: chatResult.model ?? null,
      protocol: "independent",
      status: "success",
      assigned_config: entry.assigned_config,
      usage: chatResult.usage ?? undefined,
      attempt: {
        started_at: attemptStarted,
        completed_at: new Date().toISOString(),
        latency_ms: chatResult.latencyMs,
        retry_count: chatResult.retryCount
      },
      raw_assistant_text: rawAssistantText,
      request_payload: chatResult.requestPayload,
      response_payload: asObject(chatResult.responseBody)
    };
  } catch (error) {
    const chatError = error instanceof OpenRouterError ? error : null;
    const responsePayload = chatError?.responseBody;
    const actualModel = extractActualModel(chatError?.responseBody);

    const status = deriveFailureStatus({
      timeoutExhausted: timeout.didTimeout(),
      modelUnavailable: Boolean(chatError?.modelUnavailable)
    });

    trialRecord = {
      trial_id: entry.trial_id,
      requested_model_slug: entry.assigned_config.model,
      actual_model: actualModel ?? null,
      protocol: "independent",
      status,
      assigned_config: entry.assigned_config,
      attempt: {
        started_at: attemptStarted,
        completed_at: new Date().toISOString(),
        latency_ms: chatError?.latencyMs ?? 0,
        retry_count: chatError?.retryCount ?? 0
      },
      error: {
        message: chatError?.message ?? "OpenRouter request failed",
        code: normalizeErrorCode(chatError?.code),
        retryable: chatError?.retryable ?? false
      },
      error_code: timeout.didTimeout() ? "timeout_exhausted" : null,
      request_payload: asObject(chatError?.requestPayload),
      response_payload: asObject(responsePayload)
    };
  } finally {
    timeout.cancel();
  }

  const parseError =
    trialRecord.status === "success"
      ? rawAssistantText
        ? undefined
        : "Missing assistant content"
      : trialRecord.error?.message ?? "Trial did not complete successfully";
  const outcome = rawAssistantText;
  const embedTextValue =
    resolvedConfig.measurement.embed_text_strategy === "outcome_only" ? outcome : outcome || rawAssistantText;

  const parsedRecord = resolvedConfig.protocol.decision_contract
    ? buildParsedOutputWithContract({
        trialId: entry.trial_id,
        content: rawAssistantText,
        contract: resolvedConfig.protocol.decision_contract,
        parserVersion: "independent-v1"
      })
    : buildIndependentParsedOutput(entry.trial_id, outcome, rawAssistantText, embedTextValue, parseError);

  const contractParseFailure = isContractParseFailure({
    hasDecisionContract: context.hasDecisionContract,
    trialSucceeded: trialRecord.status === "success",
    parseStatus: parsedRecord.parse_status
  });
  if (contractParseFailure) {
    if (parsedRecord.parse_status === "fallback") {
      context.state.contractFailures.fallback += 1;
    } else if (parsedRecord.parse_status === "failed") {
      context.state.contractFailures.failed += 1;
    }
  }

  const preparation = prepareEmbedText(parsedRecord.embed_text ?? "", context.embeddingMaxChars);
  parsedRecord.embed_text = preparation.text || undefined;
  const normalizedConfidence =
    parsedRecord.confidence === undefined || parsedRecord.confidence === null
      ? parsedRecord.confidence
      : String(parsedRecord.confidence);

  trialRecord.parsed = {
    parse_status: parsedRecord.parse_status,
    parser_version: parsedRecord.parser_version ?? "unknown",
    ...(parsedRecord.extraction_method !== undefined
      ? { extraction_method: parsedRecord.extraction_method }
      : {}),
    ...(parsedRecord.embed_text_source !== undefined
      ? { embed_text_source: parsedRecord.embed_text_source }
      : {}),
    confidence: normalizedConfidence,
    ...(parsedRecord.outcome !== undefined ? { outcome: parsedRecord.outcome } : {}),
    ...(parsedRecord.rationale !== undefined ? { rationale: parsedRecord.rationale } : {}),
    ...(parsedRecord.embed_text !== undefined ? { embed_text: parsedRecord.embed_text } : {}),
    ...(parsedRecord.parse_error !== undefined ? { parse_error: parsedRecord.parse_error } : {})
  };

  if (trialRecord.status !== "success") {
    const embeddingRecord = buildSkippedEmbedding(entry.trial_id, "trial_not_success", preparation);
    const skipReason =
      embeddingRecord.embedding_status === "skipped" ? embeddingRecord.skip_reason : undefined;
    trialRecord.embedding = { status: "skipped", skip_reason: skipReason };
    bus.emit({ type: "trial.completed", payload: { trial_record: trialRecord } });
    bus.emit({ type: "parsed.output", payload: { parsed_record: parsedRecord } });
    bus.emit({ type: "embedding.recorded", payload: { embedding_record: embeddingRecord } });
    return { trial_id: entry.trial_id, embedding: { status: "skipped" } };
  }

  if (
    shouldExcludeContractFailure({
      contractParseFailure,
      contractFailurePolicy: context.contractFailurePolicy
    })
  ) {
    const embeddingRecord = buildSkippedEmbedding(entry.trial_id, "contract_parse_excluded", preparation);
    const skipReason =
      embeddingRecord.embedding_status === "skipped" ? embeddingRecord.skip_reason : undefined;
    trialRecord.embedding = { status: "skipped", skip_reason: skipReason };
    bus.emit({ type: "trial.completed", payload: { trial_record: trialRecord } });
    bus.emit({ type: "parsed.output", payload: { parsed_record: parsedRecord } });
    bus.emit({ type: "embedding.recorded", payload: { embedding_record: embeddingRecord } });
    return { trial_id: entry.trial_id, embedding: { status: "skipped" } };
  }

  if (preparation.was_empty) {
    const embeddingRecord = buildSkippedEmbedding(entry.trial_id, "empty_embed_text", preparation);
    const skipReason =
      embeddingRecord.embedding_status === "skipped" ? embeddingRecord.skip_reason : undefined;
    trialRecord.embedding = { status: "skipped", skip_reason: skipReason };
    bus.emit({ type: "trial.completed", payload: { trial_record: trialRecord } });
    bus.emit({ type: "parsed.output", payload: { parsed_record: parsedRecord } });
    bus.emit({ type: "embedding.recorded", payload: { embedding_record: embeddingRecord } });
    return { trial_id: entry.trial_id, embedding: { status: "skipped" } };
  }

  try {
    const embedResult = await embedText({
      model: resolvedConfig.measurement.embedding_model,
      text: preparation.text,
      options: {
        retry: {
          maxRetries: resolvedConfig.execution.retry_policy.max_retries,
          backoffMs: resolvedConfig.execution.retry_policy.backoff_ms ?? 0
        },
        signal: context.abortSignal
      }
    });

    applyEmbeddingMetadata(
      context.state,
      embedResult.vector.length,
      embedResult.model,
      embedResult.generationId
    );

    const embeddingRecord = buildSuccessEmbedding(
      entry.trial_id,
      embedResult.vector,
      preparation,
      embedResult.generationId
    );
    trialRecord.embedding = {
      status: "success",
      generation_id: embedResult.generationId ?? undefined
    };

    bus.emit({ type: "trial.completed", payload: { trial_record: trialRecord } });
    bus.emit({ type: "parsed.output", payload: { parsed_record: parsedRecord } });
    bus.emit({ type: "embedding.recorded", payload: { embedding_record: embeddingRecord } });

    return {
      trial_id: entry.trial_id,
      embedding: { status: "success", vector: embedResult.vector }
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const embeddingRecord = buildFailedEmbedding(entry.trial_id, message, preparation);
    trialRecord.embedding = {
      status: "failed",
      error: message
    };
    bus.emit({ type: "trial.completed", payload: { trial_record: trialRecord } });
    bus.emit({ type: "parsed.output", payload: { parsed_record: parsedRecord } });
    bus.emit({ type: "embedding.recorded", payload: { embedding_record: embeddingRecord } });
    return { trial_id: entry.trial_id, embedding: { status: "failed" } };
  }
};
