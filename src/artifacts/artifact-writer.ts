import { mkdirSync, readFileSync } from "node:fs";
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
import { DEFAULT_STOP_POLICY } from "../config/defaults.js";
import type { RunPolicySnapshot } from "../config/policy.js";
import { canonicalStringify } from "../utils/canonical-json.js";
import { sha256Hex } from "../utils/hash.js";
import { createJsonlWriter, writeJsonAtomic, type JsonlWriter } from "./io.js";
import { EMBED_TEXT_NORMALIZATION } from "../engine/embed-text.js";
import type { EmbeddingsProvenance } from "./embeddings-provenance.js";

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

type ArtifactCounts = {
  trialPlan: number;
  trials: number;
  parsed: number;
  convergence: number;
  embeddings: number;
  embeddingSuccess: number;
  embeddingFailed: number;
  embeddingSkipped: number;
  clusterAssignments: number;
};

type UsageTotals = {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost?: number;
};

const readPackageVersion = (packageJsonPath: string): string => {
  const raw = readFileSync(packageJsonPath, "utf8");
  const parsed = JSON.parse(raw) as { version?: string };
  return parsed.version ?? "0.0.0";
};

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
  private readonly runId: string;
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
  private readonly usageTotals: UsageTotals = {
    prompt_tokens: 0,
    completion_tokens: 0,
    total_tokens: 0
  };
  private readonly usageByModel = new Map<string, UsageTotals>();
  private readonly trialStatusById = new Map<number, TrialCompletedPayload["trial_record"]["status"]>();
  private readonly parseCounts = {
    success: 0,
    fallback: 0,
    failed: 0
  };
  private readonly contractParseCounts = {
    fallback: 0,
    failed: 0
  };
  private readonly unsubs: Array<() => void> = [];
  private closed = false;

  constructor(options: ArtifactWriterOptions) {
    this.runDir = options.runDir;
    this.runId = options.runId;
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
      bus.subscribe("run.started", (payload) => this.onRunStarted(payload)),
      bus.subscribe("trial.planned", (payload) => this.onTrialPlanned(payload)),
      bus.subscribe("trial.completed", (payload) => this.onTrialCompleted(payload)),
      bus.subscribe("parsed.output", (payload) => this.onParsedOutput(payload)),
      bus.subscribe("embedding.recorded", (payload) => this.onEmbeddingRecorded(payload)),
      bus.subscribe("convergence.record", (payload) => this.onConvergenceRecord(payload)),
      bus.subscribe("cluster.assigned", (payload) => this.onClusterAssigned(payload)),
      bus.subscribe("clusters.state", (payload) => this.onClusterState(payload)),
      bus.subscribe("aggregates.computed", (payload) => this.onAggregatesComputed(payload)),
      bus.subscribe("embeddings.finalized", (payload) => this.onEmbeddingsFinalized(payload)),
      bus.subscribe("artifact.written", (payload) => this.onArtifactWritten(payload)),
      bus.subscribe("run.completed", (payload) => this.onRunCompleted(payload)),
      bus.subscribe("run.failed", (payload) => this.onRunFailed(payload))
    );
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
    const manifest = this.buildInitialManifest(payload);
    this.manifest = manifest;
    writeJsonAtomic(resolve(this.runDir, "manifest.json"), manifest);
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
    this.ingestUsage(payload.trial_record);
  }

  private onParsedOutput(payload: ParsedOutputProducedPayload): void {
    if (this.validateArtifacts) {
      assertValid("parsed output", validateParsedOutput(payload.parsed_record), validateParsedOutput.errors);
    }
    this.parsedWriter.append(payload.parsed_record);
    this.counts.parsed += 1;
    const status = payload.parsed_record.parse_status;
    if (status === "success") {
      this.parseCounts.success += 1;
    } else if (status === "fallback") {
      this.parseCounts.fallback += 1;
    } else if (status === "failed") {
      this.parseCounts.failed += 1;
    }
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
      this.manifest.artifacts = { entries: this.buildArtifactEntries() };
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
    this.applyContractFailurePolicy();
    this.manifest.k_attempted = this.counts.trials;
    this.manifest.k_eligible = this.counts.embeddingSuccess;
    const usage = this.buildUsageSummary();
    if (usage) {
      this.manifest.usage = usage;
    }
    this.manifest.artifacts = { entries: this.buildArtifactEntries() };
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
    const usage = this.buildUsageSummary();
    if (usage) {
      this.manifest.usage = usage;
    }
    this.manifest.artifacts = { entries: this.buildArtifactEntries() };
    this.manifestFinalized = true;
    if (this.validateArtifacts) {
      assertValid("manifest", validateManifest(this.manifest), validateManifest.errors);
    }
    writeJsonAtomic(resolve(this.runDir, "manifest.json"), this.manifest);
  }

  private buildInitialManifest(payload: RunStartedPayload): ArbiterRunManifest {
    const configSha256 = sha256Hex(canonicalStringify(payload.resolved_config));
    const arbiterVersion = readPackageVersion(this.packageJsonPath);
    const stopPolicy = this.resolvedConfig.execution.stop_policy ?? DEFAULT_STOP_POLICY;

    const manifest: ArbiterRunManifest = {
      schema_version: "1.0.0",
      arbiter_version: arbiterVersion,
      run_id: payload.run_id,
      started_at: payload.started_at,
      completed_at: payload.started_at,
      timestamps: {
        started_at: payload.started_at,
        completed_at: payload.started_at
      },
      stop_reason: "completed",
      stopping_mode: this.resolvedConfig.execution.stop_mode,
      incomplete: false,
      k_attempted: 0,
      k_eligible: 0,
      k_min: this.resolvedConfig.execution.k_min,
      k_min_count_rule: this.resolvedConfig.execution.k_min_count_rule,
      stop_policy: {
        novelty_epsilon: stopPolicy.novelty_epsilon,
        similarity_threshold: stopPolicy.similarity_threshold,
        patience: stopPolicy.patience,
        k_min_eligible: this.resolvedConfig.execution.k_min
      },
      hash_algorithm: "sha256",
      config_sha256: configSha256,
      plan_sha256: payload.plan_sha256,
      k_planned: payload.k_planned,
      model_catalog_version: this.catalogVersion,
      model_catalog_sha256: this.catalogSha256,
      prompt_manifest_sha256: this.promptManifestSha256,
      provenance: {
        arbiter_version: arbiterVersion,
        config_sha256: configSha256,
        plan_sha256: payload.plan_sha256,
        model_catalog_version: this.catalogVersion,
        model_catalog_sha256: this.catalogSha256,
        prompt_manifest_sha256: this.promptManifestSha256,
        hash_algorithm: "sha256"
      },
      artifacts: { entries: [] }
    };

    if (this.policy) {
      manifest.policy = this.policy;
    }

    return manifest;
  }

  private buildArtifactEntries(): Array<{ path: string; record_count?: number; note?: string }> {
    const entries: Array<{ path: string; record_count?: number; note?: string }> = [
      { path: "config.resolved.json" },
      { path: "manifest.json" },
      { path: "trial_plan.jsonl", record_count: this.counts.trialPlan },
      { path: "trials.jsonl", record_count: this.counts.trials },
      { path: "parsed.jsonl", record_count: this.counts.parsed },
      { path: "convergence_trace.jsonl", record_count: this.counts.convergence },
      { path: "embeddings.provenance.json" },
      { path: "aggregates.json" }
    ];

    if (this.embeddingsProvenance?.status === "arrow_generated") {
      entries.push({ path: "embeddings.arrow" });
    }

    if (this.debugEnabled || this.embeddingsProvenance?.status === "jsonl_fallback") {
      entries.push({
        path: "debug/embeddings.jsonl",
        record_count: this.counts.embeddings
      });
    }

    if (this.clusteringEnabled) {
      entries.push({
        path: "clusters/online.assignments.jsonl",
        record_count: this.counts.clusterAssignments
      });
      entries.push({ path: "clusters/online.state.json" });
    }

    for (const entry of this.extraArtifacts.values()) {
      entries.push(entry);
    }

    return entries;
  }

  private normalizeUsage(input: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    cost?: number;
  }): UsageTotals | null {
    const prompt = Number.isFinite(input.prompt_tokens) ? (input.prompt_tokens as number) : 0;
    const completion = Number.isFinite(input.completion_tokens) ? (input.completion_tokens as number) : 0;
    const total =
      Number.isFinite(input.total_tokens) ? (input.total_tokens as number) : prompt + completion;
    if (prompt === 0 && completion === 0 && total === 0 && !Number.isFinite(input.cost)) {
      return null;
    }
    const usage: UsageTotals = {
      prompt_tokens: prompt,
      completion_tokens: completion,
      total_tokens: total
    };
    if (Number.isFinite(input.cost)) {
      usage.cost = input.cost as number;
    }
    return usage;
  }

  private addUsage(target: UsageTotals, addition: UsageTotals): void {
    target.prompt_tokens += addition.prompt_tokens;
    target.completion_tokens += addition.completion_tokens;
    target.total_tokens += addition.total_tokens;
    if (addition.cost !== undefined) {
      target.cost = (target.cost ?? 0) + addition.cost;
    }
  }

  private ingestUsage(trialRecord: TrialCompletedPayload["trial_record"]): void {
    const useUsage = (usage: UsageTotals, modelKey: string): void => {
      this.addUsage(this.usageTotals, usage);
      const existing = this.usageByModel.get(modelKey) ?? {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0
      };
      this.addUsage(existing, usage);
      this.usageByModel.set(modelKey, existing);
    };

    if (trialRecord.usage) {
      const normalized = this.normalizeUsage(trialRecord.usage);
      if (normalized) {
        const modelKey = trialRecord.actual_model ?? trialRecord.requested_model_slug;
        useUsage(normalized, modelKey);
      }
    }

    if (trialRecord.calls) {
      for (const call of trialRecord.calls) {
        if (!call.usage) {
          continue;
        }
        const normalized = this.normalizeUsage(call.usage);
        if (!normalized) {
          continue;
        }
        const modelKey = call.model_actual ?? call.model_requested;
        useUsage(normalized, modelKey);
      }
    }
  }

  private buildUsageSummary(): ArbiterRunManifest["usage"] | undefined {
    if (
      this.usageTotals.prompt_tokens === 0 &&
      this.usageTotals.completion_tokens === 0 &&
      this.usageTotals.total_tokens === 0 &&
      this.usageTotals.cost === undefined
    ) {
      return undefined;
    }

    const byModel: Record<string, UsageTotals> = {};
    for (const [model, usage] of this.usageByModel.entries()) {
      byModel[model] = usage;
    }

    return {
      totals: this.usageTotals,
      ...(Object.keys(byModel).length > 0 ? { by_model: byModel } : {})
    };
  }

  private applyContractFailurePolicy(): void {
    if (!this.manifest || !this.policy) {
      return;
    }
    if (!this.resolvedConfig.protocol.decision_contract) {
      return;
    }
    if (this.policy.contract_failure_policy !== "fail") {
      return;
    }
    const failures = this.contractParseCounts.fallback + this.contractParseCounts.failed;
    if (failures === 0) {
      return;
    }
    this.manifest.stop_reason = "error";
    this.manifest.incomplete = true;
    const message = `Contract parse failures: fallback=${this.contractParseCounts.fallback}, failed=${this.contractParseCounts.failed}`;
    this.manifest.notes = this.manifest.notes ? `${this.manifest.notes}; ${message}` : message;
  }
}
