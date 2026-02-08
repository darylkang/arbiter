import type { AppState } from "../state.js";
import { palette } from "../theme.js";

const baseHints = [
  "/new",
  "/run mock",
  "/run live",
  "/report",
  "/verify",
  "/receipt",
  "/warnings",
  "/help",
  "/quit"
];

const makeDivider = (width: number): string => {
  const lineWidth = Math.max(24, Math.min(width, 78));
  return palette.steel("─".repeat(lineWidth));
};

export const renderFooter = (state: AppState, width: number): string => {
  const warnings = state.warnings.length > 0 ? palette.warning(`warnings ${state.warnings.length} (/warnings)`) : palette.steel("warnings 0");
  const runMode = state.runMode ? palette.cyan(`mode ${state.runMode}`) : palette.steel("mode -");
  const hints = baseHints.join("  ");
  return [
    makeDivider(width),
    `${palette.steel(hints)}  |  ${runMode}  |  ${warnings}`,
    palette.steel("enter to submit • esc closes overlay • /warnings shows warning history • ctrl+c graceful stop/exit")
  ].join("\n");
};
