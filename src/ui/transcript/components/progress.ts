import type { RunProgress } from "../state.js";

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const renderBar = (value: number, max: number, width: number): string => {
  const safeMax = max <= 0 ? 1 : max;
  const ratio = clamp(value / safeMax, 0, 1);
  const filled = Math.round(width * ratio);
  const empty = Math.max(0, width - filled);
  return `[${"■".repeat(filled)}${"·".repeat(empty)}] ${value}/${safeMax}`;
};

const renderWorkerRows = (progress: RunProgress): string[] => {
  const workerCount = Math.max(0, progress.workerCount);
  if (workerCount === 0) {
    return [];
  }

  const visibleWorkers = Math.min(workerCount, 12);
  const rows = Array.from({ length: visibleWorkers }, (_, index) => {
    const workerId = String(index + 1).padStart(2, "0");
    const status = progress.workerStatus[index + 1] ?? { status: "idle" as const };
    if (status.status === "busy") {
      const trial = typeof status.trialId === "number" ? ` t${status.trialId}` : "";
      return `w${workerId} [■■■···] busy${trial}`;
    }
    return `w${workerId} [······] idle`;
  });

  const hidden = workerCount - visibleWorkers;
  if (hidden > 0) {
    rows.push(`+${hidden} additional workers`);
  }

  return rows;
};

export const renderProgressSummary = (progress: RunProgress): string => {
  const master = renderBar(progress.attempted, progress.planned, 24);
  const currentBatch = progress.currentBatch
    ? `batch ${progress.currentBatch.batchNumber}: ${progress.currentBatch.completed}/${progress.currentBatch.total}`
    : "batch idle";
  const latest = progress.recentBatches[progress.recentBatches.length - 1];

  const statusParts: string[] = [];
  if (progress.stopStatus) {
    statusParts.push(
      `stop ${progress.stopStatus.mode}: ${progress.stopStatus.shouldStop ? "stop" : "continue"}`
    );
  }
  if (latest?.clusterCount !== undefined) {
    statusParts.push(`clusters ${latest.clusterCount}`);
  }

  const lines = [
    `progress ${master}`,
    `eligible ${progress.eligible} | ${currentBatch}`
  ];

  if (statusParts.length > 0) {
    lines.push(statusParts.join(" | "));
  }

  lines.push(...renderWorkerRows(progress));

  return lines.join("\n");
};
