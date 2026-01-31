import type { EventBus } from "../events/event-bus.js";
import type { ArbiterResolvedConfig } from "../generated/config.types.js";
import type { ArbiterDebugEmbeddingJSONLRecord } from "../generated/embedding.types.js";
import type { ArbiterConvergenceTraceRecord } from "../generated/convergence-trace.types.js";
import type { ArbiterOnlineClusterAssignmentRecord } from "../generated/cluster-assignment.types.js";
import type { ArbiterOnlineClusteringState } from "../generated/cluster-state.types.js";
import type {
  BatchCompletedPayload,
  EmbeddingRecordedPayload,
  RunCompletedPayload,
  RunFailedPayload,
  TrialCompletedPayload
} from "../events/types.js";
import { updateNoveltyMetrics, type BatchEmbedding, type PriorEmbedding } from "../engine/monitoring.js";
import { OnlineLeaderClustering } from "./online-leader.js";
import { decodeFloat32Base64 } from "./vector-codec.js";

type ClusterMetrics = {
  cluster_count: number;
  new_clusters_this_batch: number;
  largest_cluster_share: number;
  cluster_distribution: Record<string, number>;
  js_divergence: number | null;
  entropy: number;
  effective_cluster_count: number;
  singleton_count: number;
};

export class ClusteringMonitor {
  private readonly bus: EventBus;
  private readonly config: ArbiterResolvedConfig;
  private readonly noveltyThreshold: number;
  private readonly stopMode: "advisor" | "enforcer";
  private readonly clusteringEnabled: boolean;
  private readonly clustering: OnlineLeaderClustering | null;
  private readonly embeddings = new Map<number, ArbiterDebugEmbeddingJSONLRecord>();
  private readonly embeddingVectors = new Map<number, number[]>();
  private readonly priorEmbeddings: PriorEmbedding[] = [];
  private totalAttempted = 0;
  private totalEligible = 0;
  private readonly clusterDistribution = new Map<number, number>();
  private previousDistribution: Map<number, number> | null = null;
  private readonly unsubs: Array<() => void> = [];

  constructor(config: ArbiterResolvedConfig, bus: EventBus) {
    this.config = config;
    this.bus = bus;
    this.noveltyThreshold = config.measurement.novelty_threshold;
    this.stopMode = config.execution.stop_mode;

    const clusteringConfig = config.measurement.clustering;
    this.clusteringEnabled =
      clusteringConfig.enabled && clusteringConfig.stop_mode !== "disabled";
    if (this.clusteringEnabled) {
      this.clustering = new OnlineLeaderClustering({
        tau: clusteringConfig.tau,
        centroidUpdateRule: clusteringConfig.centroid_update_rule,
        clusterLimit: clusteringConfig.cluster_limit
      });
      if (clusteringConfig.stop_mode === "enforced") {
        console.warn(
          "Clustering stop_mode=enforced is treated as advisory in Phase C."
        );
      }
    } else {
      this.clustering = null;
    }
  }

  attach(): void {
    this.unsubs.push(
      this.bus.subscribe("trial.completed", (payload) => this.onTrialCompleted(payload)),
      this.bus.subscribe("embedding.recorded", (payload) => this.onEmbeddingRecorded(payload)),
      this.bus.subscribe("batch.completed", (payload) => this.onBatchCompleted(payload)),
      this.bus.subscribe("run.completed", (payload) => this.onRunCompleted(payload)),
      this.bus.subscribe("run.failed", (payload) => this.onRunFailed(payload))
    );
  }

  detach(): void {
    this.unsubs.splice(0).forEach((unsub) => unsub());
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

    const { noveltyRate, meanMaxSimToPrior } = updateNoveltyMetrics(
      this.priorEmbeddings,
      batchEmbeddings,
      this.noveltyThreshold
    );

    let clusterMetrics: ClusterMetrics | undefined;
    if (this.clustering) {
      if (excludedCount > 0) {
        this.clustering.recordExcluded(excludedCount);
      }

      const clusterCountBefore = this.clustering.getClusterCount();

      for (const embedding of batchEmbeddings) {
        const assignment = this.clustering.assignEmbedding({
          trial_id: embedding.trial_id,
          vector: embedding.vector,
          batch_number: payload.batch_number
        });
        this.emitClusterAssignment(assignment);
        const current = this.clusterDistribution.get(assignment.cluster_id) ?? 0;
        this.clusterDistribution.set(assignment.cluster_id, current + 1);
      }

      const clusterCount = this.clustering.getClusterCount();
      const newClusters = clusterCount - clusterCountBefore;
      const distributionObject = toDistributionObject(this.clusterDistribution);
      const totalAssigned = totalCount(this.clusterDistribution);
      const largestShare =
        totalAssigned > 0 ? maxCount(this.clusterDistribution) / totalAssigned : 0;
      const singletonCount = countSingletons(this.clusterDistribution);
      const entropy = totalAssigned > 0 ? computeEntropy(this.clusterDistribution) : 0;
      const effectiveClusterCount = totalAssigned > 0 ? Math.exp(entropy) : 0;
      const jsDivergence = this.previousDistribution
        ? computeJSDivergence(this.previousDistribution, this.clusterDistribution)
        : null;
      this.previousDistribution = new Map(this.clusterDistribution);

      clusterMetrics = {
        cluster_count: clusterCount,
        new_clusters_this_batch: Math.max(0, newClusters),
        largest_cluster_share: largestShare,
        cluster_distribution: distributionObject,
        js_divergence: jsDivergence,
        entropy,
        effective_cluster_count: effectiveClusterCount,
        singleton_count: singletonCount
      };
    }

    const convergenceRecord: ArbiterConvergenceTraceRecord = {
      batch_number: payload.batch_number,
      k_attempted: this.totalAttempted,
      k_eligible: this.totalEligible,
      novelty_rate: noveltyRate,
      mean_max_sim_to_prior: meanMaxSimToPrior,
      recorded_at: new Date().toISOString(),
      stop: {
        mode: this.stopMode,
        would_stop: false,
        should_stop: false
      },
      ...(clusterMetrics ?? {})
    };

    this.bus.emit({ type: "convergence.record", payload: { convergence_record: convergenceRecord } });
  }

  private onRunCompleted(_payload: RunCompletedPayload): void {
    this.emitClusterState();
  }

  private onRunFailed(_payload: RunFailedPayload): void {
    this.emitClusterState();
  }

  private emitClusterAssignment(assignment: ArbiterOnlineClusterAssignmentRecord): void {
    this.bus.emit({
      type: "cluster.assigned",
      payload: { assignment }
    });
  }

  private emitClusterState(): void {
    if (!this.clustering) {
      return;
    }
    const state: ArbiterOnlineClusteringState = this.clustering.snapshot();
    this.bus.emit({
      type: "clusters.state",
      payload: { state }
    });
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

const toDistributionObject = (distribution: Map<number, number>): Record<string, number> => {
  const obj: Record<string, number> = {};
  for (const [key, value] of distribution.entries()) {
    obj[String(key)] = value;
  }
  return obj;
};

const computeJSDivergence = (
  previous: Map<number, number>,
  current: Map<number, number>
): number => {
  const keys = new Set<number>([...previous.keys(), ...current.keys()]);
  const prevTotal = totalCount(previous);
  const currTotal = totalCount(current);
  if (prevTotal === 0 || currTotal === 0) {
    return 0;
  }

  const prevProbs: number[] = [];
  const currProbs: number[] = [];
  keys.forEach((key) => {
    prevProbs.push((previous.get(key) ?? 0) / prevTotal);
    currProbs.push((current.get(key) ?? 0) / currTotal);
  });

  const m = prevProbs.map((p, i) => 0.5 * (p + currProbs[i]));
  const kl = (p: number[], q: number[]): number => {
    let sum = 0;
    for (let i = 0; i < p.length; i += 1) {
      if (p[i] === 0) {
        continue;
      }
      sum += p[i] * Math.log(p[i] / q[i]);
    }
    return sum;
  };

  return 0.5 * kl(prevProbs, m) + 0.5 * kl(currProbs, m);
};
