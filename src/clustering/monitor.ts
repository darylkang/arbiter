import type { EventBus } from "../events/event-bus.js";
import type { ArbiterResolvedConfig } from "../generated/config.types.js";
import type { ArbiterDebugEmbeddingJSONLRecord } from "../generated/embedding.types.js";
import type { ArbiterMonitoringRecord } from "../generated/monitoring.types.js";
import type { ArbiterOnlineGroupAssignmentRecord } from "../generated/group-assignment.types.js";
import type { ArbiterOnlineGroupingState } from "../generated/group-state.types.js";
import type { ArbiterAggregates } from "../generated/aggregates.types.js";
import type {
  BatchCompletedPayload,
  EmbeddingRecordedPayload,
  RunCompletedPayload,
  RunFailedPayload,
  TrialCompletedPayload
} from "../events/types.js";
import type { WarningSink } from "../utils/warnings.js";
import { updateNoveltyMetrics, type BatchEmbedding, type PriorEmbedding } from "../engine/monitoring.js";
import { OnlineLeaderClustering } from "./online-leader.js";
import { decodeFloat32Base64 } from "../utils/float32-base64.js";
import { DEFAULT_STOP_POLICY } from "../config/defaults.js";

type GroupMetrics = {
  group_count: number;
  new_groups_this_batch: number;
  largest_group_share: number;
  group_distribution: number[];
  js_divergence: number | null;
  entropy: number;
  effective_group_count: number;
  singleton_group_count: number;
  group_limit_hit: boolean;
  forced_assignments_this_batch: number;
  forced_assignments_cumulative: number;
};

type StopPolicy = {
  novelty_epsilon: number;
  similarity_threshold: number;
  patience: number;
};

export class ClusteringMonitor {
  private readonly bus: EventBus;
  private readonly noveltyThreshold: number;
  private readonly stopMode: "advisor" | "enforcer";
  private readonly stopPolicy: StopPolicy;
  private readonly kMinEligible: number;
  private readonly clusteringEnabled: boolean;
  private readonly clustering: OnlineLeaderClustering | null;
  private readonly embeddings = new Map<number, ArbiterDebugEmbeddingJSONLRecord>();
  private readonly embeddingVectors = new Map<number, number[]>();
  private readonly priorEmbeddings: PriorEmbedding[] = [];
  private totalAttempted = 0;
  private totalEligible = 0;
  private readonly groupDistribution = new Map<number, number>();
  private previousDistribution: number[] | null = null;
  private readonly groupLimit: number | null;
  private readonly unsubs: Array<() => void> = [];
  private lastMonitoring: ArbiterMonitoringRecord | null = null;
  private consecutiveConvergedBatches = 0;
  private shouldStopFlag = false;

  constructor(config: ArbiterResolvedConfig, bus: EventBus, warningSink?: WarningSink) {
    this.bus = bus;
    this.noveltyThreshold = config.measurement.novelty_threshold;
    this.stopMode = config.execution.stop_mode;
    this.stopPolicy = config.execution.stop_policy ?? DEFAULT_STOP_POLICY;
    this.kMinEligible = config.execution.k_min;

    const clusteringConfig = config.measurement.clustering;
    this.clusteringEnabled =
      clusteringConfig.enabled && clusteringConfig.stop_mode !== "disabled";
    if (this.clusteringEnabled) {
      this.clustering = new OnlineLeaderClustering({
        tau: clusteringConfig.tau,
        centroidUpdateRule: clusteringConfig.centroid_update_rule,
        groupLimit: clusteringConfig.cluster_limit
      });
      this.groupLimit = clusteringConfig.cluster_limit;
      if (clusteringConfig.stop_mode === "enforced") {
        warningSink?.warn(
          "Clustering stop_mode=enforced is treated as advisory in Phase C.",
          "clustering"
        );
      }
    } else {
      this.clustering = null;
      this.groupLimit = null;
    }
  }

  attach(): void {
    this.unsubs.push(
      this.bus.subscribeSafe(
        "trial.completed",
        (payload) => this.onTrialCompleted(payload),
        (error) => this.onSubscriberError("trial.completed", error)
      ),
      this.bus.subscribeSafe(
        "embedding.recorded",
        (payload) => this.onEmbeddingRecorded(payload),
        (error) => this.onSubscriberError("embedding.recorded", error)
      ),
      this.bus.subscribeSafe(
        "batch.completed",
        (payload) => this.onBatchCompleted(payload),
        (error) => this.onSubscriberError("batch.completed", error)
      ),
      this.bus.subscribeSafe(
        "run.completed",
        (payload) => this.onRunCompleted(payload),
        (error) => this.onSubscriberError("run.completed", error)
      ),
      this.bus.subscribeSafe(
        "run.failed",
        (payload) => this.onRunFailed(payload),
        (error) => this.onSubscriberError("run.failed", error)
      )
    );
  }

  detach(): void {
    this.unsubs.splice(0).forEach((unsub) => unsub());
  }

  getShouldStop(): boolean {
    return this.shouldStopFlag;
  }

  private onSubscriberError(eventType: string, error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    this.bus.emit({
      type: "warning.raised",
      payload: {
        message: `ClusteringMonitor handler failed for ${eventType}: ${message}`,
        source: "clustering",
        recorded_at: new Date().toISOString()
      }
    });
  }

  private onTrialCompleted(_payload: TrialCompletedPayload): void {
    this.totalAttempted += 1;
  }

  private onEmbeddingRecorded(payload: EmbeddingRecordedPayload): void {
    const record = payload.embedding_record;
    if (this.embeddings.has(record.trial_id)) {
      return;
    }
    this.embeddings.set(record.trial_id, record);
    if (record.embedding_status === "success" && record.vector_b64) {
      const vector = decodeFloat32Base64(record.vector_b64);
      this.embeddingVectors.set(record.trial_id, vector);
      this.totalEligible += 1;
    }
  }

  private onBatchCompleted(payload: BatchCompletedPayload): void {
    const trialIds = payload.trial_ids.slice().sort((a, b) => a - b);
    const batchEmbeddings: BatchEmbedding[] = [];
    let excludedCount = 0;

    for (const trialId of trialIds) {
      const record = this.embeddings.get(trialId);
      if (record?.embedding_status === "success") {
        const vector = this.embeddingVectors.get(trialId);
        if (!vector) {
          throw new Error(`Missing decoded embedding for trial ${trialId}`);
        }
        batchEmbeddings.push({ trial_id: trialId, vector });
      } else {
        excludedCount += 1;
      }
      this.embeddings.delete(trialId);
      this.embeddingVectors.delete(trialId);
    }

    const { noveltyRate, meanMaxSimToPrior, hasEligibleInBatch } = updateNoveltyMetrics(
      this.priorEmbeddings,
      batchEmbeddings,
      this.noveltyThreshold
    );

    const meetsThresholds =
      hasEligibleInBatch &&
      noveltyRate !== null &&
      meanMaxSimToPrior !== null &&
      noveltyRate <= this.stopPolicy.novelty_epsilon &&
      meanMaxSimToPrior >= this.stopPolicy.similarity_threshold;

    if (hasEligibleInBatch && this.totalEligible >= this.kMinEligible && meetsThresholds) {
      this.consecutiveConvergedBatches += 1;
    } else {
      this.consecutiveConvergedBatches = 0;
    }

    const wouldStop = this.consecutiveConvergedBatches >= this.stopPolicy.patience;
    const shouldStop = wouldStop && this.stopMode === "enforcer";
    this.shouldStopFlag = shouldStop;

    let groupMetrics: GroupMetrics | undefined;
    if (this.clustering) {
      if (excludedCount > 0) {
        this.clustering.recordExcluded(excludedCount);
      }

      const groupCountBefore = this.clustering.getGroupCount();
      let forcedThisBatch = 0;

      for (const embedding of batchEmbeddings) {
        const assignment = this.clustering.assignEmbedding({
          trial_id: embedding.trial_id,
          vector: embedding.vector,
          batch_number: payload.batch_number
        });
        this.emitGroupAssignment(assignment);
        if (assignment.forced) {
          forcedThisBatch += 1;
        }
        const current = this.groupDistribution.get(assignment.group_id) ?? 0;
        this.groupDistribution.set(assignment.group_id, current + 1);
      }

      const groupCount = this.clustering.getGroupCount();
      const groupLimitHit =
        this.groupLimit !== null ? groupCount === this.groupLimit : false;
      const newGroups = groupCount - groupCountBefore;
      const distributionArray = toDenseArray(this.groupDistribution, groupCount);
      const totalAssigned = totalCount(this.groupDistribution);
      const largestShare =
        totalAssigned > 0 ? maxCount(this.groupDistribution) / totalAssigned : 0;
      const singletonCount = countSingletons(this.groupDistribution);
      const entropy = totalAssigned > 0 ? computeEntropy(this.groupDistribution) : 0;
      const effectiveGroupCount = totalAssigned > 0 ? Math.exp(entropy) : 0;
      const jsDivergence = this.previousDistribution
        ? computeJSDivergence(this.previousDistribution, distributionArray)
        : null;
      this.previousDistribution = distributionArray;
      const totals = this.clustering.getTotals();

      groupMetrics = {
        group_count: groupCount,
        new_groups_this_batch: Math.max(0, newGroups),
        largest_group_share: largestShare,
        group_distribution: distributionArray,
        js_divergence: jsDivergence,
        entropy,
        effective_group_count: effectiveGroupCount,
        singleton_group_count: singletonCount,
        group_limit_hit: groupLimitHit,
        forced_assignments_this_batch: forcedThisBatch,
        forced_assignments_cumulative: totals.forcedAssignments
      };
    }

    const monitoringRecord: ArbiterMonitoringRecord = {
      batch_number: payload.batch_number,
      k_attempted: this.totalAttempted,
      k_eligible: this.totalEligible,
      has_eligible_in_batch: hasEligibleInBatch,
      novelty_rate: noveltyRate,
      mean_max_sim_to_prior: meanMaxSimToPrior,
      recorded_at: new Date().toISOString(),
      stop: {
        mode: this.stopMode,
        would_stop: wouldStop,
        should_stop: shouldStop,
        stop_reason: wouldStop ? "converged" : undefined
      },
      ...(groupMetrics ?? {})
    };

    this.lastMonitoring = monitoringRecord;
    this.bus.emit({ type: "monitoring.record", payload: { monitoring_record: monitoringRecord } });
  }

  private onRunCompleted(payload: RunCompletedPayload): void {
    this.emitAggregates(payload.incomplete);
    this.emitGroupState();
  }

  private onRunFailed(_payload: RunFailedPayload): void {
    this.emitAggregates(true);
    this.emitGroupState();
  }

  private emitGroupAssignment(assignment: ArbiterOnlineGroupAssignmentRecord): void {
    this.bus.emit({
      type: "group.assigned",
      payload: { assignment }
    });
  }

  private emitGroupState(): void {
    if (!this.clustering) {
      return;
    }
    const state: ArbiterOnlineGroupingState = this.clustering.snapshot();
    this.bus.emit({
      type: "groups.state",
      payload: { state }
    });
  }

  private emitAggregates(incomplete: boolean): void {
    const last = this.lastMonitoring;
    const aggregates: ArbiterAggregates = {
      schema_version: "1.0.0",
      k_attempted: this.totalAttempted,
      k_eligible: this.totalEligible,
      novelty_rate: last?.novelty_rate ?? null,
      mean_max_sim_to_prior: last?.mean_max_sim_to_prior ?? null,
      group_count: this.clustering ? (last?.group_count ?? null) : null,
      entropy: this.clustering ? (last?.entropy ?? null) : null,
      incomplete
    };
    this.bus.emit({ type: "aggregates.computed", payload: { aggregates } });
  }
}

const totalCount = (distribution: Map<number, number>): number => {
  let total = 0;
  for (const count of distribution.values()) {
    total += count;
  }
  return total;
};

const maxCount = (distribution: Map<number, number>): number => {
  let max = 0;
  for (const count of distribution.values()) {
    if (count > max) {
      max = count;
    }
  }
  return max;
};

const countSingletons = (distribution: Map<number, number>): number => {
  let count = 0;
  for (const value of distribution.values()) {
    if (value === 1) {
      count += 1;
    }
  }
  return count;
};

const computeEntropy = (distribution: Map<number, number>): number => {
  const total = totalCount(distribution);
  if (total === 0) {
    return 0;
  }
  let entropy = 0;
  for (const count of distribution.values()) {
    if (count === 0) {
      continue;
    }
    const p = count / total;
    entropy -= p * Math.log(p);
  }
  return entropy;
};

const toDenseArray = (
  distribution: Map<number, number>,
  groupCount: number
): number[] => {
  const array = Array.from({ length: groupCount }, () => 0);
  for (const [key, value] of distribution.entries()) {
    if (key >= 0 && key < groupCount) {
      array[key] = value;
    }
  }
  return array;
};

const computeJSDivergence = (
  previous: number[],
  current: number[]
): number | null => {
  const length = Math.max(previous.length, current.length);
  const prevTotal = previous.reduce((sum, value) => sum + value, 0);
  const currTotal = current.reduce((sum, value) => sum + value, 0);
  if (prevTotal === 0 || currTotal === 0) {
    return null;
  }

  const prevProbs: number[] = [];
  const currProbs: number[] = [];
  for (let i = 0; i < length; i += 1) {
    prevProbs.push((previous[i] ?? 0) / prevTotal);
    currProbs.push((current[i] ?? 0) / currTotal);
  }

  const m = prevProbs.map((p, i) => 0.5 * (p + currProbs[i]));
  const kl = (p: number[], q: number[]): number => {
    let sum = 0;
    for (let i = 0; i < p.length; i += 1) {
      if (p[i] === 0) {
        continue;
      }
      sum += p[i] * Math.log2(p[i] / q[i]);
    }
    return sum;
  };

  return 0.5 * kl(prevProbs, m) + 0.5 * kl(currProbs, m);
};
