import type { AppState } from "../state.js";
import { makeDivider, palette } from "../theme.js";

const contextHints = (state: AppState): string => {
  if (state.phase === "running") {
    return "ctrl+c request graceful stop";
  }
  if (state.overlay) {
    return "↑/↓ move • enter select • esc back";
  }
  if (state.phase === "intake") {
    return "type your question and press enter • esc cancel";
  }
  if (state.phase === "post-run") {
    return "choose a next action to continue";
  }
  return "guided setup available • /help for advanced commands";
};

export const renderFooter = (state: AppState, width: number): string => {
  const warnings =
    state.warnings.length > 0
      ? palette.warning(`warnings ${state.warnings.length} (/warnings)`)
      : palette.steel("warnings 0");
  const runMode = state.runMode ? palette.cyan(`mode ${state.runMode}`) : palette.steel("mode -");
  const hints = contextHints(state);
  return [
    makeDivider(width),
    `${palette.steel(hints)}  |  ${runMode}  |  ${warnings}`,
    palette.steel("use /warnings to review warning history")
  ].join("\n");
};
