const normalizeSeed = (seed: string | number): string =>
  typeof seed === "number" ? seed.toString() : seed;

const hashSeed = (seed: string): number => {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const mulberry32 = (seed: number): (() => number) => {
  let t = seed;
  return (): number => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
};

export const createSeededRng = (seed: string | number): (() => number) =>
  mulberry32(hashSeed(normalizeSeed(seed)));

export const createRngForTrial = (
  seed: string | number,
  stream: string,
  trialId: number
): (() => number) => createSeededRng(`${normalizeSeed(seed)}:${stream}:${trialId}`);
