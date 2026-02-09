import type { AppState } from "../state.js";
import { makeDivider, palette } from "../theme.js";

const contextHints = (state: AppState): string => {
  if (state.phase === "running") {
    return "ctrl+c requests a graceful stop";
  }
  if (state.overlay) {
    if (state.overlay.kind === "checklist") {
      return "↑/↓ move • enter select • space toggle • esc back";
    }
    return "↑/↓ move • enter select • esc back";
  }
  if (state.phase === "intake") {
    return "enter submits your question • esc cancels setup";
  }
  if (state.phase === "post-run") {
    return "choose a next action to continue";
  }
  return "follow the guided setup to begin";
};

export const renderFooter = (state: AppState, width: number): string => {
  if (state.overlay) {
    return [makeDivider(width), " "].join("\n");
  }

  const warnings =
    state.warnings.length > 0
      ? palette.warning(`warnings: ${state.warnings.length}`)
      : palette.steel("warnings: 0");
  const runMode = state.runMode ? palette.cyan(`mode ${state.runMode}`) : palette.steel("mode -");
  const hints = contextHints(state);
  return [
    makeDivider(width),
    `${palette.steel(hints)}  |  ${runMode}  |  ${warnings}`
  ].join("\n");
};
