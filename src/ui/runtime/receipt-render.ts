import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { toStopBanner, UI_COPY } from "../copy.js";
import { createStdoutFormatter, type Formatter } from "../fmt.js";
import { buildReceiptModel } from "../receipt-model.js";
import type { ReceiptVM } from "../runtime-view-models.js";
import { renderKV, renderRuledSection, renderSeparator, renderStageHeader } from "../wizard-theme.js";
import { formatClockHMS, renderToneLine, toDisplayConfigPath } from "./render-utils.js";

type ReceiptRenderOptions = {
  width?: number;
  fmt?: Formatter;
};

const toDurationFromIso = (startedAt?: string, completedAt?: string): string => {
  if (!startedAt || !completedAt) {
    return "—";
  }
  const started = Date.parse(startedAt);
  const completed = Date.parse(completedAt);
  if (!Number.isFinite(started) || !Number.isFinite(completed) || completed < started) {
    return "—";
  }
  const elapsedMs = completed - started;
  if (elapsedMs < 1000) {
    return "—";
  }
  return formatClockHMS(elapsedMs);
};

export const readReceiptText = (runDir: string): string | null => {
  const receiptPath = resolve(runDir, "receipt.txt");
  if (!existsSync(receiptPath)) {
    return null;
  }
  return readFileSync(receiptPath, "utf8");
};

export const buildReceiptViewModel = (runDir: string): ReceiptVM => {
  const model = buildReceiptModel(runDir);
  const stopBanner = toStopBanner(model.stop_reason);
  const stopReasonLabel = stopBanner.replace(/^Stopped:\s*/i, "").trim() || "unknown";
  const summaryRows = [
    { key: "Stop reason", value: stopReasonLabel },
    {
      key: "Trials",
      value: `${model.counts.k_planned ?? "-"} / ${model.counts.k_attempted ?? "-"} / ${model.counts.k_eligible ?? "-"} (planned / completed / eligible)`
    },
    { key: "Duration", value: toDurationFromIso(model.started_at, model.completed_at) },
    {
      key: "Usage",
      value: model.usage
        ? `${model.usage.totals.total_tokens} tokens (in ${model.usage.totals.prompt_tokens}, out ${model.usage.totals.completion_tokens})`
        : "not available"
    },
    { key: "Protocol", value: model.protocol ?? "-" },
    { key: "Models", value: `${model.model_count}` },
    { key: "Personas", value: `${model.persona_count}` }
  ];

  const groupLines: ReceiptVM["groupLines"] = [];
  if (model.grouping?.enabled) {
    groupLines.push({ text: `Embedding groups: ${model.grouping.group_count ?? "—"}`, tone: "text" });
    groupLines.push({ text: "Top group sizes", tone: "text" });
    groupLines.push({
      text: model.grouping.group_count !== undefined ? String(model.grouping.group_count) : "—",
      tone: "text"
    });
    groupLines.push({ text: UI_COPY.groupingCaveat, tone: "muted" });
  }

  const artifactRows: string[] = ["Only generated files are listed."];
  if ((model.artifacts?.length ?? 0) === 0) {
    artifactRows.push("—");
  } else {
    artifactRows.push(...(model.artifacts?.map((artifact) => artifact.path) ?? []));
  }
  if ((model.counts.k_eligible ?? 0) === 0) {
    artifactRows.push("No embeddings were generated because there were zero eligible trials.");
  }

  return {
    statusContext: UI_COPY.receiptHeader,
    stopBanner,
    caveatLines: [{ text: UI_COPY.stoppingCaveat, tone: "muted" }],
    summaryRows,
    groupLines,
    artifactRows,
    reproduceCommand: `arbiter run --config ${toDisplayConfigPath(runDir)}`,
    footerText: UI_COPY.completionFooter
  };
};

export const buildReceiptDisplayText = (vm: ReceiptVM, options: ReceiptRenderOptions = {}): string => {
  const fmt = options.fmt ?? createStdoutFormatter();
  const width = options.width ?? fmt.termWidth();
  const lines: string[] = [
    renderStageHeader(UI_COPY.receiptHeader, 0, width, fmt),
    "",
    vm.stopBanner,
    ...vm.caveatLines.map((line) => renderToneLine(line.text, line.tone, fmt)),
    "",
    renderRuledSection("SUMMARY", width, fmt),
    "",
    ...vm.summaryRows.map((row) => renderKV(row.key, row.value, fmt))
  ];

  if (vm.groupLines.length > 0) {
    lines.push("");
    lines.push(renderRuledSection("GROUPS", width, fmt));
    lines.push("");
    lines.push(...vm.groupLines.map((line) => renderToneLine(line.text, line.tone, fmt)));
  }

  lines.push("");
  lines.push(renderRuledSection("ARTIFACTS", width, fmt));
  lines.push("");
  vm.artifactRows.forEach((line, index) => {
    lines.push(index === 0 ? fmt.muted(line) : fmt.text(line));
  });
  lines.push("");
  lines.push(renderRuledSection("REPRODUCE", width, fmt));
  lines.push("");
  lines.push(vm.reproduceCommand);
  lines.push("");
  lines.push(renderSeparator(width, fmt));
  lines.push(fmt.muted(vm.footerText));
  return `${lines.join("\n")}\n`;
};

export const buildReceiptDisplayTextFromRunDir = (runDir: string): string | null => {
  try {
    return buildReceiptDisplayText(buildReceiptViewModel(runDir));
  } catch {
    return null;
  }
};
