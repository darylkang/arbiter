export type PriorEmbedding = {
  trial_id: number;
  vector: number[];
  norm: number;
};

export type BatchEmbedding = {
  trial_id: number;
  vector: number[];
};

const vectorNorm = (vector: number[]): number => {
  let sum = 0;
  for (const value of vector) {
    sum += value * value;
  }
  return Math.sqrt(sum);
};

const cosineSimilarity = (
  vector: number[],
  norm: number,
  priorVector: number[],
  priorNorm: number
): number => {
  if (norm === 0 || priorNorm === 0) {
    return 0;
  }
  let dot = 0;
  for (let i = 0; i < vector.length; i += 1) {
    dot += vector[i] * priorVector[i];
  }
  return dot / (norm * priorNorm);
};

export const updateNoveltyMetrics = (
  prior: PriorEmbedding[],
  batch: BatchEmbedding[],
  noveltyThreshold: number
): { noveltyRate: number; meanMaxSimToPrior: number } => {
  if (batch.length === 0) {
    return { noveltyRate: 0, meanMaxSimToPrior: 0 };
  }

  let novelCount = 0;
  let sumMaxSim = 0;

  for (const embedding of batch) {
    const norm = vectorNorm(embedding.vector);
    let maxSim = 0;
    for (const priorEmbedding of prior) {
      const sim = cosineSimilarity(
        embedding.vector,
        norm,
        priorEmbedding.vector,
        priorEmbedding.norm
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
    meanMaxSimToPrior: sumMaxSim / batch.length
  };
};
