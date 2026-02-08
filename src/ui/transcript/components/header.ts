import type { AppState } from "../state.js";
import { getBannerLines, makeDivider, palette, styleStatusLine } from "../theme.js";

const phaseLabel = (state: AppState): string => {
  if (state.phase === "intake") {
    return "setting up";
  }
  if (state.phase === "running") {
    return "running";
  }
  if (state.phase === "post-run") {
    return "complete";
  }
  return "ready";
};

export const renderHeader = (state: AppState, width: number): string => {
  const title = palette.headline("ARBITER");
  const api = styleStatusLine(
    "api",
    state.hasApiKey,
    state.hasApiKey ? "OPENROUTER key loaded" : "missing OPENROUTER_API_KEY"
  );
  const cfg = styleStatusLine(
    "config",
    state.hasConfig,
    state.hasConfig ? "arbiter.config.json detected" : "no local config"
  );
  const runs = styleStatusLine("runs", state.runsCount > 0, `${state.runsCount} available`);
  const phase = styleStatusLine("phase", true, phaseLabel(state));

  return [
    ...getBannerLines(width).map((line) => palette.amber(line)),
    title,
    `${api}    ${cfg}`,
    `${runs}    ${phase}`,
    makeDivider(width)
  ].join("\n");
};
