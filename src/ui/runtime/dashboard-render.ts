import { UI_COPY } from "../copy.js";
import { createStdoutFormatter, type Formatter } from "../fmt.js";
import type { DashboardVM } from "../runtime-view-models.js";
import {
  MASTER_BAR_MAX,
  renderKV,
  renderProgressBar,
  renderRuledSection,
  renderSeparator,
  renderStageHeader,
  renderWorkerRow
} from "../wizard-theme.js";
import { countRenderedRows, countRowsForLines } from "./live-region.js";
import { formatClockHMS, renderToneLine } from "./render-utils.js";

type DashboardRenderOptions = {
  width?: number;
  maxRows?: number;
  fmt?: Formatter;
};

const buildWorkerSection = (
  workerRows: DashboardVM["workerRows"],
  fmt: Formatter,
  width: number,
  compact: boolean,
  remainingRows: number
): string[] => {
  if (workerRows.length <= 1 || remainingRows <= 0) {
    return [];
  }

  const sectionPrefix = [
    renderRuledSection("WORKERS", width, fmt),
    ...(compact ? [] : [""]),
    fmt.muted("ID  Activity      State     Trial     Model")
  ];
  const prefixRows = countRowsForLines(sectionPrefix, width);
  const overflowRows = countRowsForLines([fmt.muted("(+0 more workers)")], width);
  const minVisibleRows = prefixRows + 1;
  if (remainingRows < minVisibleRows) {
    return [];
  }

  let visibleCount = 0;
  let usedRows = prefixRows;
  while (visibleCount < workerRows.length) {
    const workerLine = renderWorkerRow(workerRows[visibleCount]!, fmt, width);
    const workerLineRows = countRenderedRows(workerLine, width);
    const remainingWorkers = workerRows.length - (visibleCount + 1);
    const requiredOverflowRows = remainingWorkers > 0 ? overflowRows : 0;
    if (usedRows + workerLineRows + requiredOverflowRows > remainingRows) {
      break;
    }
    usedRows += workerLineRows;
    visibleCount += 1;
  }

  if (visibleCount === 0) {
    return [];
  }

  const lines = [...sectionPrefix];
  for (let index = 0; index < visibleCount; index += 1) {
    lines.push(renderWorkerRow(workerRows[index]!, fmt, width));
  }
  const hidden = workerRows.length - visibleCount;
  if (hidden > 0) {
    lines.push(fmt.muted(`(+${hidden} more workers)`));
  }
  return lines;
};

export const buildDashboardTooSmallText = (width: number, fmt: Formatter = createStdoutFormatter()): string =>
  `${renderStageHeader(UI_COPY.runHeader, 0, width, fmt)}\n\n${fmt.warn(UI_COPY.dashboardTerminalTooSmall)}\n`;

export const buildRunDashboardText = (vm: DashboardVM, options: DashboardRenderOptions = {}): string => {
  const fmt = options.fmt ?? createStdoutFormatter();
  const width = options.width ?? fmt.termWidth();
  const maxRows = options.maxRows;
  const compact = maxRows !== undefined && maxRows <= 18;
  const elapsed = formatClockHMS(vm.elapsedMs);
  const masterBar = renderProgressBar(
    vm.progressPct,
    Math.min(MASTER_BAR_MAX, Math.max(10, width - 34)),
    fmt.brand,
    fmt
  );
  const sections: string[] = [];
  let usedRows = 0;
  const pushBlock = (block: string[], required = false): boolean => {
    if (block.length === 0) {
      return true;
    }
    const blockRows = countRowsForLines(block, width);
    if (!required && maxRows !== undefined && usedRows + blockRows > maxRows) {
      return false;
    }
    sections.push(...block);
    usedRows += blockRows;
    return true;
  };

  pushBlock([renderStageHeader(UI_COPY.runHeader, vm.elapsedMs, width, fmt)], true);
  pushBlock([""], true);
  pushBlock(
    [
      renderRuledSection("PROGRESS", width, fmt),
      ...(compact ? [] : [""]),
      vm.progressLabel,
      `${masterBar}  ${String(Math.round(vm.progressPct)).padStart(3, " ")}%    ${elapsed}  ETA ${vm.eta}`
    ],
    true
  );
  if (!compact) {
    pushBlock([""]);
  }

  const monitoringBlock = [
    renderRuledSection("MONITORING", width, fmt),
    ...(compact ? [] : [""]),
    ...vm.monitoringRows.map((row) => renderKV(row.key, row.value, fmt))
  ];
  pushBlock(monitoringBlock, true);

  const caveatBlock = vm.caveatLines.map((line) => renderToneLine(line.text, line.tone, fmt));
  pushBlock(compact ? caveatBlock : ["", ...caveatBlock], true);

  const footerBlock = compact
    ? [renderSeparator(width, fmt), fmt.muted(vm.footerText)]
    : ["", renderSeparator(width, fmt), fmt.muted(vm.footerText)];
  const footerRows = countRowsForLines(footerBlock, width);

  const remainingBeforeFooter =
    maxRows === undefined ? Number.POSITIVE_INFINITY : Math.max(0, maxRows - usedRows - footerRows);
  const workerBlock = buildWorkerSection(vm.workerRows, fmt, width, compact, remainingBeforeFooter);
  if (workerBlock.length > 0) {
    pushBlock(compact ? workerBlock : ["", ...workerBlock]);
  }

  const usageBlock = [
    renderRuledSection("USAGE", width, fmt),
    ...(compact ? [] : [""]),
    ...vm.usageLines.map((line) => renderToneLine(line.text, line.tone, fmt))
  ];
  pushBlock(compact ? usageBlock : ["", ...usageBlock]);

  pushBlock(footerBlock, true);

  return `${sections.join("\n")}\n`;
};
