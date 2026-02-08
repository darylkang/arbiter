import type { EditorTheme, SelectListTheme, SettingsListTheme } from "@mariozechner/pi-tui";

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";

const FG_AMBER = "\x1b[38;5;214m";
const FG_ORANGE = "\x1b[38;5;208m";
const FG_PHOSPHOR = "\x1b[38;5;118m";
const FG_IVORY = "\x1b[38;5;230m";
const FG_STEEL = "\x1b[38;5;245m";
const FG_CRIMSON = "\x1b[38;5;203m";
const FG_CYAN = "\x1b[38;5;116m";
const FG_WARNING = "\x1b[38;5;220m";

const wrap = (code: string, text: string): string => `${code}${text}${RESET}`;

export const palette = {
  amber: (text: string): string => wrap(FG_AMBER, text),
  orange: (text: string): string => wrap(FG_ORANGE, text),
  phosphor: (text: string): string => wrap(FG_PHOSPHOR, text),
  ivory: (text: string): string => wrap(FG_IVORY, text),
  steel: (text: string): string => wrap(FG_STEEL, text),
  crimson: (text: string): string => wrap(FG_CRIMSON, text),
  cyan: (text: string): string => wrap(FG_CYAN, text),
  warning: (text: string): string => wrap(FG_WARNING, text),
  bold: (text: string): string => wrap(BOLD, text),
  headline: (text: string): string => `${BOLD}${FG_AMBER}${text}${RESET}`
};

export const bannerLines = [
  " █████╗ ██████╗ ██████╗ ██╗████████╗███████╗██████╗ ",
  "██╔══██╗██╔══██╗██╔══██╗██║╚══██╔══╝██╔════╝██╔══██╗",
  "███████║██████╔╝██████╔╝██║   ██║   █████╗  ██████╔╝",
  "██╔══██║██╔══██╗██╔══██╗██║   ██║   ██╔══╝  ██╔══██╗",
  "██║  ██║██║  ██║██████╔╝██║   ██║   ███████╗██║  ██║",
  "╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝ ╚═╝   ╚═╝   ╚══════╝╚═╝  ╚═╝"
];

export const styleEntryPrefix = (kind: string, timestamp: string): string => {
  const hhmmss = timestamp.slice(11, 19);
  const prefix = `[${hhmmss}]`;
  if (kind === "error") {
    return palette.crimson(prefix);
  }
  if (kind === "warning") {
    return palette.warning(prefix);
  }
  if (kind === "user") {
    return palette.cyan(prefix);
  }
  if (kind === "progress") {
    return palette.phosphor(prefix);
  }
  if (kind === "receipt" || kind === "report" || kind === "verify") {
    return palette.orange(prefix);
  }
  return palette.steel(prefix);
};

export const styleStatusLine = (label: string, ok: boolean, detail: string): string => {
  const dot = ok ? palette.phosphor("●") : palette.crimson("●");
  return `${dot} ${palette.ivory(label)} ${palette.steel(detail)}`;
};

export const selectListTheme: SelectListTheme = {
  selectedPrefix: (text) => palette.amber(text),
  selectedText: (text) => `${BOLD}${FG_AMBER}${text}${RESET}`,
  description: (text) => palette.steel(text),
  scrollInfo: (text) => palette.steel(text),
  noMatch: (text) => palette.steel(text)
};

export const settingsListTheme: SettingsListTheme = {
  label: (text, selected) => (selected ? palette.amber(text) : palette.ivory(text)),
  value: (text, selected) => (selected ? palette.orange(text) : palette.steel(text)),
  description: (text) => palette.steel(text),
  cursor: palette.amber("◉ "),
  hint: (text) => palette.steel(text)
};

export const editorTheme: EditorTheme = {
  borderColor: (text) => palette.steel(text),
  selectList: selectListTheme
};
