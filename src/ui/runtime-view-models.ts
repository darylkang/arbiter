import type { WorkerRow } from "./wizard-theme.js";

export type RenderTone = "text" | "muted" | "warn" | "error" | "success" | "info";

export type RenderLine = {
  text: string;
  tone?: RenderTone;
};

export type KeyValueRow = {
  key: string;
  value: string;
};

export type DashboardVM = {
  statusContext: string;
  elapsedMs: number;
  progressLabel: string;
  progressPct: number;
  eta: string;
  monitoringRows: KeyValueRow[];
  caveatLines: RenderLine[];
  workerRows: WorkerRow[];
  usageLines: RenderLine[];
  footerText: string;
};

export type ReceiptVM = {
  statusContext: string;
  stopBanner: string;
  caveatLines: RenderLine[];
  summaryRows: KeyValueRow[];
  groupLines: RenderLine[];
  artifactRows: string[];
  reproduceCommand: string;
  footerText: string;
};
