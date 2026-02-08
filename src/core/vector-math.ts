export type CosineSimilarityOptions = {
  normA?: number;
  normB?: number;
};

export const vectorNorm = (vector: number[]): number => {
  let sum = 0;
  for (const value of vector) {
    sum += value * value;
  }
  return Math.sqrt(sum);
};

export const cosineSimilarity = (
  vectorA: number[],
  vectorB: number[],
  options?: CosineSimilarityOptions
): number => {
  if (vectorA.length !== vectorB.length) {
    throw new Error(
      `cosineSimilarity requires vectors with equal length (got ${vectorA.length} and ${vectorB.length})`
    );
  }
  const normA = options?.normA ?? vectorNorm(vectorA);
  const normB = options?.normB ?? vectorNorm(vectorB);
  if (normA === 0 || normB === 0) {
    return 0;
  }

  let dot = 0;
  for (let i = 0; i < vectorA.length; i += 1) {
    dot += vectorA[i] * vectorB[i];
  }
  return dot / (normA * normB);
};
