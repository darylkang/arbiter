import { UI_COPY, toApiKeyPresenceLabel, toRunModeLabel, type UiRunMode } from "./copy.js";
import { createStdoutFormatter, type Formatter } from "./fmt.js";

type BoxChars = {
  topLeft: string;
  topRight: string;
  bottomLeft: string;
  bottomRight: string;
  horizontal: string;
  vertical: string;
};

export type ProgressStep = {
  label: string;
  status: "current" | "completed" | "pending";
  summary?: string;
};

export type CardLineStyler = (
  line: string,
  index: number,
  formatter: Formatter
) => string;

const toBoxChars = (unicode: boolean): BoxChars =>
  unicode
    ? {
        topLeft: "╭",
        topRight: "╮",
        bottomLeft: "╰",
        bottomRight: "╯",
        horizontal: "─",
        vertical: "│"
      }
    : {
        topLeft: "+",
        topRight: "+",
        bottomLeft: "+",
        bottomRight: "+",
        horizontal: "-",
        vertical: "|"
      };

const stripAnsi = (value: string): string =>
  value.replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, "");

const visibleLength = (value: string): number => stripAnsi(value).length;

const padRight = (value: string, width: number): string => {
  const len = visibleLength(value);
  if (len >= width) {
    return value;
  }
  return `${value}${" ".repeat(width - len)}`;
};

const clampCardWidth = (columns: number, requested?: number): number => {
  const maxWidth = Math.max(44, columns - 2);
  const target = requested ?? Math.min(108, Math.max(72, columns - 2));
  return Math.max(44, Math.min(maxWidth, target));
};

const splitLine = (line: string, width: number): string[] => {
  if (line.length <= width) {
    return [line];
  }
  const words = line.split(/\s+/).filter(Boolean);
  if (words.length <= 1) {
    const chunks: string[] = [];
    for (let cursor = 0; cursor < line.length; cursor += width) {
      chunks.push(line.slice(cursor, cursor + width));
    }
    return chunks;
  }
  const wrapped: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current.length === 0 ? word : `${current} ${word}`;
    if (next.length > width) {
      if (current.length > 0) {
        wrapped.push(current);
      }
      if (word.length > width) {
        wrapped.push(...splitLine(word, width));
        current = "";
      } else {
        current = word;
      }
    } else {
      current = next;
    }
  }
  if (current.length > 0) {
    wrapped.push(current);
  }
  return wrapped;
};

export const renderCard = (input: {
  title?: string;
  lines: string[];
  columns?: number;
  width?: number;
  unicode?: boolean;
  lineStyler?: CardLineStyler;
}): string => {
  const formatter = createStdoutFormatter();
  const columns = input.columns ?? process.stdout.columns ?? 100;
  const unicode = input.unicode ?? Boolean(process.stdout.isTTY);
  const box = toBoxChars(unicode);
  const width = clampCardWidth(columns, input.width);
  const inner = Math.max(10, width - 4);

  const bodyLines = input.lines.flatMap((line) => splitLine(line, inner));
  const styleBorder = (value: string): string => formatter.muted(value);
  const top = (() => {
    if (!input.title || input.title.trim().length === 0) {
      return styleBorder(`${box.topLeft}${box.horizontal.repeat(width - 2)}${box.topRight}`);
    }
    const title = ` ${input.title.trim()} `;
    const titleLen = Math.min(title.length, width - 4);
    const clipped = title.slice(0, titleLen);
    const remaining = Math.max(0, width - 2 - titleLen);
    return `${styleBorder(box.topLeft)}${formatter.bold(formatter.accent(clipped))}${styleBorder(
      `${box.horizontal.repeat(remaining)}${box.topRight}`
    )}`;
  })();

  const middle = bodyLines.map((line, index) => {
    const padded = padRight(line, inner);
    const content = input.lineStyler
      ? input.lineStyler(padded, index, formatter)
      : formatter.text(padded);
    return `${styleBorder(box.vertical)} ${content} ${styleBorder(box.vertical)}`;
  });
  const bottom = styleBorder(`${box.bottomLeft}${box.horizontal.repeat(width - 2)}${box.bottomRight}`);
  return [top, ...middle, bottom].join("\n");
};

export const renderMasthead = (input: {
  version: string;
  apiKeyPresent: boolean;
  runMode: UiRunMode;
  configCount: number;
  columns?: number;
  unicode?: boolean;
}): string => {
  const lines = [
    UI_COPY.tagline,
    `Version ${input.version}`,
    "",
    "Environment",
    `OpenRouter API key: ${toApiKeyPresenceLabel(input.apiKeyPresent)}`,
    `Run mode: ${toRunModeLabel(input.runMode)}`,
    `Configs in current directory: ${input.configCount}`
  ];
  return renderCard({
    title: UI_COPY.brand,
    lines,
    columns: input.columns,
    unicode: input.unicode
  });
};

const toProgressMarker = (status: ProgressStep["status"], unicode: boolean): string => {
  if (status === "current") {
    return unicode ? "▸" : ">";
  }
  if (status === "completed") {
    return unicode ? "◆" : "*";
  }
  return unicode ? "·" : ".";
};

export const renderProgressSpine = (input: {
  steps: ProgressStep[];
  columns?: number;
  unicode?: boolean;
}): string => {
  const unicode = input.unicode ?? Boolean(process.stdout.isTTY);
  const lines: string[] = [];
  for (const step of input.steps) {
    lines.push(`${toProgressMarker(step.status, unicode)} ${step.label}`);
    if (step.summary) {
      lines.push(`  ${step.summary}`);
    }
  }
  return renderCard({
    title: "Progress",
    lines,
    columns: input.columns,
    unicode,
    lineStyler: (line, _index, formatter) => {
      const trimmed = line.trimStart();
      if (trimmed.startsWith("▸") || trimmed.startsWith(">")) {
        return formatter.bold(formatter.accent(line));
      }
      if (trimmed.startsWith("◆") || trimmed.startsWith("*")) {
        return formatter.success(line);
      }
      if (trimmed.startsWith("·") || trimmed.startsWith(".")) {
        return formatter.muted(line);
      }
      if (trimmed.startsWith("✔")) {
        return formatter.success(line);
      }
      return formatter.text(line);
    }
  });
};

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
