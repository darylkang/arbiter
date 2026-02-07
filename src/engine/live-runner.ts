import { resolve } from "node:path";

import { finalizeEmbeddingsToArrow } from "../artifacts/embeddings.js";
import type { EmbeddingsProvenance } from "../artifacts/embeddings-provenance.js";
import { EMBED_TEXT_NORMALIZATION } from "../core/constants.js";
import type { EventBus } from "../events/event-bus.js";
import type { ArbiterResolvedConfig } from "../generated/config.types.js";
import type { TrialPlanEntry } from "../planning/planner.js";
import {
  createLiveTrialExecutor,
  type LiveTrialExecutionState
} from "./live-trial-executor.js";
import { runOrchestration, type RunOrchestrationResult } from "./run-orchestrator.js";

export interface LiveRunOptions {
  bus: EventBus;
  runDir: string;
  resolvedConfig: ArbiterResolvedConfig;
  embeddingsJsonlPath: string;
  debugEnabled: boolean;
  contractFailurePolicy?: "warn" | "exclude" | "fail";
  beforeFinalize?: () => Promise<void>;
  stop?: {
    shouldStop: () => boolean;
  };
  shutdown?: {
    signal: AbortSignal;
    isRequested: () => boolean;
  };
  precomputedPlan?: {
    plan: ReadonlyArray<Readonly<TrialPlanEntry>>;
    planSha256: string;
  };
}

export interface LiveRunResult extends RunOrchestrationResult {
  embeddingsProvenance: EmbeddingsProvenance;
}

export const runLive = async (options: LiveRunOptions): Promise<LiveRunResult> => {
  const personaMap = new Map(
    options.resolvedConfig.sampling.personas.map((persona) => [persona.persona, persona])
  );
  const protocolMap = new Map(
    options.resolvedConfig.sampling.protocols.map((protocol) => [protocol.protocol, protocol])
  );

  return runOrchestration<LiveTrialExecutionState>({
    bus: options.bus,
    runDir: options.runDir,
    resolvedConfig: options.resolvedConfig,
    embeddingsJsonlPath: options.embeddingsJsonlPath,
    debugEnabled: options.debugEnabled,
    contractFailurePolicy: options.contractFailurePolicy,
    beforeFinalize: options.beforeFinalize,
    stop: options.stop,
    shutdown: options.shutdown,
    precomputedPlan: options.precomputedPlan,
    createState: () => ({
      contractFailures: {
        fallback: 0,
        failed: 0
      },
      embeddingDimensions: null,
      actualEmbeddingModel: null,
      embeddingModelConflict: false,
      embeddingGenerationIds: new Set<string>()
    }),
    createExecutor: (context) =>
      createLiveTrialExecutor({
        bus: context.bus,
        resolvedConfig: context.resolvedConfig,
        personaMap,
        protocolMap,
        embeddingMaxChars: context.embeddingMaxChars,
        hasDecisionContract: context.hasDecisionContract,
        contractFailurePolicy: context.contractFailurePolicy,
        shouldStop: context.shouldStop,
        abortSignal: context.abortSignal,
        state: context.state
      }),
    finalizeEmbeddings: async (context) => {
      const provenanceMeta = {
        requestedEmbeddingModel: context.resolvedConfig.measurement.embedding_model,
        actualEmbeddingModel: context.state.actualEmbeddingModel,
        generationIds: Array.from(context.state.embeddingGenerationIds),
        embedTextStrategy: context.resolvedConfig.measurement.embed_text_strategy,
        normalization: EMBED_TEXT_NORMALIZATION
      };

      if (context.state.embeddingDimensions === null) {
        return {
          provenance: {
            schema_version: "1.0.0",
            status: "not_generated",
            reason: "no_successful_embeddings",
            intended_primary_format: "arrow_ipc_file",
            primary_format: "none",
            dtype: "float32",
            dimensions: null,
            note: "No successful embeddings; arrow file not generated",
            requested_embedding_model: provenanceMeta.requestedEmbeddingModel,
            actual_embedding_model: provenanceMeta.actualEmbeddingModel ?? null,
            generation_ids:
              provenanceMeta.generationIds.length > 0 ? provenanceMeta.generationIds : undefined,
            embed_text_strategy: provenanceMeta.embedTextStrategy,
            normalization: provenanceMeta.normalization
          }
        };
      }

      const finalizeResult = await finalizeEmbeddingsToArrow({
        runDir: context.runDir,
        dimensions: context.state.embeddingDimensions,
        debugJsonlPath: context.embeddingsJsonlPath,
        provenance: provenanceMeta
      });
      const embeddingsArrowPath =
        finalizeResult.provenance.status === "arrow_generated"
          ? resolve(context.runDir, "embeddings.arrow")
          : undefined;

      return {
        provenance: finalizeResult.provenance,
        embeddingsArrowPath
      };
    }
  });
};
