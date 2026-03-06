import { UI_COPY, toApiKeyPresenceLabel, toRunModeLabel, type UiRunMode } from "./copy.js";
import { type Formatter } from "./fmt.js";

export type RailStepState = "completed" | "active" | "pending";

export type RailStep = {
  label: string;
  state: RailStepState;
  summary?: string;
  contentLines?: string[];
};

export type WorkerRow = {
  id: number;
  state: "running" | "idle" | "finishing" | "error";
  trialId?: number;
  model?: string;
  tick?: number;
};

export const SUMMARY_COLUMN = 22;
export const CONTENT_INDENT = 4;
export const KV_KEY_WIDTH = 16;
export const MASTER_BAR_MAX = 42;
export const WORKER_BAR_WIDTH = 10;
const WORKER_ACTIVITY_PULSE = 3;

const stripAnsi = (value: string): string => value.replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, "");

const visibleLength = (value: string): number => stripAnsi(value).length;

const padRight = (value: string, width: number): string => {
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

export const renderRailStep = (step: RailStep, fmt: Formatter, dimmed = false): string => {
  const glyph =
    step.state === "completed"
      ? "✔"
      : step.state === "active"
        ? "◆"
        : "◇";
  const basePlain = `${glyph}  ${step.label}`;

  if (dimmed) {
    const gap = step.summary ? Math.max(1, SUMMARY_COLUMN - visibleLength(basePlain)) : 0;
    const suffix = step.summary ? `${" ".repeat(gap)}${step.summary}` : "";
    return fmt.muted(`${basePlain}${suffix}`);
  }

  if (step.state === "active") {
    return `${fmt.brand(glyph)}  ${fmt.bold(fmt.brand(step.label))}`;
  }
  if (step.state === "pending") {
    return `${fmt.accent(glyph)}  ${fmt.muted(step.label)}`;
  }

  const gap = step.summary ? Math.max(1, SUMMARY_COLUMN - visibleLength(basePlain)) : 0;
  const summaryPart = step.summary ? `${" ".repeat(gap)}${fmt.muted(step.summary)}` : "";
  return `${fmt.brand(glyph)}  ${fmt.text(step.label)}${summaryPart}`;
};

export const renderRailContent = (lines: string[], fmt: Formatter): string => {
  const out: string[] = [fmt.accent("│")];
  for (const rawLine of lines) {
    if (rawLine.length === 0) {
      out.push(fmt.accent("│"));
      continue;
    }
    out.push(`${fmt.accent("│")}   ${rawLine}`);
  }
  out.push(fmt.accent("│"));
  return out.join("\n");
};

export const renderRuledSection = (label: string, width: number, fmt: Formatter): string => {
  const resolvedWidth = Math.max(24, width);
  const upper = label.toUpperCase();
  const prefix = "── ";
  const spacer = " ";
  const baseLen = prefix.length + upper.length + spacer.length;
  const remaining = Math.max(0, resolvedWidth - baseLen);
  return `${fmt.accent(prefix)}${fmt.bold(fmt.brand(upper))}${fmt.accent(
    `${spacer}${"─".repeat(remaining)}`
  )}`;
};

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

export const renderBrandBlock = (
  version: string,
  apiKeyPresent: boolean,
  runMode: UiRunMode,
  configCount: number,
  width: number,
  fmt: Formatter
): string => {
  const versionText = `v${version}`;
  const pad = Math.max(2, width - UI_COPY.brand.length - versionText.length);
  const apiKeyLabel = toApiKeyPresenceLabel(apiKeyPresent);
  const apiKeyValue = apiKeyPresent ? fmt.text(apiKeyLabel) : fmt.warn(apiKeyLabel);
  const modeValue = fmt.text(toRunModeLabel(runMode));
  const configsValue = fmt.text(`${configCount} in current directory`);

  return [
    `${fmt.bold(fmt.brand(UI_COPY.brand))}${" ".repeat(pad)}${fmt.muted(versionText)}`,
    fmt.muted(UI_COPY.tagline),
    "",
    `${fmt.muted(padRight("API key:", 11))}${apiKeyValue}`,
    `${fmt.muted(padRight("Run mode:", 11))}${modeValue}`,
    `${fmt.muted(padRight("Configs:", 11))}${configsValue}`
  ].join("\n");
};

export const renderStatusStrip = (
  context: string,
  elapsedMs: number,
  width: number,
  fmt: Formatter
): string => {
  const clock = formatClock(elapsedMs);
  const left = `${fmt.brand("›")} ${fmt.bold(fmt.brand("arbiter"))}  ${fmt.muted(context)}`;
  const gap = Math.max(1, width - visibleLength(left) - clock.length);
  return `${left}${" ".repeat(gap)}${fmt.muted(clock)}`;
};

export const renderKV = (key: string, value: string, fmt: Formatter, keyWidth = KV_KEY_WIDTH): string =>
  `${fmt.muted(padRight(key, keyWidth))}${fmt.text(value)}`;

const truncatePlain = (value: string, max: number): string => {
  if (max <= 1 || value.length <= max) {
    return value;
  }
  return `${value.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
};

export const renderWorkerRow = (worker: WorkerRow, fmt: Formatter, width: number): string => {
  const stateColor = (() => {
    if (worker.state === "error") {
      return fmt.error;
    }
    if (worker.state === "finishing") {
      return fmt.accent;
    }
    if (worker.state === "running") {
      return fmt.brand;
    }
    return fmt.muted;
  })();

  const fillColor = (() => {
    if (worker.state === "error") {
      return fmt.error;
    }
    if (worker.state === "finishing") {
      return fmt.accent;
    }
    if (worker.state === "running") {
      return fmt.brand;
    }
    return fmt.muted;
  })();

  const bar = (() => {
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
    return cells
      .map((cell) => (cell === "█" ? fillColor(cell) : fmt.muted(cell)))
      .join("");
  })();

  const state = padRight(worker.state, 8);
  const trial = padRight(`trial ${worker.trialId ?? "—"}`, 9);
  const reserved = 4 + WORKER_BAR_WIDTH + 2 + 8 + 2 + 9 + 2;
  const modelWidth = Math.max(4, width - reserved);
  const model = truncatePlain(worker.model ?? "—", modelWidth);

  return `${fmt.text(padRight(`W${worker.id}`, 4))}${bar}  ${stateColor(state)}  ${fmt.text(trial)}  ${fmt.text(
    model
  )}`;
};

export const renderSeparator = (width: number, fmt: Formatter): string =>
  fmt.accent("─".repeat(Math.max(24, width)));

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
