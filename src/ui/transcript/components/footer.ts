import type { AppState } from "../state.js";
import { palette } from "../theme.js";

const baseHints = ["/new", "/run mock", "/run live", "/report", "/verify", "/receipt", "/help", "/quit"];

export const renderFooter = (state: AppState): string => {
  const warnings = state.warnings.length > 0 ? palette.warning(`warnings ${state.warnings.length} (w toggle)`) : palette.steel("warnings 0");
  const runMode = state.runMode ? palette.cyan(`mode ${state.runMode}`) : palette.steel("mode -");
  const hints = baseHints.join("  ");
  return [
    palette.steel("──────────────────────────────────────────────────────────────────────────────"),
    `${palette.steel(hints)}  |  ${runMode}  |  ${warnings}`,
    palette.steel("enter to submit • esc closes overlay • type w + enter for warnings • ctrl+c graceful stop/exit")
  ].join("\n");
};
