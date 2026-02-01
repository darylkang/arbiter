import type { ArbiterResolvedConfig } from "../generated/config.types.js";
import type { ArbiterRunManifest } from "../generated/manifest.types.js";
import type { ArbiterTrialRecord } from "../generated/trial.types.js";
import type { ArbiterParsedOutputRecord } from "../generated/parsed-output.types.js";
import type { ArbiterDebugEmbeddingJSONLRecord } from "../generated/embedding.types.js";
import type { ArbiterConvergenceTraceRecord } from "../generated/convergence-trace.types.js";
import type { ArbiterAggregates } from "../generated/aggregates.types.js";
import type { ArbiterOnlineClusterAssignmentRecord } from "../generated/cluster-assignment.types.js";
import type { ArbiterOnlineClusteringState } from "../generated/cluster-state.types.js";
import type { EmbeddingsProvenance } from "../artifacts/embeddings-provenance.js";

export type RunStartedPayload = {
  run_id: string;
  started_at: string;
  resolved_config: ArbiterResolvedConfig;
  debug_enabled: boolean;
  plan_sha256?: string;
  k_planned?: number;
};

export type RunCompletedPayload = {
  run_id: string;
  completed_at: string;
  stop_reason: "completed" | "error" | "user_interrupt" | "k_max_reached" | "converged";
  incomplete: boolean;
};

export type RunFailedPayload = {
  run_id: string;
  completed_at: string;
  error: string;
};

export type BatchStartedPayload = {
  batch_number: number;
  trial_ids: number[];
};

export type BatchCompletedPayload = {
  batch_number: number;
  trial_ids: number[];
  elapsed_ms: number;
};

export type TrialPlannedPayload = {
  trial_id: number;
  protocol: ArbiterTrialRecord["protocol"];
  assigned_config: ArbiterTrialRecord["assigned_config"];
  role_assignments?: ArbiterTrialRecord["role_assignments"];
};

export type TrialCompletedPayload = {
  trial_record: ArbiterTrialRecord;
};

export type ParsedOutputProducedPayload = {
  parsed_record: ArbiterParsedOutputRecord;
};

export type EmbeddingRecordedPayload = {
  embedding_record: ArbiterDebugEmbeddingJSONLRecord;
};

export type EmbeddingsFinalizedPayload = {
  provenance: EmbeddingsProvenance;
};

export type ClusterAssignedPayload = {
  assignment: ArbiterOnlineClusterAssignmentRecord;
};

export type ClusterStatePayload = {
  state: ArbiterOnlineClusteringState;
};

export type ConvergenceRecordPayload = {
  convergence_record: ArbiterConvergenceTraceRecord;
};

export type AggregatesComputedPayload = {
  aggregates: ArbiterAggregates;
};

export type ManifestUpdatedPayload = {
  manifest: ArbiterRunManifest;
};

export type Event =
  | { type: "run.started"; payload: RunStartedPayload }
  | { type: "run.completed"; payload: RunCompletedPayload }
  | { type: "run.failed"; payload: RunFailedPayload }
  | { type: "batch.started"; payload: BatchStartedPayload }
  | { type: "batch.completed"; payload: BatchCompletedPayload }
  | { type: "trial.planned"; payload: TrialPlannedPayload }
  | { type: "trial.completed"; payload: TrialCompletedPayload }
  | { type: "parsed.output"; payload: ParsedOutputProducedPayload }
  | { type: "embedding.recorded"; payload: EmbeddingRecordedPayload }
  | { type: "embeddings.finalized"; payload: EmbeddingsFinalizedPayload }
  | { type: "cluster.assigned"; payload: ClusterAssignedPayload }
  | { type: "clusters.state"; payload: ClusterStatePayload }
  | { type: "convergence.record"; payload: ConvergenceRecordPayload }
  | { type: "aggregates.computed"; payload: AggregatesComputedPayload }
  | { type: "manifest.updated"; payload: ManifestUpdatedPayload };

export type EventType = Event["type"];
