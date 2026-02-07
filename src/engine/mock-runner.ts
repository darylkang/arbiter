import { resolve } from "node:path";

import { finalizeEmbeddingsToArrow } from "../embeddings/finalize.js";
import type { EmbeddingsProvenance } from "../artifacts/embeddings-provenance.js";
import { EMBED_TEXT_NORMALIZATION } from "../core/constants.js";
import type { EventBus } from "../events/event-bus.js";
import type { ArbiterResolvedConfig } from "../generated/config.types.js";
import type { TrialPlanEntry } from "../planning/planner.js";
import {
  createMockTrialExecutor,
  type MockTrialExecutionState
} from "./mock-trial-executor.js";
import { runOrchestration, type RunOrchestrationResult } from "./run-orchestrator.js";

export interface MockRunOptions {
  bus: EventBus;
  runDir: string;
  resolvedConfig: ArbiterResolvedConfig;
  embeddingsJsonlPath: string;
  debugEnabled: boolean;
  contractFailurePolicy?: "warn" | "exclude" | "fail";
  embeddingDimensions?: number;
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

export interface MockRunResult extends RunOrchestrationResult {
  embeddingsProvenance: EmbeddingsProvenance;
}

export const runMock = async (options: MockRunOptions): Promise<MockRunResult> => {
  const embeddingDimensions = options.embeddingDimensions ?? 4;
  const delayMs = Number(process.env.ARBITER_MOCK_DELAY_MS ?? 0);
  const forceEmptyEmbedText = process.env.ARBITER_MOCK_EMPTY_EMBED === "1";

  return runOrchestration<MockTrialExecutionState>({
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
      embeddingGenerationIds: new Set<string>()
    }),
    createExecutor: (context) =>
      createMockTrialExecutor({
        bus: context.bus,
        resolvedConfig: context.resolvedConfig,
        embeddingDimensions,
        embeddingMaxChars: context.embeddingMaxChars,
        forceEmptyEmbedText,
        delayMs,
        hasDecisionContract: context.hasDecisionContract,
        contractFailurePolicy: context.contractFailurePolicy,
        state: context.state
      }),
    finalizeEmbeddings: async (context) => {
      const generationIds = Array.from(context.state.embeddingGenerationIds);
      const provenanceMeta = {
        requestedEmbeddingModel: context.resolvedConfig.measurement.embedding_model,
        actualEmbeddingModel: null,
        generationIds,
        embedTextStrategy: context.resolvedConfig.measurement.embed_text_strategy,
        normalization: EMBED_TEXT_NORMALIZATION
      };

      if (context.eligible === 0) {
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
            actual_embedding_model: provenanceMeta.actualEmbeddingModel,
            generation_ids: generationIds.length > 0 ? generationIds : undefined,
            embed_text_strategy: provenanceMeta.embedTextStrategy,
            normalization: provenanceMeta.normalization
          }
        };
      }

      const finalizeResult = await finalizeEmbeddingsToArrow({
        runDir: context.runDir,
        dimensions: embeddingDimensions,
        debugJsonlPath: context.embeddingsJsonlPath,
        provenance: provenanceMeta
      });

      return {
        provenance: finalizeResult.provenance,
        embeddingsArrowPath:
          finalizeResult.provenance.status === "arrow_generated"
            ? resolve(context.runDir, "embeddings.arrow")
            : undefined
      };
    }
  });
};
