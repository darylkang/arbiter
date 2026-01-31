import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { EventBus } from "../events/event-bus.js";
import type {
  AggregatesComputedPayload,
  ConvergenceRecordPayload,
  EmbeddingRecordedPayload,
  EmbeddingsFinalizedPayload,
  ManifestUpdatedPayload,
  ParsedOutputProducedPayload,
  RunCompletedPayload,
  RunFailedPayload,
  RunStartedPayload,
  TrialCompletedPayload
} from "../events/types.js";
import {
  formatAjvErrors,
  validateAggregates,
  validateConvergenceTrace,
  validateEmbedding,
  validateEmbeddingsProvenance,
  validateManifest,
  validateParsedOutput,
  validateTrial
} from "../config/schema-validation.js";
import type { ArbiterResolvedConfig } from "../generated/config.types.js";
import type { ArbiterRunManifest } from "../generated/manifest.types.js";
import { canonicalStringify } from "../utils/canonical-json.js";
import { sha256Hex } from "../utils/hash.js";
import { createJsonlWriter, writeJsonAtomic, type JsonlWriter } from "./io.js";
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
}

type ArtifactCounts = {
  trials: number;
  parsed: number;
  convergence: number;
  embeddings: number;
  embeddingSuccess: number;
  embeddingFailed: number;
  embeddingSkipped: number;
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
  private manifest: ArbiterRunManifest | null = null;
  private embeddingsProvenance: EmbeddingsProvenance | null = null;
  private readonly trialsWriter: JsonlWriter;
  private readonly parsedWriter: JsonlWriter;
  private readonly convergenceWriter: JsonlWriter;
  private readonly embeddingsWriter?: JsonlWriter;
  private readonly counts: ArtifactCounts = {
    trials: 0,
    parsed: 0,
    convergence: 0,
    embeddings: 0,
    embeddingSuccess: 0,
    embeddingFailed: 0,
    embeddingSkipped: 0
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

    this.trialsWriter = createJsonlWriter(resolve(this.runDir, "trials.jsonl"));
    this.parsedWriter = createJsonlWriter(resolve(this.runDir, "parsed.jsonl"));
    this.convergenceWriter = createJsonlWriter(resolve(this.runDir, "convergence_trace.jsonl"));
    if (options.embeddingsJsonlPath) {
      this.embeddingsWriter = createJsonlWriter(options.embeddingsJsonlPath);
    }
  }

  attach(bus: EventBus): void {
    this.unsubs.push(
      bus.subscribe("run.started", (payload) => this.onRunStarted(payload)),
      bus.subscribe("trial.completed", (payload) => this.onTrialCompleted(payload)),
      bus.subscribe("parsed.output", (payload) => this.onParsedOutput(payload)),
      bus.subscribe("embedding.recorded", (payload) => this.onEmbeddingRecorded(payload)),
      bus.subscribe("convergence.record", (payload) => this.onConvergenceRecord(payload)),
      bus.subscribe("aggregates.computed", (payload) => this.onAggregatesComputed(payload)),
      bus.subscribe("embeddings.finalized", (payload) => this.onEmbeddingsFinalized(payload)),
      bus.subscribe("manifest.updated", (payload) => this.onManifestUpdated(payload)),
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
    const closers = [this.trialsWriter, this.parsedWriter, this.convergenceWriter]
      .map((writer) => writer.close());
    if (this.embeddingsWriter) {
      closers.push(this.embeddingsWriter.close());
    }
    await Promise.all(closers);
  }

  private onRunStarted(payload: RunStartedPayload): void {
    writeJsonAtomic(resolve(this.runDir, "config.resolved.json"), payload.resolved_config);
    const manifest = this.buildInitialManifest(payload);
    this.manifest = manifest;
    writeJsonAtomic(resolve(this.runDir, "manifest.json"), manifest);
  }

  private onTrialCompleted(payload: TrialCompletedPayload): void {
    if (this.validateArtifacts) {
      assertValid("trial", validateTrial(payload.trial_record), validateTrial.errors);
    }
    this.trialsWriter.append(payload.trial_record);
    this.counts.trials += 1;
  }

  private onParsedOutput(payload: ParsedOutputProducedPayload): void {
    if (this.validateArtifacts) {
      assertValid("parsed output", validateParsedOutput(payload.parsed_record), validateParsedOutput.errors);
    }
    this.parsedWriter.append(payload.parsed_record);
    this.counts.parsed += 1;
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

  private onManifestUpdated(payload: ManifestUpdatedPayload): void {
    if (this.validateArtifacts) {
      assertValid("manifest", validateManifest(payload.manifest), validateManifest.errors);
    }
    this.manifest = payload.manifest;
    writeJsonAtomic(resolve(this.runDir, "manifest.json"), payload.manifest);
  }

  private onRunCompleted(payload: RunCompletedPayload): void {
    if (!this.manifest) {
      throw new Error("Manifest is not initialized");
    }
    const completedAt = payload.completed_at;
    this.manifest.completed_at = completedAt;
    this.manifest.timestamps = {
      started_at: this.manifest.started_at,
      completed_at: completedAt
    };
    this.manifest.stop_reason = payload.stop_reason;
    this.manifest.incomplete = payload.incomplete;
    this.manifest.k_attempted = this.counts.trials;
    this.manifest.k_eligible = this.counts.embeddingSuccess;
    this.manifest.artifacts = { entries: this.buildArtifactEntries() };
    if (this.validateArtifacts) {
      assertValid("manifest", validateManifest(this.manifest), validateManifest.errors);
    }
    writeJsonAtomic(resolve(this.runDir, "manifest.json"), this.manifest);
  }

  private onRunFailed(payload: RunFailedPayload): void {
    if (!this.manifest) {
      throw new Error("Manifest is not initialized");
    }
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
    this.manifest.artifacts = { entries: this.buildArtifactEntries() };
    if (this.validateArtifacts) {
      assertValid("manifest", validateManifest(this.manifest), validateManifest.errors);
    }
    writeJsonAtomic(resolve(this.runDir, "manifest.json"), this.manifest);
  }

  private buildInitialManifest(payload: RunStartedPayload): ArbiterRunManifest {
    const configSha256 = sha256Hex(canonicalStringify(payload.resolved_config));
    const arbiterVersion = readPackageVersion(this.packageJsonPath);

    return {
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
  }

  private buildArtifactEntries(): Array<{ path: string; record_count?: number; note?: string }> {
    const entries: Array<{ path: string; record_count?: number; note?: string }> = [
      { path: "config.resolved.json" },
      { path: "manifest.json" },
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

    return entries;
  }
}
