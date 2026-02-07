import { cosineSimilarity, vectorNorm } from "../core/vector-math.js";

export type PriorEmbedding = {
  trial_id: number;
  vector: number[];
  norm: number;
};

export type BatchEmbedding = {
  trial_id: number;
  vector: number[];
};

/**
 * Updates novelty metrics for a batch and mutates `prior` by appending
 * the batch embeddings with precomputed norms for incremental monitoring.
 */
export const updateNoveltyMetrics = (
  prior: PriorEmbedding[],
  batch: BatchEmbedding[],
  noveltyThreshold: number
): { noveltyRate: number | null; meanMaxSimToPrior: number | null; hasEligibleInBatch: boolean } => {
  if (batch.length === 0) {
    return { noveltyRate: null, meanMaxSimToPrior: null, hasEligibleInBatch: false };
  }

  let novelCount = 0;
  let sumMaxSim = 0;

  for (const embedding of batch) {
    const norm = vectorNorm(embedding.vector);
    let maxSim = 0;
    for (const priorEmbedding of prior) {
      const sim = cosineSimilarity(
        embedding.vector,
        priorEmbedding.vector,
        { normA: norm, normB: priorEmbedding.norm }
      );
      if (sim > maxSim) {
        maxSim = sim;
      }
    }
    sumMaxSim += maxSim;
    if (maxSim < noveltyThreshold) {
      novelCount += 1;
    }
    prior.push({ trial_id: embedding.trial_id, vector: embedding.vector, norm });
  }

  return {
    noveltyRate: novelCount / batch.length,
    meanMaxSimToPrior: sumMaxSim / batch.length,
    hasEligibleInBatch: true
  };
};
