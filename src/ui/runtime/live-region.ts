const ANSI_CSI_REGEX = /\u001b\[[0-9;?]*[ -/]*[@-~]/g;

export type LiveRegionLayout = {
  terminalRows: number;
  topRow: number;
  liveRows: number;
};

export const stripAnsi = (value: string): string =>
  value.replace(ANSI_CSI_REGEX, "").replace(/\r/g, "");

// This is intentionally limited to Arbiter's current live-region glyph set:
// single-width BMP characters only. If the dashboard ever renders wide
// characters in the live region, this width math must be replaced.
export const countRenderedRows = (value: string, columns: number): number => {
  const width = Math.max(1, columns);
  const lines = stripAnsi(value).replace(/\n+$/, "").split("\n");
  let total = 0;
  for (const line of lines) {
    total += Math.max(1, Math.ceil(line.length / width));
  }
  return total;
};

export const countRowsForLines = (lines: string[], columns: number): number =>
  lines.reduce((total, line) => total + countRenderedRows(line, columns), 0);

export const computeLiveRegionLayout = (
  terminalRows: number,
  prefixRows: number,
  minLiveRows: number
): LiveRegionLayout => {
  const resolvedRows = Math.max(2, terminalRows);
  const visiblePrefixRows = Math.min(prefixRows, Math.max(0, resolvedRows - minLiveRows));
  const topRow = Math.min(Math.max(1, visiblePrefixRows + 1), resolvedRows);
  const liveRows = Math.max(1, resolvedRows - visiblePrefixRows);
  return {
    terminalRows: resolvedRows,
    topRow,
    liveRows
  };
};

export const nextRowAfterLiveRegion = (layout: LiveRegionLayout): number =>
  Math.min(layout.terminalRows, layout.topRow + layout.liveRows);
