import type { ArbiterParsedOutputRecord } from "../../generated/parsed-output.types.js";
import type { ArbiterTrialRecord } from "../../generated/trial.types.js";
import type { TrialPlanEntry } from "../../planning/planner.js";
import { canonicalStringify } from "../../utils/canonical-json.js";
import {
  chatCompletion,
  embedText,
  OpenRouterError,
  extractActualModel
} from "../../openrouter/client.js";
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
import { sha256Hex } from "../../utils/hash.js";
import {
  debateRolePromptKey,
  debateTurnInstructionPromptKey
} from "./roles.js";

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

const buildDebatePrompt = (input: {
  question: string;
  transcript: NonNullable<ArbiterTrialRecord["transcript"]>;
  slotId: string;
  roleKind: string;
  round: number;
  isFinal: boolean;
  turnInstructionText: string;
}): string => {
  const currentTurn = `Current turn:\nround ${input.round}, slot ${input.slotId}, role ${input.roleKind}`;
  const task = `Your task for this turn:\n${input.turnInstructionText}`;

  if (input.transcript.length === 0) {
    return `Question:\n${input.question}\n\n${currentTurn}\n\n${task}`;
  }

  const transcriptText = input.transcript
    .map((entry) => `Turn ${entry.turn_index} [${entry.slot} / ${entry.role_kind}]: ${entry.content}`)
    .join("\n");

  return `Question:\n${input.question}\n\n${currentTurn}\n\n${task}\n\nPrior turns:\n${transcriptText}`;
};
const DEBATE_PROTOCOL_INVARIANTS =
  "Engage prior turns directly. Add new information instead of repeating the full debate.";

const buildFailureTrialRecord = (input: {
  entry: TrialPlanEntry;
  roleAssignments: NonNullable<ArbiterTrialRecord["role_assignments"]>;
  calls: NonNullable<ArbiterTrialRecord["calls"]>;
  transcript: NonNullable<ArbiterTrialRecord["transcript"]>;
  error: OpenRouterError | Error | undefined;
  errorCode: string | null;
}): ArbiterTrialRecord => {
  const status = deriveFailureStatus({
    timeoutExhausted: input.errorCode === "timeout_exhausted",
    modelUnavailable: Boolean(input.error instanceof OpenRouterError && input.error.modelUnavailable)
  });

  return {
    trial_id: input.entry.trial_id,
    requested_model_slug: input.entry.assigned_config.model,
    actual_model: null,
    protocol: "debate_v1",
    status,
    assigned_config: input.entry.assigned_config,
    role_assignments: input.roleAssignments,
    calls: input.calls,
    transcript: input.transcript,
    ...(input.transcript.length > 0 ? { transcript_hash: sha256Hex(canonicalStringify(input.transcript)) } : {}),
    error: {
      message: input.error?.message ?? "Debate call failed",
      code: normalizeErrorCode(input.error instanceof OpenRouterError ? input.error.code : undefined),
      retryable: input.error instanceof OpenRouterError ? input.error.retryable : false
    },
    error_code: input.errorCode,
    parsed: {
      parse_status: "failed",
      parser_version: "debate-v1"
    },
    embedding: {
      status: "skipped",
      skip_reason: "trial_not_success"
    }
  };
};

const attachParseSummary = (
  trialRecord: ArbiterTrialRecord,
  parsedRecord: ArbiterParsedOutputRecord
): void => {
  trialRecord.parsed = {
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

  if (!resolvedConfig.protocol.prompts) {
    throw new Error("Debate prompts are missing from resolved config");
  }

  const slots = sortedSlots(roleAssignments);
  const slotA = slots.includes("A") ? "A" : slots[0];
  if (!slotA) {
    throw new Error(`Debate trial ${entry.trial_id} has no participant slots`);
  }

  const rounds = entry.debate?.rounds ?? resolvedConfig.protocol.rounds ?? 1;

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
    turn: number;
    round: number;
    slotId: string;
    isFinal: boolean;
  }): Promise<{
    content?: string;
    modelActual?: string | null;
    error?: OpenRouterError | Error;
    errorCode?: string;
  }> => {
    const assignment = roleAssignments[callInput.slotId];
    if (!assignment) {
      return { error: new Error(`Missing assignment for slot ${callInput.slotId}`) };
    }

    const elapsed = Date.now() - trialStartedMs;
    const remaining = totalTimeoutMs - elapsed;
    if (remaining <= 0) {
      return { error: new Error("Total trial timeout exhausted"), errorCode: "timeout_exhausted" };
    }

    const callStarted = new Date().toISOString();
    const personaText = assignment.persona_id
      ? (context.personaMap.get(assignment.persona_id)?.text ?? "")
      : "";
    const rolePromptKey = debateRolePromptKey(assignment.role_kind, callInput.isFinal);
    const rolePrompt = resolvedConfig.protocol.prompts?.[rolePromptKey];
    if (!rolePrompt) {
      return { error: new Error(`Missing resolved debate prompt for ${rolePromptKey}`) };
    }
    const turnInstructionKey = debateTurnInstructionPromptKey(assignment.role_kind, callInput.isFinal);
    const turnInstruction = resolvedConfig.protocol.turn_instructions?.[turnInstructionKey];
    if (!turnInstruction) {
      return { error: new Error(`Missing resolved debate turn instruction for ${turnInstructionKey}`) };
    }
    const systemPromptComponents = [
      { source: "role_prompt" as const, id: rolePrompt.id, sha256: rolePrompt.sha256, text: rolePrompt.text },
      ...(personaText && personaText.trim().length > 0
        ? [
            {
              source: "persona_prompt" as const,
              id: assignment.persona_id,
              sha256:
                assignment.persona_id ? context.personaMap.get(assignment.persona_id)?.sha256 ?? null : null,
              text: personaText
            }
          ]
        : []),
      ...(callInput.isFinal && contractClause
        ? [{ source: "contract_clause" as const, id: resolvedConfig.protocol.decision_contract?.id ?? null, sha256: null, text: contractClause }]
        : [])
    ];
    const systemPrompt = [
      rolePrompt.text,
      personaText && personaText.trim().length > 0 ? personaText : null,
      DEBATE_PROTOCOL_INVARIANTS,
      callInput.isFinal && contractClause ? contractClause : null
    ]
      .filter((part): part is string => Boolean(part))
      .join("\n\n");

    const messages = [
      {
        role: "system" as const,
        content: systemPrompt
      },
      {
        role: "user" as const,
        content: buildDebatePrompt({
          question: resolvedConfig.question.text,
          transcript,
          slotId: callInput.slotId,
          roleKind: assignment.role_kind,
          round: callInput.round,
          isFinal: callInput.isFinal,
          turnInstructionText: turnInstruction.text
        })
      }
    ];

    const timeout = createTimeoutSignal(Math.min(perCallTimeoutMs, remaining), context.abortSignal);
    let result: Awaited<ReturnType<typeof chatCompletion>> | null = null;
    let error: OpenRouterError | Error | null = null;

    try {
      result = await chatCompletion({
        model: assignment.model_slug,
        messages,
        params: assignment.decode,
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
        role: callInput.slotId,
        model_requested: assignment.model_slug,
        model_actual: result.model ?? null,
        request_payload: {
          ...result.requestPayload,
          role_kind: assignment.role_kind,
          role_prompt_id: rolePrompt.id,
          role_prompt_sha256: rolePrompt.sha256,
          turn_instruction_id: turnInstruction.id,
          turn_instruction_sha256: turnInstruction.sha256
        },
        response_payload: asObject(result.responseBody) ?? null,
        system_prompt_components: systemPromptComponents,
        turn_instruction_id: turnInstruction.id,
        turn_instruction_sha256: turnInstruction.sha256,
        turn_instruction_text: turnInstruction.text,
        usage: result.usage ?? undefined,
        attempt: {
          started_at: callStarted,
          completed_at: new Date().toISOString(),
          latency_ms: result.latencyMs,
          retry_count: result.retryCount
        },
        error_message: null
      });
      transcript.push({
        turn: callInput.turn,
        turn_index: callInput.turn,
        round: callInput.round,
        slot: callInput.slotId,
        role: callInput.slotId,
        role_kind: assignment.role_kind,
        role_prompt_id: rolePrompt.id,
        role_prompt_sha256: rolePrompt.sha256,
        content
      });
      return { content, modelActual: result.model ?? null };
    }

    const errorMessage =
      error instanceof OpenRouterError
        ? error.message
        : error?.message ?? "OpenRouter request failed";
    const retryCount = error instanceof OpenRouterError ? error.retryCount : 0;
    const latencyMs = error instanceof OpenRouterError ? error.latencyMs ?? 0 : 0;
    const responsePayload = error instanceof OpenRouterError ? error.responseBody : undefined;
    const modelActual =
      error instanceof OpenRouterError ? extractActualModel(error.responseBody) : null;
    const timeoutCode = timeout.didTimeout() ? "timeout_exhausted" : undefined;

    calls.push({
      call_index: callInput.callIndex,
      turn: callInput.turn,
      role: callInput.slotId,
      model_requested: assignment.model_slug,
      model_actual: modelActual,
      request_payload: {
        ...(error instanceof OpenRouterError ? (error.requestPayload ?? {}) : {}),
        role_kind: assignment.role_kind,
        role_prompt_id: rolePrompt.id,
        role_prompt_sha256: rolePrompt.sha256,
        turn_instruction_id: turnInstruction.id,
        turn_instruction_sha256: turnInstruction.sha256
      },
      response_payload: asObject(responsePayload) ?? null,
      system_prompt_components: systemPromptComponents,
      turn_instruction_id: turnInstruction.id,
      turn_instruction_sha256: turnInstruction.sha256,
      turn_instruction_text: turnInstruction.text,
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

  let callIndex = 0;
  let turn = 0;
  let finalContent = "";
  let finalModel: string | null = null;

  for (let round = 1; round <= rounds; round += 1) {
    for (const slotId of slots) {
      const call = await runCall({
        callIndex,
        turn,
        round,
        slotId,
        isFinal: false
      });
      callIndex += 1;
      turn += 1;
      if (!call.content) {
        const trialRecord = buildFailureTrialRecord({
          entry,
          roleAssignments,
          calls,
          transcript,
          error: call.error,
          errorCode: call.errorCode ?? (context.shouldStop().stop ? "shutdown_abort" : null)
        });
        const parsedRecord: ArbiterParsedOutputRecord = {
          trial_id: entry.trial_id,
          parse_status: "failed",
          parser_version: "debate-v1"
        };
        attachParseSummary(trialRecord, parsedRecord);

        const embeddingRecord = buildSkippedEmbedding(entry.trial_id, "trial_not_success", emptyPreparation);
        const skipReason =
          embeddingRecord.embedding_status === "skipped" ? embeddingRecord.skip_reason : undefined;
        trialRecord.embedding = {
          status: "skipped",
          skip_reason: skipReason
        };

        bus.emit({ type: "trial.completed", payload: { trial_record: trialRecord } });
        bus.emit({ type: "parsed.output", payload: { parsed_record: parsedRecord } });
        bus.emit({ type: "embedding.recorded", payload: { embedding_record: embeddingRecord } });

        return { trial_id: entry.trial_id, embedding: { status: "skipped" as const } };
      }
    }
  }

  const finalCall = await runCall({
    callIndex,
    turn,
    round: rounds,
    slotId: slotA,
    isFinal: true
  });
  if (!finalCall.content) {
    const trialRecord = buildFailureTrialRecord({
      entry,
      roleAssignments,
      calls,
      transcript,
      error: finalCall.error,
      errorCode: finalCall.errorCode ?? (context.shouldStop().stop ? "shutdown_abort" : null)
    });
    const parsedRecord: ArbiterParsedOutputRecord = {
      trial_id: entry.trial_id,
      parse_status: "failed",
      parser_version: "debate-v1"
    };
    attachParseSummary(trialRecord, parsedRecord);

    const embeddingRecord = buildSkippedEmbedding(entry.trial_id, "trial_not_success", emptyPreparation);
    const skipReason =
      embeddingRecord.embedding_status === "skipped" ? embeddingRecord.skip_reason : undefined;
    trialRecord.embedding = {
      status: "skipped",
      skip_reason: skipReason
    };

    bus.emit({ type: "trial.completed", payload: { trial_record: trialRecord } });
    bus.emit({ type: "parsed.output", payload: { parsed_record: parsedRecord } });
    bus.emit({ type: "embedding.recorded", payload: { embedding_record: embeddingRecord } });

    return { trial_id: entry.trial_id, embedding: { status: "skipped" as const } };
  }

  finalContent = finalCall.content;
  finalModel = finalCall.modelActual ?? null;

  const parsedRecord = buildDebateParsedOutput(
    entry.trial_id,
    finalContent,
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
    actual_model: finalModel,
    protocol: "debate_v1",
    status: "success",
    assigned_config: entry.assigned_config,
    role_assignments: roleAssignments,
    calls,
    transcript,
    transcript_hash: sha256Hex(canonicalStringify(transcript)),
    ...(entry.debate ? { debate: entry.debate } : {}),
    raw_assistant_text: finalContent
  };
  attachParseSummary(trialRecord, parsedRecord);

  if (
    shouldExcludeContractFailure({
      contractParseFailure,
      contractFailurePolicy: context.contractFailurePolicy
    })
  ) {
    const embeddingRecord = buildSkippedEmbedding(entry.trial_id, "contract_parse_excluded", preparation);
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
    const embeddingRecord = buildSkippedEmbedding(entry.trial_id, "empty_embed_text", preparation);
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
