export type FormatterStream = {
  isTTY?: boolean;
  columns?: number;
};

export type FormatterOptions = {
  stream?: FormatterStream;
  env?: NodeJS.ProcessEnv;
};

export type StatusLevel = "success" | "warn" | "error" | "info";

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";

const shouldUseUnicode = (stream: FormatterStream | undefined): boolean =>
  Boolean(stream?.isTTY);

const isTruthyEnv = (value: string | undefined): boolean =>
  typeof value === "string" && value !== "0" && value.trim().length > 0;

const shouldUseColor = (stream: FormatterStream | undefined, env: NodeJS.ProcessEnv): boolean => {
  if (isTruthyEnv(env.CLICOLOR_FORCE)) {
    return true;
  }
  if (isTruthyEnv(env.NO_COLOR)) {
    return false;
  }
  if (env.CLICOLOR === "0") {
    return false;
  }
  return Boolean(stream?.isTTY);
};

const supportsExtendedColor = (env: NodeJS.ProcessEnv): boolean => {
  const term = env.TERM ?? "";
  const colorTerm = env.COLORTERM ?? "";
  return term.includes("256color") || colorTerm.includes("truecolor") || colorTerm.includes("24bit");
};

const buildColorCodes = (enabled: boolean, extended: boolean) => {
  if (!enabled) {
    return {
      brand: "",
      accent: "",
      success: "",
      error: "",
      warn: "",
      info: "",
      muted: "",
      text: "",
      bold: ""
    };
  }

  if (extended) {
    return {
      brand: "\x1b[38;5;214m", // gruvbox dark bright yellow
      accent: "\x1b[38;5;208m", // gruvbox orange
      success: "\x1b[38;5;142m", // gruvbox green
      error: "\x1b[38;5;167m", // gruvbox red
      warn: "\x1b[38;5;214m",
      info: "\x1b[38;5;109m", // gruvbox blue
      muted: "\x1b[38;5;245m", // gruvbox gray
      text: "\x1b[38;5;223m", // gruvbox light fg
      bold: BOLD
    };
  }

  return {
    brand: "\x1b[33m",
    accent: "\x1b[33m",
    success: "\x1b[32m",
    error: "\x1b[31m",
    warn: "\x1b[33m",
    info: "\x1b[36m",
    muted: "\x1b[90m",
    text: "\x1b[37m",
    bold: BOLD
  };
};

const wrap = (code: string, value: string): string => (code ? `${code}${value}${RESET}` : value);

const padKey = (value: string, width: number): string => {
  if (value.length >= width) {
    return value;
  }
  return `${value}${" ".repeat(width - value.length)}`;
};

const normalizeWidth = (width: number): number => Math.max(24, Math.min(width, 78));

const toPlainPrefix = (level: StatusLevel): string => {
  if (level === "success") {
    return "OK";
  }
  if (level === "warn") {
    return "WARN";
  }
  if (level === "error") {
    return "ERROR";
  }
  return "INFO";
};

const toColorCodeKey = (level: StatusLevel): "success" | "warn" | "error" | "info" => level;

const toSymbol = (level: StatusLevel, unicode: boolean): string => {
  if (!unicode) {
    return toPlainPrefix(level);
  }
  if (level === "success") {
    return "✔";
  }
  if (level === "warn") {
    return "▲";
  }
  if (level === "error") {
    return "✖";
  }
  return "●";
};

export type Formatter = {
  isTTY: boolean;
  isColorEnabled: boolean;
  termWidth: () => number;
  brand: (value: string) => string;
  accent: (value: string) => string;
  success: (value: string) => string;
  error: (value: string) => string;
  warn: (value: string) => string;
  info: (value: string) => string;
  muted: (value: string) => string;
  text: (value: string) => string;
  bold: (value: string) => string;
  divider: (width?: number) => string;
  header: (title: string, width?: number) => string;
  kv: (key: string, value: string, keyWidth?: number) => string;
  statusChip: (label: string, level: StatusLevel, detail?: string) => string;
  warnBlock: (message: string) => string;
  errorBlock: (message: string, suggestion?: string) => string;
  successBlock: (message: string) => string;
  tip: (message: string) => string;
};

export const createFormatter = (options?: FormatterOptions): Formatter => {
  const stream = options?.stream ?? process.stdout;
  const env = options?.env ?? process.env;

  const tty = Boolean(stream.isTTY);
  const unicode = shouldUseUnicode(stream);
  const colorEnabled = shouldUseColor(stream, env);
  const extended = colorEnabled && supportsExtendedColor(env);
  const colors = buildColorCodes(colorEnabled, extended);

  const color = <K extends keyof ReturnType<typeof buildColorCodes>>(key: K, value: string): string =>
    wrap(colors[key], value);

  const termWidth = (): number => normalizeWidth(stream.columns ?? 80);

  const divider = (width?: number): string => {
    const resolvedWidth = normalizeWidth(width ?? termWidth());
    return color("muted", "─".repeat(resolvedWidth));
  };

  const header = (title: string, width?: number): string => {
    if (!tty) {
      return title;
    }
    return `${color("bold", color("brand", title))}\n${divider(width)}`;
  };

  const kv = (key: string, value: string, keyWidth = 14): string => {
    if (!tty) {
      return `${key}: ${value}`;
    }
    return `${color("muted", padKey(key, keyWidth))} ${color("text", value)}`;
  };

  const statusChip = (label: string, level: StatusLevel, detail?: string): string => {
    if (!tty) {
      return `${toPlainPrefix(level)} ${label}${detail ? ` ${detail}` : ""}`;
    }
    const symbol = color(toColorCodeKey(level), toSymbol(level, unicode));
    const labelText = color("text", label);
    const detailText = detail ? ` ${color("muted", detail)}` : "";
    return `${symbol} ${labelText}${detailText}`;
  };

  const warnBlock = (message: string): string => {
    if (!tty) {
      return `warn: ${message}`;
    }
    return `${color("warn", `${toSymbol("warn", unicode)} warn:`)} ${color("text", message)}`;
  };

  const errorBlock = (message: string, suggestion?: string): string => {
    if (!tty) {
      return suggestion ? `error: ${message}\n${suggestion}` : `error: ${message}`;
    }
    const firstLine = `${color("error", `${toSymbol("error", unicode)} error:`)} ${color("text", message)}`;
    if (!suggestion) {
      return firstLine;
    }
    return `${firstLine}\n${color("muted", suggestion)}`;
  };

  const successBlock = (message: string): string => {
    if (!tty) {
      return message;
    }
    return `${color("success", `${toSymbol("success", unicode)} `)}${color("text", message)}`;
  };

  const tip = (message: string): string => {
    if (!tty) {
      return `Next: ${message}`;
    }
    const marker = unicode ? "→" : "->";
    return `${color("info", marker)} ${color("muted", `Next: ${message}`)}`;
  };

  return {
    isTTY: tty,
    isColorEnabled: colorEnabled,
    termWidth,
    brand: (value) => color("brand", value),
    accent: (value) => color("accent", value),
    success: (value) => color("success", value),
    error: (value) => color("error", value),
    warn: (value) => color("warn", value),
    info: (value) => color("info", value),
    muted: (value) => color("muted", value),
    text: (value) => color("text", value),
    bold: (value) => color("bold", value),
    divider,
    header,
    kv,
    statusChip,
    warnBlock,
    errorBlock,
    successBlock,
    tip
  };
};

export const createStdoutFormatter = (): Formatter =>
  createFormatter({ stream: process.stdout, env: process.env });

export const createStderrFormatter = (): Formatter =>
  createFormatter({ stream: process.stderr, env: process.env });
