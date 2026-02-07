import type { ArbiterTrialRecord } from "../../generated/trial.types.js";
import type { TrialPlanEntry } from "../../planning/planner.js";
import {
  chatCompletion,
  embedText,
  OpenRouterError,
  extractActualModel
} from "../../openrouter/client.js";
import { buildDebateMessages } from "./messages.js";
import { buildDebateParsedOutput } from "./parser.js";
import { formatDecisionContractClause } from "../contract/extraction.js";
import { deriveFailureStatus } from "../../engine/status.js";
import { prepareEmbedText } from "../../engine/embed-text.js";
import type { TrialExecutionResult } from "../../engine/trial-executor.js";
import {
  applyEmbeddingMetadata,
  asObject,
  buildFailedEmbedding,
  buildSkippedEmbedding,
  buildSuccessEmbedding,
  createTimeoutSignal,
  extractAssistantText,
  isContractParseFailure,
  normalizeErrorCode,
  shouldExcludeContractFailure,
  type LiveTrialExecutionContext
} from "../../engine/live-trial-context.js";

const buildDebateTrialFailure = (input: {
  entry: TrialPlanEntry;
  roleAssignments: NonNullable<ArbiterTrialRecord["role_assignments"]>;
  calls: NonNullable<ArbiterTrialRecord["calls"]>;
  transcript: NonNullable<ArbiterTrialRecord["transcript"]>;
  error: OpenRouterError | Error | undefined;
  errorCode: string | null;
}) => {
  const { entry, roleAssignments, calls, transcript } = input;
  const status = deriveFailureStatus({
    timeoutExhausted: input.errorCode === "timeout_exhausted",
    modelUnavailable: Boolean(
      input.error instanceof OpenRouterError && input.error.modelUnavailable
    )
  });

  return {
    trial_id: entry.trial_id,
    requested_model_slug: entry.assigned_config.model,
    actual_model: null,
    protocol: "debate_v1" as const,
    status,
    assigned_config: entry.assigned_config,
    role_assignments: roleAssignments,
    calls,
    transcript,
    error: {
      message: input.error?.message ?? "Debate call failed",
      code: normalizeErrorCode(
        input.error instanceof OpenRouterError ? input.error.code : undefined
      ),
      retryable:
        input.error instanceof OpenRouterError ? input.error.retryable : false
    },
    error_code: input.errorCode
  };
};

export const executeLiveDebateTrial = async (input: {
  context: LiveTrialExecutionContext;
  entry: TrialPlanEntry;
}): Promise<TrialExecutionResult> => {
  const { context, entry } = input;
  const { bus, resolvedConfig } = context;

  const roleAssignments = entry.role_assignments;
  if (!roleAssignments) {
    throw new Error(`Missing role assignments for debate trial ${entry.trial_id}`);
  }

  const proposerPersona = roleAssignments.proposer.persona_id
    ? context.personaMap.get(roleAssignments.proposer.persona_id)
    : undefined;
  const criticPersona = roleAssignments.critic.persona_id
    ? context.personaMap.get(roleAssignments.critic.persona_id)
    : undefined;

  if (!resolvedConfig.protocol.prompts) {
    throw new Error("Debate prompts are missing from resolved config");
  }

  const protocolPrompts = resolvedConfig.protocol.prompts;
  const calls: NonNullable<ArbiterTrialRecord["calls"]> = [];
  const transcript: NonNullable<ArbiterTrialRecord["transcript"]> = [];
  const trialStartedMs = Date.now();
  const emptyPreparation = prepareEmbedText("", context.embeddingMaxChars);
  const totalTimeoutMs = resolvedConfig.protocol.timeouts.total_trial_timeout_ms;
  const perCallTimeoutMs = resolvedConfig.protocol.timeouts.per_call_timeout_ms;
  const perCallMaxRetries = resolvedConfig.protocol.timeouts.per_call_max_retries;
  const backoffMs = resolvedConfig.execution.retry_policy.backoff_ms ?? 0;

  const contractClause = resolvedConfig.protocol.decision_contract
    ? formatDecisionContractClause(resolvedConfig.protocol.decision_contract.schema)
    : undefined;

  const runCall = async (callInput: {
    callIndex: number;
    turn: 0 | 1 | 2;
    role: "proposer" | "critic";
    systemPrompt: string;
    personaPrompt?: string | null;
    contractClause?: string;
    proposerTurn?: string;
    criticTurn?: string;
  }): Promise<{
    content?: string;
    modelActual?: string | null;
    error?: OpenRouterError | Error;
    errorCode?: string;
  }> => {
    const elapsed = Date.now() - trialStartedMs;
    const remaining = totalTimeoutMs - elapsed;
    if (remaining <= 0) {
      return { error: new Error("Total trial timeout exhausted"), errorCode: "timeout_exhausted" };
    }

    const callStarted = new Date().toISOString();
    const messages = buildDebateMessages({
      turn: callInput.turn,
      question: resolvedConfig.question.text,
      systemPrompt: callInput.systemPrompt,
      personaPrompt: callInput.personaPrompt,
      contractClause: callInput.contractClause,
      proposerTurn: callInput.proposerTurn,
      criticTurn: callInput.criticTurn
    });

    const timeout = createTimeoutSignal(Math.min(perCallTimeoutMs, remaining), context.abortSignal);
    let result: Awaited<ReturnType<typeof chatCompletion>> | null = null;
    let error: OpenRouterError | Error | null = null;

    try {
      result = await chatCompletion({
        model: roleAssignments[callInput.role].model_slug,
        messages,
        params: roleAssignments[callInput.role].decode,
        options: {
          retry: { maxRetries: perCallMaxRetries, backoffMs },
          signal: timeout.signal
        }
      });
    } catch (err) {
      error = err instanceof OpenRouterError ? err : (err as Error);
    } finally {
      timeout.cancel();
    }

    if (result) {
      const content = extractAssistantText(result.responseBody);
      calls.push({
        call_index: callInput.callIndex,
        turn: callInput.turn,
        role: callInput.role,
        model_requested: roleAssignments[callInput.role].model_slug,
        model_actual: result.model ?? null,
        request_payload: result.requestPayload,
        response_payload: asObject(result.responseBody) ?? null,
        usage: result.usage ?? undefined,
        attempt: {
          started_at: callStarted,
          completed_at: new Date().toISOString(),
          latency_ms: result.latencyMs,
          retry_count: result.retryCount
        },
        error_message: null
      });
      transcript.push({ turn: callInput.turn, role: callInput.role, content });
      return { content, modelActual: result.model ?? null };
    }

    const errorMessage =
      error instanceof OpenRouterError
        ? error.message
        : error?.message ?? "OpenRouter request failed";
    const retryCount = error instanceof OpenRouterError ? error.retryCount : 0;
    const latencyMs = error instanceof OpenRouterError ? error.latencyMs ?? 0 : 0;
    const responsePayload =
      error instanceof OpenRouterError ? error.responseBody : undefined;
    const modelActual =
      error instanceof OpenRouterError ? extractActualModel(error.responseBody) : null;
    const timeoutCode = timeout.didTimeout() ? "timeout_exhausted" : undefined;

    calls.push({
      call_index: callInput.callIndex,
      turn: callInput.turn,
      role: callInput.role,
      model_requested: roleAssignments[callInput.role].model_slug,
      model_actual: modelActual,
      request_payload:
        error instanceof OpenRouterError ? (error.requestPayload ?? {}) : {},
      response_payload: asObject(responsePayload) ?? null,
      attempt: {
        started_at: callStarted,
        completed_at: new Date().toISOString(),
        latency_ms: latencyMs,
        retry_count: retryCount
      },
      error_message: errorMessage
    });

    return { error: error ?? new Error(errorMessage), errorCode: timeoutCode };
  };

  const proposerPersonaText = proposerPersona?.text ?? "";
  const criticPersonaText = criticPersona?.text ?? "";

  const emitFailure = (result: { error?: OpenRouterError | Error; errorCode?: string }) => {
    const errorCode = result.errorCode ?? (context.shouldStop().stop ? "shutdown_abort" : null);
    const trialRecord = buildDebateTrialFailure({
      entry,
      roleAssignments,
      calls,
      transcript,
      error: result.error,
      errorCode
    });

    bus.emit({ type: "trial.completed", payload: { trial_record: trialRecord } });
    bus.emit({
      type: "parsed.output",
      payload: {
        parsed_record: {
          trial_id: entry.trial_id,
          parse_status: "failed",
          parser_version: "debate-v1"
        }
      }
    });
    bus.emit({
      type: "embedding.recorded",
      payload: {
        embedding_record: buildSkippedEmbedding(
          entry.trial_id,
          "trial_not_success",
          emptyPreparation
        )
      }
    });
    return { trial_id: entry.trial_id, embedding: { status: "skipped" as const } };
  };

  const turn0 = await runCall({
    callIndex: 0,
    turn: 0,
    role: "proposer",
    systemPrompt: protocolPrompts.proposer_system.text,
    personaPrompt: proposerPersonaText
  });
  if (!turn0.content) {
    return emitFailure(turn0);
  }

  const turn1 = await runCall({
    callIndex: 1,
    turn: 1,
    role: "critic",
    systemPrompt: protocolPrompts.critic_system.text,
    personaPrompt: criticPersonaText,
    proposerTurn: turn0.content
  });
  if (!turn1.content) {
    return emitFailure(turn1);
  }

  const turn2 = await runCall({
    callIndex: 2,
    turn: 2,
    role: "proposer",
    systemPrompt: protocolPrompts.proposer_final_system.text,
    personaPrompt: proposerPersonaText,
    contractClause,
    proposerTurn: turn0.content,
    criticTurn: turn1.content
  });
  if (!turn2.content) {
    return emitFailure(turn2);
  }

  const parsedRecord = buildDebateParsedOutput(
    entry.trial_id,
    turn2.content,
    resolvedConfig.protocol.decision_contract ?? undefined
  );
  const contractParseFailure = isContractParseFailure({
    hasDecisionContract: context.hasDecisionContract,
    trialSucceeded: true,
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

  const trialRecord: ArbiterTrialRecord = {
    trial_id: entry.trial_id,
    requested_model_slug: entry.assigned_config.model,
    actual_model: turn2.modelActual ?? null,
    protocol: "debate_v1",
    status: "success",
    assigned_config: entry.assigned_config,
    role_assignments: roleAssignments,
    calls,
    transcript,
    raw_assistant_text: turn2.content
  };

  bus.emit({ type: "trial.completed", payload: { trial_record: trialRecord } });
  bus.emit({ type: "parsed.output", payload: { parsed_record: parsedRecord } });

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
