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
  let responsePayload: unknown;
  let actualModel: string | null = null;
  let retryCount = 0;
  let latencyMs = 0;
  let chatError: OpenRouterError | null = null;

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

    retryCount = chatResult.retryCount;
    latencyMs = chatResult.latencyMs;
    responsePayload = chatResult.responseBody;
    actualModel = chatResult.model;
    rawAssistantText = extractAssistantText(chatResult.responseBody);

    trialRecord = {
      trial_id: entry.trial_id,
      requested_model_slug: entry.assigned_config.model,
      actual_model: actualModel ?? null,
      protocol: "independent",
      status: "success",
      assigned_config: entry.assigned_config,
      usage: chatResult.usage ?? undefined,
      attempt: {
        started_at: attemptStarted,
        completed_at: new Date().toISOString(),
        latency_ms: latencyMs,
        retry_count: retryCount
      },
      raw_assistant_text: rawAssistantText,
      request_payload: chatResult.requestPayload,
      response_payload: asObject(responsePayload)
    };
  } catch (error) {
    chatError = error instanceof OpenRouterError ? error : null;
    retryCount = chatError?.retryCount ?? 0;
    latencyMs = chatError?.latencyMs ?? 0;
    responsePayload = chatError?.responseBody;
    actualModel = extractActualModel(chatError?.responseBody);

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
        latency_ms: latencyMs,
        retry_count: retryCount
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

  bus.emit({ type: "trial.completed", payload: { trial_record: trialRecord } });

  const parseError =
    trialRecord.status === "success"
      ? rawAssistantText
        ? undefined
        : "Missing assistant content"
      : trialRecord.error?.message ?? "Trial did not complete successfully";
  const outcome = rawAssistantText;
  const embedTextValue =
    resolvedConfig.measurement.embed_text_strategy === "outcome_only"
      ? outcome
      : outcome || rawAssistantText;

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
        embedTextValue,
        parseError
      );

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
  bus.emit({ type: "parsed.output", payload: { parsed_record: parsedRecord } });

  if (trialRecord.status !== "success") {
    bus.emit({
      type: "embedding.recorded",
      payload: {
        embedding_record: buildSkippedEmbedding(
          entry.trial_id,
          "trial_not_success",
          preparation
        )
      }
    });
    return { trial_id: entry.trial_id, embedding: { status: "skipped" } };
  }

  if (
    shouldExcludeContractFailure({
      contractParseFailure,
      contractFailurePolicy: context.contractFailurePolicy
    })
  ) {
    bus.emit({
      type: "embedding.recorded",
      payload: {
        embedding_record: buildSkippedEmbedding(
          entry.trial_id,
          "contract_parse_excluded",
          preparation
        )
      }
    });
    return { trial_id: entry.trial_id, embedding: { status: "skipped" } };
  }

  if (preparation.was_empty) {
    bus.emit({
      type: "embedding.recorded",
      payload: {
        embedding_record: buildSkippedEmbedding(
          entry.trial_id,
          "empty_embed_text",
          preparation
        )
      }
    });
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

    bus.emit({
      type: "embedding.recorded",
      payload: {
        embedding_record: buildSuccessEmbedding(
          entry.trial_id,
          embedResult.vector,
          preparation,
          embedResult.generationId
        )
      }
    });

    return {
      trial_id: entry.trial_id,
      embedding: { status: "success", vector: embedResult.vector }
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    bus.emit({
      type: "embedding.recorded",
      payload: {
        embedding_record: buildFailedEmbedding(entry.trial_id, message, preparation)
      }
    });
    return { trial_id: entry.trial_id, embedding: { status: "failed" } };
  }
};
