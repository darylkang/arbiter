import { UI_COPY, toApiKeyPresenceLabel, toRunModeLabel, type UiRunMode } from "./copy.js";
import { type Formatter } from "./fmt.js";
import { stripAnsi } from "./runtime/render-utils.js";
import type { WorkerRow } from "./runtime-view-models.js";

export type RailStepState = "completed" | "active" | "pending";

export type RailStep = {
  label: string;
  state: RailStepState;
  summary?: string;
  contentLines?: string[];
};

export type HeaderVariant = "expanded" | "compact" | "minimal";

export const SUMMARY_COLUMN = 24;
export const CONTENT_INDENT = 4;
export const KV_KEY_WIDTH = 16;
export const MASTER_BAR_MAX = 42;
export const WORKER_BAR_WIDTH = 10;

const PANEL_MIN_WIDTH = 48;
const WORKER_ACTIVITY_PULSE = 3;
const STAGE_BAR = "▍";
const RAIL_CONNECTOR = "│";

const visibleLength = (value: string): number => stripAnsi(value).length;

const padVisibleRight = (value: string, width: number): string => {
  const len = visibleLength(value);
  if (len >= width) {
    return value;
  }
  return `${value}${" ".repeat(width - len)}`;
};

const formatClock = (elapsedMs: number): string => {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${mm}:${ss}`;
  }
  return `${mm}:${ss}`;
};

const toRatio = (pct: number): number => {
  if (!Number.isFinite(pct)) {
    return 0;
  }
  if (pct <= 1) {
    return Math.max(0, Math.min(1, pct));
  }
  return Math.max(0, Math.min(1, pct / 100));
};

const truncatePlain = (value: string, max: number): string => {
  if (max <= 1 || value.length <= max) {
    return value;
  }
  return `${value.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
};

const buildPanelLine = (content: string, width: number, fmt: Formatter): string => {
  const outerWidth = Math.max(PANEL_MIN_WIDTH, width);
  const innerWidth = Math.max(4, outerWidth - 4);
  return `${fmt.accent("│")} ${padVisibleRight(content, innerWidth)} ${fmt.accent("│")}`;
};

const renderStatusSegment = (
  label: string,
  value: string,
  dot: (value: string) => string,
  valueTone: (value: string) => string,
  fmt: Formatter
): string => `${dot("●")} ${fmt.muted(label)} ${valueTone(value)}`;

const buildCompactStatusRows = (
  apiKeyPresent: boolean,
  runMode: UiRunMode,
  configCount: number,
  width: number,
  fmt: Formatter
): string[] => {
  const apiValue = toApiKeyPresenceLabel(apiKeyPresent);
  const apiSegment = renderStatusSegment(
    "API key",
    apiValue,
    apiKeyPresent ? fmt.success : fmt.warn,
    apiKeyPresent ? fmt.text : fmt.warn,
    fmt
  );
  const runModeSegment = renderStatusSegment(
    "Run mode",
    toRunModeLabel(runMode),
    fmt.brand,
    fmt.text,
    fmt
  );
  const configSegment = renderStatusSegment(
    "Configs",
    String(configCount),
    fmt.accent,
    fmt.text,
    fmt
  );

  const all = [apiSegment, runModeSegment, configSegment].join("   ");
  if (visibleLength(all) <= width) {
    return [all];
  }

  const firstRow = [apiSegment, runModeSegment].join("   ");
  if (visibleLength(firstRow) <= width) {
    return [firstRow, configSegment];
  }

  return [apiSegment, runModeSegment, configSegment];
};

export const renderStageHeader = (
  label: string,
  elapsedMs: number,
  width: number,
  fmt: Formatter
): string => {
  const clock = formatClock(elapsedMs);
  const stageLabel = label.startsWith(STAGE_BAR) ? label : `${STAGE_BAR} ${label}`;
  const left = fmt.bold(fmt.brand(stageLabel));
  const gap = Math.max(1, width - visibleLength(left) - clock.length);
  return `${left}${" ".repeat(gap)}${fmt.muted(clock)}`;
};

export const renderSignalRow = (
  label: string,
  value: string,
  dotTone: "success" | "warn" | "brand" | "accent",
  valueTone: "text" | "warn" = "text",
  fmt: Formatter
): string => {
  const dot =
    dotTone === "success"
      ? fmt.success("●")
      : dotTone === "warn"
        ? fmt.warn("●")
        : dotTone === "brand"
          ? fmt.brand("●")
          : fmt.accent("●");
  const renderedValue = valueTone === "warn" ? fmt.warn(value) : fmt.text(value);
  return `${dot} ${fmt.muted(label.padEnd(10))}${renderedValue}`;
};

export const renderExpandedHeader = (
  version: string,
  apiKeyPresent: boolean,
  runMode: UiRunMode,
  configCount: number,
  width: number,
  fmt: Formatter
): string => {
  const outerWidth = Math.max(PANEL_MIN_WIDTH, width);
  const top = `${fmt.accent("╭")}${fmt.accent("─".repeat(outerWidth - 2))}${fmt.accent("╮")}`;
  const bottom = `${fmt.accent("╰")}${fmt.accent("─".repeat(outerWidth - 2))}${fmt.accent("╯")}`;
  const versionText = `v${version}`;
  const innerWidth = Math.max(4, outerWidth - 4);
  const brandLine = `${fmt.bold(fmt.brand(UI_COPY.brand))}${" ".repeat(
    Math.max(1, innerWidth - UI_COPY.brand.length - versionText.length)
  )}${fmt.muted(versionText)}`;

  return [
    top,
    buildPanelLine("", outerWidth, fmt),
    buildPanelLine(brandLine, outerWidth, fmt),
    buildPanelLine(fmt.muted(UI_COPY.tagline), outerWidth, fmt),
    buildPanelLine("", outerWidth, fmt),
    buildPanelLine(
      renderSignalRow(
        "API key",
        toApiKeyPresenceLabel(apiKeyPresent),
        apiKeyPresent ? "success" : "warn",
        apiKeyPresent ? "text" : "warn",
        fmt
      ),
      outerWidth,
      fmt
    ),
    buildPanelLine(
      renderSignalRow("Run mode", toRunModeLabel(runMode), "brand", "text", fmt),
      outerWidth,
      fmt
    ),
    buildPanelLine(
      renderSignalRow("Configs", `${configCount} in current directory`, "accent", "text", fmt),
      outerWidth,
      fmt
    ),
    buildPanelLine("", outerWidth, fmt),
    bottom
  ].join("\n");
};


export const renderMinimalHeader = (version: string, width: number, fmt: Formatter): string => {
  const versionText = `v${version}`;
  const left = fmt.bold(fmt.brand(UI_COPY.brand));
  const gap = Math.max(1, width - UI_COPY.brand.length - versionText.length);
  return `${left}${" ".repeat(gap)}${fmt.muted(versionText)}`;
};

export const renderCompactHeader = (
  version: string,
  apiKeyPresent: boolean,
  runMode: UiRunMode,
  configCount: number,
  width: number,
  fmt: Formatter
): string => {
  const versionText = `v${version}`;
  const left = fmt.bold(fmt.brand(UI_COPY.brand));
  const gap = Math.max(1, width - UI_COPY.brand.length - versionText.length);
  const compactRows = buildCompactStatusRows(apiKeyPresent, runMode, configCount, width, fmt);
  return [`${left}${" ".repeat(gap)}${fmt.muted(versionText)}`, ...compactRows].join("\n");
};

export const renderBrandBlock = (
  version: string,
  apiKeyPresent: boolean,
  runMode: UiRunMode,
  configCount: number,
  width: number,
  fmt: Formatter,
  variant: HeaderVariant = "expanded"
): string => {
  if (variant === "minimal") {
    return renderMinimalHeader(version, width, fmt);
  }
  return variant === "compact"
    ? renderCompactHeader(version, apiKeyPresent, runMode, configCount, width, fmt)
    : renderExpandedHeader(version, apiKeyPresent, runMode, configCount, width, fmt);
};

export const renderRailStep = (step: RailStep, fmt: Formatter, dimmed = false): string => {
  const glyph =
    step.state === "completed" ? "◆" : step.state === "active" ? "▸" : "◇";
  const basePlain = `${glyph}  ${step.label}`;
  const gap = step.summary ? Math.max(1, SUMMARY_COLUMN - visibleLength(basePlain)) : 0;
  const summaryPart = step.summary ? `${" ".repeat(gap)}${step.summary}` : "";

  if (dimmed) {
    return fmt.muted(`${basePlain}${summaryPart}`);
  }

  if (step.state === "active") {
    return `${fmt.brand(glyph)}  ${fmt.bold(fmt.brand(step.label))}`;
  }

  if (step.state === "pending") {
    return `${fmt.muted(glyph)}  ${fmt.muted(step.label)}`;
  }

  return `${fmt.success(glyph)}  ${fmt.text(step.label)}${step.summary ? `${" ".repeat(gap)}${fmt.muted(step.summary)}` : ""}`;
};

export const renderRailContent = (lines: string[], fmt: Formatter): string => {
  const out: string[] = [`${fmt.accent(RAIL_CONNECTOR)}`];
  for (const rawLine of lines) {
    if (rawLine.length === 0) {
      out.push(fmt.accent(RAIL_CONNECTOR));
      continue;
    }
    out.push(`${fmt.accent(RAIL_CONNECTOR)}   ${rawLine}`);
  }
  out.push(fmt.accent(RAIL_CONNECTOR));
  return out.join("\n");
};

export const renderRuledSection = (label: string, _width: number, fmt: Formatter): string =>
  `${fmt.accent("──")} ${fmt.bold(fmt.accent(label.toUpperCase()))}`;

export const renderProgressBar = (
  pct: number,
  width: number,
  fillColor: (value: string) => string,
  fmt: Formatter
): string => {
  const resolvedWidth = Math.max(6, width);
  const ratio = toRatio(pct);
  const filled = Math.round(ratio * resolvedWidth);
  const empty = Math.max(0, resolvedWidth - filled);
  const fill = filled > 0 ? fillColor("█".repeat(filled)) : "";
  const rest = empty > 0 ? fmt.muted("░".repeat(empty)) : "";
  return `${fill}${rest}`;
};

export const renderKV = (key: string, value: string, fmt: Formatter, keyWidth = KV_KEY_WIDTH): string =>
  `${fmt.muted(padVisibleRight(key, keyWidth))}${fmt.text(value)}`;

export const renderWorkerRow = (worker: WorkerRow, fmt: Formatter, width: number): string => {
  const stateColor =
    worker.state === "error"
      ? fmt.error
      : worker.state === "finishing"
        ? fmt.accent
        : worker.state === "running"
          ? fmt.brand
          : fmt.muted;

  const fillColor =
    worker.state === "error"
      ? fmt.error
      : worker.state === "finishing"
        ? fmt.accent
        : worker.state === "running"
          ? fmt.brand
          : fmt.muted;

  const activity = (() => {
    if (worker.state === "finishing") {
      return renderProgressBar(100, WORKER_BAR_WIDTH, fillColor, fmt);
    }
    if (worker.state === "error") {
      return fillColor("█".repeat(WORKER_BAR_WIDTH));
    }
    if (worker.state === "idle") {
      const spinnerFrames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
      const spinner = spinnerFrames[Math.max(0, worker.tick ?? 0) % spinnerFrames.length];
      return `${fmt.muted(spinner)}${fmt.muted("░".repeat(Math.max(0, WORKER_BAR_WIDTH - 1)))}`;
    }
    const tick = Math.max(0, worker.tick ?? 0) % WORKER_BAR_WIDTH;
    const cells = Array.from({ length: WORKER_BAR_WIDTH }, (_, index) =>
      index >= tick && index < tick + WORKER_ACTIVITY_PULSE ? "█" : "░"
    );
    return cells.map((cell) => (cell === "█" ? fillColor(cell) : fmt.muted(cell))).join("");
  })();

  const state = padVisibleRight(worker.state, 10);
  const trial = padVisibleRight(`trial ${worker.trialId ?? "—"}`, 11);
  const reserved = 4 + WORKER_BAR_WIDTH + 2 + 10 + 2 + 11 + 2;
  const modelWidth = Math.max(8, width - reserved);
  const model = truncatePlain(worker.model ?? "—", modelWidth);

  return `${fmt.text(padVisibleRight(`W${worker.id}`, 4))}${activity}  ${stateColor(state)}  ${fmt.text(
    trial
  )}  ${fmt.text(model)}`;
};

export const renderSeparator = (width: number, fmt: Formatter): string =>
  fmt.muted("─".repeat(Math.max(24, width)));

export const truncate = (value: string, max: number): string => {
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
};

export const countRenderedLines = (value: string): number => {
  if (value.length === 0) {
    return 0;
  }
  return value.replace(/\n+$/, "").split("\n").length;
};
