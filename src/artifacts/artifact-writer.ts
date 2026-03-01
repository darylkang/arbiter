import { existsSync, mkdirSync, renameSync, writeFileSync } from "node:fs";
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
  validateConvergenceTrace,
  validateEmbedding,
  validateManifest,
  validateParsedOutput,
  validateTrialPlan,
  validateTrial,
  validateClusterAssignment,
  validateClusterState
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
  sourceConfig: ArbiterResolvedConfig;
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

const stopReasonLabel = (reason: string): string => {
  switch (reason) {
    case "converged":
      return "Stopped: novelty saturation";
    case "k_max_reached":
      return "Stopped: max trials reached";
    case "user_interrupt":
      return "Stopped: user requested graceful stop";
    case "completed":
      return "Stopped: sampling complete";
    default:
      return "Stopped: run failed";
  }
};

const writeTextAtomic = (path: string, text: string): void => {
  const tmpPath = `${path}.tmp`;
  writeFileSync(tmpPath, text, "utf8");
  renameSync(tmpPath, path);
};

export class ArtifactWriter {
  private readonly runDir: string;
  private readonly debugEnabled: boolean;
  private readonly sourceConfig: ArbiterResolvedConfig;
  private readonly resolvedConfig: ArbiterResolvedConfig;
  private readonly catalogVersion: string;
  private readonly catalogSha256: string;
  private readonly promptManifestSha256: string;
  private readonly packageJsonPath: string;
  private readonly validateArtifacts: boolean;
  private readonly groupingEnabled: boolean;
  private readonly policy?: RunPolicySnapshot;
  private manifest: ArbiterRunManifest | null = null;
  private embeddingsProvenance: EmbeddingsProvenance | null = null;
  private latestMonitoring: ConvergenceRecordPayload["convergence_record"] | null = null;
  private latestAggregates: Record<string, unknown> | null = null;

  private readonly trialPlanWriter: JsonlWriter;
  private readonly trialsWriter: JsonlWriter;
  private readonly monitoringWriter: JsonlWriter;
  private readonly embeddingsWriter?: JsonlWriter;
  private readonly groupAssignmentsWriter?: JsonlWriter;
  private readonly extraArtifacts = new Map<string, { path: string; record_count?: number }>();
  private manifestFinalized = false;
  private readonly counts: ArtifactCounts = {
    trialPlan: 0,
    trials: 0,
    monitoring: 0,
    embeddings: 0,
    embeddingSuccess: 0,
    embeddingFailed: 0,
    embeddingSkipped: 0,
    groupAssignments: 0
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
    this.sourceConfig = options.sourceConfig;
    this.resolvedConfig = options.resolvedConfig;
    this.catalogVersion = options.catalogVersion;
    this.catalogSha256 = options.catalogSha256;
    this.promptManifestSha256 = options.promptManifestSha256;
    this.packageJsonPath = resolve(options.packageJsonPath ?? "package.json");
    this.validateArtifacts = options.validateArtifacts ?? true;
    this.policy = options.policy;
    this.groupingEnabled =
      this.resolvedConfig.measurement.clustering.enabled &&
      this.resolvedConfig.measurement.clustering.stop_mode !== "disabled";

    this.trialPlanWriter = createJsonlWriter(resolve(this.runDir, "trial_plan.jsonl"));
    this.trialsWriter = createJsonlWriter(resolve(this.runDir, "trials.jsonl"));
    this.monitoringWriter = createJsonlWriter(resolve(this.runDir, "monitoring.jsonl"));

    if (options.embeddingsJsonlPath) {
      this.embeddingsWriter = createJsonlWriter(options.embeddingsJsonlPath);
    }

    if (this.groupingEnabled) {
      const groupsDir = resolve(this.runDir, "groups");
      mkdirSync(groupsDir, { recursive: true });
      this.groupAssignmentsWriter = createJsonlWriter(resolve(groupsDir, "assignments.jsonl"));
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

    const closers = [this.trialPlanWriter, this.trialsWriter, this.monitoringWriter].map((writer) =>
      writer.close()
    );

    if (this.embeddingsWriter) {
      closers.push(this.embeddingsWriter.close());
    }
    if (this.groupAssignmentsWriter) {
      closers.push(this.groupAssignmentsWriter.close());
    }

    await Promise.all(closers);
  }

  private onRunStarted(payload: RunStartedPayload): void {
    writeJsonAtomic(resolve(this.runDir, "config.source.json"), this.sourceConfig);
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

    this.manifest.artifacts = {
      entries: buildArtifactEntries({
        debugEnabled: this.debugEnabled,
        clusteringEnabled: this.groupingEnabled,
        counts: this.counts,
        embeddingsProvenance: this.embeddingsProvenance,
        extraArtifacts: this.extraArtifacts.values()
      })
    };

    writeJsonAtomic(resolve(this.runDir, "manifest.json"), this.manifest);
  }

  private onTrialPlanned(payload: TrialPlannedPayload): void {
    const record: ArbiterTrialPlanRecord = {
      trial_id: payload.trial_id,
      protocol: payload.protocol,
      assigned_config: payload.assigned_config,
      ...(payload.role_assignments ? { role_assignments: payload.role_assignments } : {}),
      ...(payload.debate ? { debate: payload.debate } : {})
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
        "monitoring",
        validateConvergenceTrace(payload.convergence_record),
        validateConvergenceTrace.errors
      );
    }

    this.latestMonitoring = payload.convergence_record;
    this.monitoringWriter.append(payload.convergence_record);
    this.counts.monitoring += 1;
  }

  private onClusterAssigned(payload: ClusterAssignedPayload): void {
    if (!this.groupAssignmentsWriter) {
      return;
    }

    if (this.validateArtifacts) {
      assertValid(
        "group assignment",
        validateClusterAssignment(payload.assignment),
        validateClusterAssignment.errors
      );
    }

    this.groupAssignmentsWriter.append(payload.assignment);
    this.counts.groupAssignments += 1;
  }

  private onClusterState(payload: ClusterStatePayload): void {
    if (!this.groupingEnabled) {
      return;
    }

    if (this.validateArtifacts) {
      assertValid("group state", validateClusterState(payload.state), validateClusterState.errors);
    }

    writeJsonAtomic(resolve(this.runDir, "groups/state.json"), payload.state);
  }

  private onAggregatesComputed(payload: AggregatesComputedPayload): void {
    this.latestAggregates = payload.aggregates as unknown as Record<string, unknown>;
  }

  private onEmbeddingsFinalized(payload: EmbeddingsFinalizedPayload): void {
    this.embeddingsProvenance = payload.provenance;
  }

  private onArtifactWritten(payload: ArtifactWrittenPayload): void {
    this.extraArtifacts.set(payload.path, { path: payload.path, record_count: payload.record_count });

    if (this.manifestFinalized && this.manifest) {
      this.manifest.artifacts = {
        entries: buildArtifactEntries({
          debugEnabled: this.debugEnabled,
          clusteringEnabled: this.groupingEnabled,
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

    this.embeddingsProvenance = {
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
  }

  private renderReceiptText(payload: {
    stopReason: string;
    incomplete: boolean;
    completedAt: string;
  }): string {
    if (!this.manifest) {
      throw new Error("Manifest is not initialized");
    }

    const started = new Date(this.manifest.started_at).getTime();
    const completed = new Date(payload.completedAt).getTime();
    const durationMs = Number.isFinite(started) && Number.isFinite(completed) ? Math.max(0, completed - started) : 0;
    const durationSeconds = Math.floor(durationMs / 1000);

    const usage = this.manifest.usage?.totals;
    const usageLine = usage
      ? `Usage tokens: in ${usage.prompt_tokens}, out ${usage.completion_tokens}, total ${usage.total_tokens}`
      : "Usage tokens: not available";

    const protocolSummary =
      this.resolvedConfig.protocol.type === "debate_v1"
        ? `Debate (${this.resolvedConfig.protocol.participants ?? 2} participants, ${this.resolvedConfig.protocol.rounds ?? 1} rounds)`
        : "Independent";

    const artifactLines = (this.manifest.artifacts?.entries ?? [])
      .map((entry) => entry.path)
      .filter((path) => existsSync(resolve(this.runDir, path)));

    if (artifactLines.length === 0) {
      artifactLines.push("(no artifacts found)");
    }

    const lines: string[] = [];
    lines.push(stopReasonLabel(payload.stopReason));
    lines.push("Stopping indicates diminishing novelty, not correctness.");
    lines.push("");
    lines.push("Summary:");
    lines.push(`- stop reason: ${payload.stopReason}${payload.incomplete ? " (incomplete)" : ""}`);
    lines.push(`- trials planned/completed/eligible: ${this.manifest.k_planned ?? 0}/${this.manifest.k_attempted}/${this.manifest.k_eligible}`);
    lines.push(`- duration: ${durationSeconds}s`);
    lines.push(`- protocol: ${protocolSummary}`);
    lines.push(`- models: ${this.resolvedConfig.sampling.models.length}, personas: ${this.resolvedConfig.sampling.personas.length}`);
    lines.push(`- ${usageLine}`);

    if (this.resolvedConfig.measurement.clustering.enabled) {
      const groupCount = typeof this.latestMonitoring?.cluster_count === "number" ? this.latestMonitoring.cluster_count : "-";
      lines.push(`- embedding groups: ${groupCount}`);
      lines.push("- groups reflect embedding similarity, not semantic categories.");
    }

    if ((this.manifest.k_eligible ?? 0) === 0) {
      lines.push("- embeddings: none written because zero eligible trials were produced");
    }

    lines.push("");
    lines.push("Artifacts:");
    artifactLines.forEach((artifact) => lines.push(`- ${artifact}`));
    lines.push("");
    lines.push(`Reproduce: arbiter run --config ${resolve(this.runDir, "config.resolved.json")}`);

    return `${lines.join("\n")}\n`;
  }

  private finalizeManifest(input: {
    completedAt: string;
    stopReason: ArbiterRunManifest["stop_reason"];
    incomplete: boolean;
    notes?: string;
  }): void {
    if (!this.manifest) {
      throw new Error("Manifest is not initialized");
    }

    this.ensureEmbeddingsProvenance(input.stopReason === "error" ? "run_failed_before_embeddings" : "no_embeddings_generated");

    this.manifest.completed_at = input.completedAt;
    this.manifest.timestamps = {
      started_at: this.manifest.started_at,
      completed_at: input.completedAt
    };
    this.manifest.stop_reason = input.stopReason;
    this.manifest.incomplete = input.incomplete;
    if (input.notes) {
      this.manifest.notes = input.notes;
    }

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

    this.manifest.measurement = {
      embedding: {
        requested_model: this.resolvedConfig.measurement.embedding_model,
        actual_model: this.embeddingsProvenance?.actual_embedding_model ?? null,
        status: this.embeddingsProvenance?.status ?? "not_generated",
        generated_vectors: this.counts.embeddingSuccess,
        generation_ids_count: this.embeddingsProvenance?.generation_ids?.length ?? 0,
        arrow_written: this.embeddingsProvenance?.status === "arrow_generated",
        fallback_jsonl_written: this.embeddingsProvenance?.status === "jsonl_fallback"
      },
      grouping: {
        enabled: this.groupingEnabled,
        params: this.groupingEnabled
          ? {
              tau: this.resolvedConfig.measurement.clustering.tau,
              stop_mode: this.resolvedConfig.measurement.clustering.stop_mode
            }
          : null
      }
    };

    this.manifest.metrics = {
      final: this.latestAggregates ?? {
        novelty_rate: this.latestMonitoring?.novelty_rate ?? null,
        mean_max_sim_to_prior: this.latestMonitoring?.mean_max_sim_to_prior ?? null
      }
    };

    this.manifest.artifacts = {
      entries: buildArtifactEntries({
        debugEnabled: this.debugEnabled,
        clusteringEnabled: this.groupingEnabled,
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

    const receiptText = this.renderReceiptText({
      stopReason: this.manifest.stop_reason,
      incomplete: this.manifest.incomplete,
      completedAt: input.completedAt
    });
    writeTextAtomic(resolve(this.runDir, "receipt.txt"), receiptText);
  }

  private onRunCompleted(payload: RunCompletedPayload): void {
    this.finalizeManifest({
      completedAt: payload.completed_at,
      stopReason: payload.stop_reason,
      incomplete: payload.incomplete
    });
  }

  private onRunFailed(payload: RunFailedPayload): void {
    this.finalizeManifest({
      completedAt: payload.completed_at,
      stopReason: "error",
      incomplete: true,
      notes: payload.error
    });
  }
}
