import type { EditorTheme, SelectListTheme, SettingsListTheme } from "@mariozechner/pi-tui";

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";

const supportsExtendedColor = (): boolean => {
  if (process.env.NO_COLOR || process.env.CLICOLOR === "0") {
    return false;
  }
  if (process.env.CLICOLOR_FORCE && process.env.CLICOLOR_FORCE !== "0") {
    return true;
  }
  const term = process.env.TERM ?? "";
  const colorTerm = process.env.COLORTERM ?? "";
  return (
    term.includes("256color") ||
    colorTerm.includes("truecolor") ||
    colorTerm.includes("24bit")
  );
};

const useExtendedColor = supportsExtendedColor();

const FG_AMBER = useExtendedColor ? "\x1b[38;5;214m" : "\x1b[33m";
const FG_ORANGE = useExtendedColor ? "\x1b[38;5;208m" : "\x1b[33m";
const FG_PHOSPHOR = useExtendedColor ? "\x1b[38;5;142m" : "\x1b[32m";
const FG_IVORY = useExtendedColor ? "\x1b[38;5;223m" : "\x1b[37m";
const FG_STEEL = useExtendedColor ? "\x1b[38;5;245m" : "\x1b[90m";
const FG_CRIMSON = useExtendedColor ? "\x1b[38;5;167m" : "\x1b[31m";
const FG_CYAN = useExtendedColor ? "\x1b[38;5;109m" : "\x1b[36m";
const FG_WARNING = useExtendedColor ? "\x1b[38;5;214m" : "\x1b[33m";

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

const BANNER_LINES = [
  " █████╗ ██████╗ ██████╗ ██╗████████╗███████╗██████╗ ",
  "██╔══██╗██╔══██╗██╔══██╗██║╚══██╔══╝██╔════╝██╔══██╗",
  "███████║██████╔╝██████╔╝██║   ██║   █████╗  ██████╔╝",
  "██╔══██║██╔══██╗██╔══██╗██║   ██║   ██╔══╝  ██╔══██╗",
  "██║  ██║██║  ██║██████╔╝██║   ██║   ███████╗██║  ██║",
  "╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝ ╚═╝   ╚═╝   ╚══════╝╚═╝  ╚═╝"
];

export const getBannerLines = (width: number): string[] =>
  width >= 60 ? BANNER_LINES : [];

export const makeDivider = (width: number): string => {
  const lineWidth = Math.max(24, Math.min(width, 78));
  return palette.steel("─".repeat(lineWidth));
};

export const styleStatusLine = (label: string, ok: boolean, detail: string): string => {
  const dot = ok ? palette.phosphor("●") : palette.crimson("●");
  return `${dot} ${palette.ivory(label)} ${palette.steel(detail)}`;
};

export const selectListTheme: SelectListTheme = {
  selectedPrefix: (text) => palette.amber(text),
  selectedText: (text) => text,
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
