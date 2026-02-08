import type { RunProgress } from "../state.js";

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const renderProgressBar = (value: number, max: number): string => {
  const width = 24;
  const safeMax = max <= 0 ? 1 : max;
  const ratio = clamp(value / safeMax, 0, 1);
  const filled = Math.round(width * ratio);
  const empty = Math.max(0, width - filled);
  return `[${"■".repeat(filled)}${"·".repeat(empty)}] ${value}/${safeMax}`;
};

const formatMaybe = (value: number | null | undefined, digits = 3): string => {
  if (value === undefined || value === null) {
    return "null";
  }
  return value.toFixed(digits);
};

export const renderProgressSummary = (progress: RunProgress): string => {
  const currentBatch = progress.currentBatch
    ? `batch ${progress.currentBatch.batchNumber}: ${progress.currentBatch.completed}/${progress.currentBatch.total}`
    : "batch idle";
  const latest = progress.recentBatches[progress.recentBatches.length - 1];
  const convergence = latest
    ? `novelty ${formatMaybe(latest.noveltyRate)} | mean_sim ${formatMaybe(latest.meanMaxSim)} | clusters ${latest.clusterCount ?? "-"}`
    : "novelty -";
  const usageCost = progress.usage.cost !== undefined ? ` | cost ${progress.usage.cost.toFixed(6)}` : "";

  return [
    `progress ${renderProgressBar(progress.attempted, progress.planned)}`,
    `eligible ${progress.eligible} | ${currentBatch}`,
    `tokens in ${progress.usage.prompt} out ${progress.usage.completion} total ${progress.usage.total}${usageCost}`,
    convergence
  ].join("\n");
};
