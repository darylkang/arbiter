import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

import type { EventBus } from "../events/event-bus.js";
import type {
  AggregatesComputedPayload,
  ArtifactWrittenPayload,
  ClusterAssignedPayload,
  ClusterStatePayload,
  ConvergenceRecordPayload,
  EmbeddingRecordedPayload,
  EmbeddingsFinalizedPayload,
  ParsedOutputProducedPayload,
  RunCompletedPayload,
  RunFailedPayload,
  RunStartedPayload,
  TrialPlannedPayload,
  TrialCompletedPayload
} from "../events/types.js";
import {
  formatAjvErrors,
  validateAggregates,
  validateConvergenceTrace,
  validateEmbedding,
  validateEmbeddingsProvenance,
  validateClusterAssignment,
  validateClusterState,
  validateManifest,
  validateParsedOutput,
  validateTrialPlan,
  validateTrial
} from "../config/schema-validation.js";
import type { ArbiterResolvedConfig } from "../generated/config.types.js";
import type { ArbiterRunManifest } from "../generated/manifest.types.js";
import type { ArbiterTrialPlanRecord } from "../generated/trial-plan.types.js";
import type { RunPolicySnapshot } from "../config/policy.js";
import { createJsonlWriter, writeJsonAtomic, type JsonlWriter } from "./io.js";
import { EMBED_TEXT_NORMALIZATION } from "../core/constants.js";
import type { EmbeddingsProvenance } from "./embeddings-provenance.js";
import {
  applyContractFailurePolicy,
  buildArtifactEntries,
  buildInitialManifest,
  type ArtifactCounts
} from "./manifest-builder.js";
import { UsageTracker } from "./usage-tracker.js";

export interface ArtifactWriterOptions {
  runDir: string;
  runId: string;
  resolvedConfig: ArbiterResolvedConfig;
  debugEnabled: boolean;
  embeddingsJsonlPath?: string;
  catalogVersion: string;
  catalogSha256: string;
  promptManifestSha256: string;
  packageJsonPath?: string;
  validateArtifacts?: boolean;
  policy?: RunPolicySnapshot;
}

const assertValid = (name: string, valid: boolean, errors: unknown): void => {
  if (valid) {
    return;
  }
  const formatted = formatAjvErrors(name, errors as never);
  const message = formatted.length > 0 ? formatted.join("\n") : `${name} is invalid`;
  throw new Error(message);
};

export class ArtifactWriter {
  private readonly runDir: string;
  private readonly debugEnabled: boolean;
  private readonly resolvedConfig: ArbiterResolvedConfig;
  private readonly catalogVersion: string;
  private readonly catalogSha256: string;
  private readonly promptManifestSha256: string;
  private readonly packageJsonPath: string;
  private readonly validateArtifacts: boolean;
  private readonly clusteringEnabled: boolean;
  private readonly policy?: RunPolicySnapshot;
  private manifest: ArbiterRunManifest | null = null;
  private embeddingsProvenance: EmbeddingsProvenance | null = null;
  private readonly trialPlanWriter: JsonlWriter;
  private readonly trialsWriter: JsonlWriter;
  private readonly parsedWriter: JsonlWriter;
  private readonly convergenceWriter: JsonlWriter;
  private readonly embeddingsWriter?: JsonlWriter;
  private readonly clusterAssignmentsWriter?: JsonlWriter;
  private readonly extraArtifacts = new Map<string, { path: string; record_count?: number }>();
  private manifestFinalized = false;
  private readonly counts: ArtifactCounts = {
    trialPlan: 0,
    trials: 0,
    parsed: 0,
    convergence: 0,
    embeddings: 0,
    embeddingSuccess: 0,
    embeddingFailed: 0,
    embeddingSkipped: 0,
    clusterAssignments: 0
  };
  private readonly usageTracker = new UsageTracker();
  private readonly trialStatusById = new Map<number, TrialCompletedPayload["trial_record"]["status"]>();
  private readonly contractParseCounts = {
    fallback: 0,
    failed: 0
  };
  private readonly unsubs: Array<() => void> = [];
  private closed = false;

  constructor(options: ArtifactWriterOptions) {
    this.runDir = options.runDir;
    this.debugEnabled = options.debugEnabled;
    this.resolvedConfig = options.resolvedConfig;
    this.catalogVersion = options.catalogVersion;
    this.catalogSha256 = options.catalogSha256;
    this.promptManifestSha256 = options.promptManifestSha256;
    this.packageJsonPath = resolve(options.packageJsonPath ?? "package.json");
    this.validateArtifacts = options.validateArtifacts ?? true;
    this.policy = options.policy;
    this.clusteringEnabled =
      this.resolvedConfig.measurement.clustering.enabled &&
      this.resolvedConfig.measurement.clustering.stop_mode !== "disabled";

    this.trialPlanWriter = createJsonlWriter(resolve(this.runDir, "trial_plan.jsonl"));
    this.trialsWriter = createJsonlWriter(resolve(this.runDir, "trials.jsonl"));
    this.parsedWriter = createJsonlWriter(resolve(this.runDir, "parsed.jsonl"));
    this.convergenceWriter = createJsonlWriter(resolve(this.runDir, "convergence_trace.jsonl"));
    if (options.embeddingsJsonlPath) {
      this.embeddingsWriter = createJsonlWriter(options.embeddingsJsonlPath);
    }
    if (this.clusteringEnabled) {
      const clustersDir = resolve(this.runDir, "clusters");
      mkdirSync(clustersDir, { recursive: true });
      this.clusterAssignmentsWriter = createJsonlWriter(
        resolve(clustersDir, "online.assignments.jsonl")
      );
    }
  }

  attach(bus: EventBus): void {
    this.unsubs.push(
      bus.subscribeSafe(
        "run.started",
        (payload) => this.onRunStarted(payload),
        (error) => this.onSubscriberError(bus, "run.started", error)
      ),
      bus.subscribeSafe(
        "trial.planned",
        (payload) => this.onTrialPlanned(payload),
        (error) => this.onSubscriberError(bus, "trial.planned", error)
      ),
      bus.subscribeSafe(
        "trial.completed",
        (payload) => this.onTrialCompleted(payload),
        (error) => this.onSubscriberError(bus, "trial.completed", error)
      ),
      bus.subscribeSafe(
        "parsed.output",
        (payload) => this.onParsedOutput(payload),
        (error) => this.onSubscriberError(bus, "parsed.output", error)
      ),
      bus.subscribeSafe(
        "embedding.recorded",
        (payload) => this.onEmbeddingRecorded(payload),
        (error) => this.onSubscriberError(bus, "embedding.recorded", error)
      ),
      bus.subscribeSafe(
        "convergence.record",
        (payload) => this.onConvergenceRecord(payload),
        (error) => this.onSubscriberError(bus, "convergence.record", error)
      ),
      bus.subscribeSafe(
        "cluster.assigned",
        (payload) => this.onClusterAssigned(payload),
        (error) => this.onSubscriberError(bus, "cluster.assigned", error)
      ),
      bus.subscribeSafe(
        "clusters.state",
        (payload) => this.onClusterState(payload),
        (error) => this.onSubscriberError(bus, "clusters.state", error)
      ),
      bus.subscribeSafe(
        "aggregates.computed",
        (payload) => this.onAggregatesComputed(payload),
        (error) => this.onSubscriberError(bus, "aggregates.computed", error)
      ),
      bus.subscribeSafe(
        "embeddings.finalized",
        (payload) => this.onEmbeddingsFinalized(payload),
        (error) => this.onSubscriberError(bus, "embeddings.finalized", error)
      ),
      bus.subscribeSafe(
        "artifact.written",
        (payload) => this.onArtifactWritten(payload),
        (error) => this.onSubscriberError(bus, "artifact.written", error)
      ),
      bus.subscribeSafe(
        "run.completed",
        (payload) => this.onRunCompleted(payload),
        (error) => this.onSubscriberError(bus, "run.completed", error)
      ),
      bus.subscribeSafe(
        "run.failed",
        (payload) => this.onRunFailed(payload),
        (error) => this.onSubscriberError(bus, "run.failed", error)
      )
    );
  }

  private onSubscriberError(bus: EventBus, eventType: string, error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    bus.emit({
      type: "warning.raised",
      payload: {
        message: `ArtifactWriter handler failed for ${eventType}: ${message}`,
        source: "artifacts",
        recorded_at: new Date().toISOString()
      }
    });
  }

  detach(): void {
    this.unsubs.splice(0).forEach((unsub) => unsub());
  }

  async close(): Promise<void> {
    if (this.closed) {
      return;
    }
    this.closed = true;
    const closers = [
      this.trialPlanWriter,
      this.trialsWriter,
      this.parsedWriter,
      this.convergenceWriter
    ].map((writer) => writer.close());
    if (this.embeddingsWriter) {
      closers.push(this.embeddingsWriter.close());
    }
    if (this.clusterAssignmentsWriter) {
      closers.push(this.clusterAssignmentsWriter.close());
    }
    await Promise.all(closers);
  }

  private onRunStarted(payload: RunStartedPayload): void {
    writeJsonAtomic(resolve(this.runDir, "config.resolved.json"), payload.resolved_config);
    this.manifest = buildInitialManifest({
      payload,
      resolvedConfig: this.resolvedConfig,
      catalogVersion: this.catalogVersion,
      catalogSha256: this.catalogSha256,
      promptManifestSha256: this.promptManifestSha256,
      packageJsonPath: this.packageJsonPath,
      policy: this.policy
    });
    writeJsonAtomic(resolve(this.runDir, "manifest.json"), this.manifest);
  }

  private onTrialPlanned(payload: TrialPlannedPayload): void {
    const record: ArbiterTrialPlanRecord = {
      trial_id: payload.trial_id,
      protocol: payload.protocol,
      assigned_config: payload.assigned_config,
      ...(payload.role_assignments ? { role_assignments: payload.role_assignments } : {})
    };
    if (this.validateArtifacts) {
      assertValid("trial plan", validateTrialPlan(record), validateTrialPlan.errors);
    }
    this.trialPlanWriter.append(record);
    this.counts.trialPlan += 1;
  }

  private onTrialCompleted(payload: TrialCompletedPayload): void {
    if (this.validateArtifacts) {
      assertValid("trial", validateTrial(payload.trial_record), validateTrial.errors);
    }
    this.trialsWriter.append(payload.trial_record);
    this.counts.trials += 1;
    if (this.resolvedConfig.protocol.decision_contract) {
      this.trialStatusById.set(payload.trial_record.trial_id, payload.trial_record.status);
    }
    this.usageTracker.ingestTrial(payload.trial_record);
  }

  private onParsedOutput(payload: ParsedOutputProducedPayload): void {
    if (this.validateArtifacts) {
      assertValid("parsed output", validateParsedOutput(payload.parsed_record), validateParsedOutput.errors);
    }
    this.parsedWriter.append(payload.parsed_record);
    this.counts.parsed += 1;
    const status = payload.parsed_record.parse_status;
    if (this.resolvedConfig.protocol.decision_contract) {
      const trialStatus = this.trialStatusById.get(payload.parsed_record.trial_id);
      if (trialStatus === "success") {
        if (status === "fallback") {
          this.contractParseCounts.fallback += 1;
        } else if (status === "failed") {
          this.contractParseCounts.failed += 1;
        }
      }
    }
    this.trialStatusById.delete(payload.parsed_record.trial_id);
  }

  private onEmbeddingRecorded(payload: EmbeddingRecordedPayload): void {
    if (!this.embeddingsWriter) {
      throw new Error("Embeddings writer is not configured");
    }
    if (this.validateArtifacts) {
      assertValid("embedding record", validateEmbedding(payload.embedding_record), validateEmbedding.errors);
    }
    this.embeddingsWriter.append(payload.embedding_record);
    this.counts.embeddings += 1;
    if (payload.embedding_record.embedding_status === "success") {
      this.counts.embeddingSuccess += 1;
    } else if (payload.embedding_record.embedding_status === "failed") {
      this.counts.embeddingFailed += 1;
    } else {
      this.counts.embeddingSkipped += 1;
    }
  }

  private onConvergenceRecord(payload: ConvergenceRecordPayload): void {
    if (this.validateArtifacts) {
      assertValid(
        "convergence trace",
        validateConvergenceTrace(payload.convergence_record),
        validateConvergenceTrace.errors
      );
    }
    this.convergenceWriter.append(payload.convergence_record);
    this.counts.convergence += 1;
  }

  private onClusterAssigned(payload: ClusterAssignedPayload): void {
    if (!this.clusterAssignmentsWriter) {
      throw new Error("Cluster assignments writer is not configured");
    }
    if (this.validateArtifacts) {
      assertValid(
        "cluster assignment",
        validateClusterAssignment(payload.assignment),
        validateClusterAssignment.errors
      );
    }
    this.clusterAssignmentsWriter.append(payload.assignment);
    this.counts.clusterAssignments += 1;
  }

  private onClusterState(payload: ClusterStatePayload): void {
    if (!this.clusteringEnabled) {
      return;
    }
    if (this.validateArtifacts) {
      assertValid("cluster state", validateClusterState(payload.state), validateClusterState.errors);
    }
    writeJsonAtomic(resolve(this.runDir, "clusters/online.state.json"), payload.state);
  }

  private onAggregatesComputed(payload: AggregatesComputedPayload): void {
    if (this.validateArtifacts) {
      assertValid("aggregates", validateAggregates(payload.aggregates), validateAggregates.errors);
    }
    writeJsonAtomic(resolve(this.runDir, "aggregates.json"), payload.aggregates);
  }

  private onEmbeddingsFinalized(payload: EmbeddingsFinalizedPayload): void {
    if (this.validateArtifacts) {
      assertValid(
        "embeddings provenance",
        validateEmbeddingsProvenance(payload.provenance),
        validateEmbeddingsProvenance.errors
      );
    }
    this.embeddingsProvenance = payload.provenance;
    writeJsonAtomic(resolve(this.runDir, "embeddings.provenance.json"), payload.provenance);
  }

  private onArtifactWritten(payload: ArtifactWrittenPayload): void {
    this.extraArtifacts.set(payload.path, { path: payload.path, record_count: payload.record_count });
    if (this.manifestFinalized && this.manifest) {
      this.manifest.artifacts = {
        entries: buildArtifactEntries({
          debugEnabled: this.debugEnabled,
          clusteringEnabled: this.clusteringEnabled,
          counts: this.counts,
          embeddingsProvenance: this.embeddingsProvenance,
          extraArtifacts: this.extraArtifacts.values()
        })
      };
      if (this.validateArtifacts) {
        assertValid("manifest", validateManifest(this.manifest), validateManifest.errors);
      }
      writeJsonAtomic(resolve(this.runDir, "manifest.json"), this.manifest);
    }
  }

  private ensureEmbeddingsProvenance(reason: string): void {
    if (this.embeddingsProvenance) {
      return;
    }
    const provenance: EmbeddingsProvenance = {
      schema_version: "1.0.0",
      status: "not_generated",
      reason,
      intended_primary_format: "arrow_ipc_file",
      primary_format: "none",
      dtype: "float32",
      dimensions: null,
      requested_embedding_model: this.resolvedConfig.measurement.embedding_model,
      actual_embedding_model: null,
      embed_text_strategy: this.resolvedConfig.measurement.embed_text_strategy,
      normalization: EMBED_TEXT_NORMALIZATION,
      generation_ids: []
    };
    if (this.validateArtifacts) {
      assertValid(
        "embeddings provenance",
        validateEmbeddingsProvenance(provenance),
        validateEmbeddingsProvenance.errors
      );
    }
    this.embeddingsProvenance = provenance;
    writeJsonAtomic(resolve(this.runDir, "embeddings.provenance.json"), provenance);
  }

  private onRunCompleted(payload: RunCompletedPayload): void {
    if (!this.manifest) {
      throw new Error("Manifest is not initialized");
    }
    this.ensureEmbeddingsProvenance("no_embeddings_generated");

    const completedAt = payload.completed_at;
    this.manifest.completed_at = completedAt;
    this.manifest.timestamps = {
      started_at: this.manifest.started_at,
      completed_at: completedAt
    };
    this.manifest.stop_reason = payload.stop_reason;
    this.manifest.incomplete = payload.incomplete;

    applyContractFailurePolicy({
      manifest: this.manifest,
      resolvedConfig: this.resolvedConfig,
      policy: this.policy,
      contractParseCounts: this.contractParseCounts
    });

    this.manifest.k_attempted = this.counts.trials;
    this.manifest.k_eligible = this.counts.embeddingSuccess;

    const usage = this.usageTracker.buildSummary();
    if (usage) {
      this.manifest.usage = usage;
    }

    this.manifest.artifacts = {
      entries: buildArtifactEntries({
        debugEnabled: this.debugEnabled,
        clusteringEnabled: this.clusteringEnabled,
        counts: this.counts,
        embeddingsProvenance: this.embeddingsProvenance,
        extraArtifacts: this.extraArtifacts.values()
      })
    };

    this.manifestFinalized = true;
    if (this.validateArtifacts) {
      assertValid("manifest", validateManifest(this.manifest), validateManifest.errors);
    }
    writeJsonAtomic(resolve(this.runDir, "manifest.json"), this.manifest);
  }

  private onRunFailed(payload: RunFailedPayload): void {
    if (!this.manifest) {
      throw new Error("Manifest is not initialized");
    }
    this.ensureEmbeddingsProvenance("run_failed_before_embeddings");

    const completedAt = payload.completed_at;
    this.manifest.completed_at = completedAt;
    this.manifest.timestamps = {
      started_at: this.manifest.started_at,
      completed_at: completedAt
    };
    this.manifest.stop_reason = "error";
    this.manifest.incomplete = true;
    this.manifest.notes = payload.error;
    this.manifest.k_attempted = this.counts.trials;
    this.manifest.k_eligible = this.counts.embeddingSuccess;

    const usage = this.usageTracker.buildSummary();
    if (usage) {
      this.manifest.usage = usage;
    }

    this.manifest.artifacts = {
      entries: buildArtifactEntries({
        debugEnabled: this.debugEnabled,
        clusteringEnabled: this.clusteringEnabled,
        counts: this.counts,
        embeddingsProvenance: this.embeddingsProvenance,
        extraArtifacts: this.extraArtifacts.values()
      })
    };

    this.manifestFinalized = true;
    if (this.validateArtifacts) {
      assertValid("manifest", validateManifest(this.manifest), validateManifest.errors);
    }
    writeJsonAtomic(resolve(this.runDir, "manifest.json"), this.manifest);
  }
}
