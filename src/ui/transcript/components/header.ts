import type { AppState } from "../state.js";
import { getBannerLines, makeDivider, palette, styleStatusLine } from "../theme.js";

const phaseLabel = (state: AppState): string => {
  if (state.phase === "intake") {
    if (!state.newFlow) {
      return "setting up";
    }
    return `setting up (${state.newFlow.stage})`;
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
  const subtitle = palette.steel(
    state.phase === "idle" || state.phase === "intake"
      ? "Welcome to Arbiter. Research-grade experiment harness for response distributions."
      : "Research-grade experiment harness for response distributions."
  );
  const version = palette.steel(`v${state.version}`);

  const api = styleStatusLine(
    "api",
    state.hasApiKey,
    state.hasApiKey ? "OPENROUTER key detected" : "OPENROUTER key missing"
  );
  const cfg = styleStatusLine(
    "config",
    state.hasConfig,
    state.hasConfig
      ? `configuration detected${state.configCount > 1 ? ` (${state.configCount})` : ""}`
      : "configuration not found"
  );
  const phase = styleStatusLine("phase", true, phaseLabel(state));

  const bannerLines = getBannerLines(width).map((line) => palette.amber(line));
  const compact = state.phase === "intake";

  const lines = [
    ...bannerLines,
    `${title}  ${version}`,
    compact ? `${phase}` : `${api}    ${cfg}    ${phase}`,
    compact ? subtitle : subtitle,
    makeDivider(width)
  ];

  return lines.join("\n");
};
