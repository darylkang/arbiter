import type { RunProgress } from "../state.js";

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const renderBar = (value: number, max: number, width: number): string => {
  const safeMax = max <= 0 ? 1 : max;
  const ratio = clamp(value / safeMax, 0, 1);
  const filled = Math.round(width * ratio);
  const empty = Math.max(0, width - filled);
  return `[${"■".repeat(filled)}${"░".repeat(empty)}] ${value}/${safeMax}`;
};

const resolveBarWidth = (terminalWidth: number): number => {
  return clamp(Math.round(terminalWidth * 0.26), 12, 28);
};

const renderWorkerSummary = (progress: RunProgress): string | null => {
  const workerCount = Math.max(0, progress.workerCount);
  if (workerCount === 0) {
    return null;
  }

  const busy = Object.values(progress.workerStatus).filter((worker) => worker.status === "busy").length;
  return `workers busy ${busy}/${workerCount}`;
};

const formatDuration = (inputMs: number): string => {
  const totalSeconds = Math.max(0, Math.floor(inputMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes <= 0) {
    return `${seconds}s`;
  }
  return `${minutes}m ${seconds}s`;
};

export const renderProgressSummary = (progress: RunProgress, terminalWidth = 80): string => {
  const master = renderBar(progress.attempted, progress.planned, resolveBarWidth(terminalWidth));
  const elapsedMs = progress.runStartedAt ? Math.max(0, Date.now() - progress.runStartedAt) : 0;
  const completionRatio = progress.planned > 0 ? progress.attempted / progress.planned : 0;
  let etaText = "estimating...";
  if (progress.attempted > 0 && progress.planned > progress.attempted && completionRatio >= 0.1) {
    const avgMsPerTrial = elapsedMs / progress.attempted;
    etaText = `~${formatDuration(avgMsPerTrial * (progress.planned - progress.attempted))} rem`;
  } else if (progress.planned > 0 && progress.attempted >= progress.planned) {
    etaText = "~0s rem";
  }
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
    `progress ${master} · ${formatDuration(elapsedMs)} · ${etaText}`,
    `eligible ${progress.eligible} | ${currentBatch}`
  ];

  const workerSummary = renderWorkerSummary(progress);
  if (workerSummary) {
    lines.push(workerSummary);
  }

  if (statusParts.length > 0) {
    lines.push(statusParts.join(" | "));
  }

  return lines.join("\n");
};
