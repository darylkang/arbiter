import type { FormatterStream } from "./fmt.js";

export const MIN_WIZARD_COLUMNS = 60;
export const MIN_WIZARD_ROWS = 18;
export const MIN_DASHBOARD_COLUMNS = 60;
export const MIN_DASHBOARD_ROWS = 15;

export type TerminalSupport = {
  ok: boolean;
  cols: number;
  rows: number;
};

const toSize = (stream: FormatterStream): { cols: number; rows: number } => ({
  cols: Math.max(0, stream.columns ?? 0),
  rows: "rows" in stream && typeof (stream as { rows?: number }).rows === "number"
    ? Math.max(0, (stream as { rows?: number }).rows ?? 0)
    : 0
});

export const getWizardTerminalSupport = (stream: FormatterStream): TerminalSupport => {
  const { cols, rows } = toSize(stream);
  return {
    ok: cols >= MIN_WIZARD_COLUMNS && rows >= MIN_WIZARD_ROWS,
    cols,
    rows
  };
};

export const getDashboardTerminalSupport = (stream: FormatterStream): TerminalSupport => {
  const { cols, rows } = toSize(stream);
  return {
    ok: cols >= MIN_DASHBOARD_COLUMNS && rows >= MIN_DASHBOARD_ROWS,
    cols,
    rows
  };
};
