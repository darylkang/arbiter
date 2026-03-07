import { stdout as output } from "node:process";

import { createStdoutFormatter, type Formatter } from "../fmt.js";
import { countRenderedRows } from "../runtime/live-region.js";
import {
  truncate,
  renderBrandBlock,
  renderRailContent,
  renderRailStep,
  renderSeparator,
  renderStatusStrip,
  type RailStep
} from "../wizard-theme.js";
import { toApiKeyPresenceLabel, toRunModeLabel } from "../copy.js";
import { RAIL_ITEMS, type StepFrame } from "./types.js";

const CURSOR_HIDE = "\x1b[?25l";
const CURSOR_SHOW = "\x1b[?25h";

const clearScreen = (): void => {
  output.write("\x1b[2J\x1b[H");
};

const toRailSteps = (input: {
  currentRailIndex: number;
  completedUntilRailIndex: number;
  showRunMode: boolean;
  stepSummaries: Partial<Record<number, string>>;
}): RailStep[] =>
  RAIL_ITEMS.filter((item) => input.showRunMode || item.railIndex !== 1).map((item) => ({
    label: item.label,
    state:
      item.railIndex === input.currentRailIndex
        ? "active"
        : item.railIndex <= input.completedUntilRailIndex
          ? "completed"
          : "pending",
    summary: input.stepSummaries[item.railIndex]
  }));

const renderCompactBrandBlock = (input: StepFrame, width: number, fmt: Formatter): string => {
  const versionText = `v${input.version}`;
  const left = `${fmt.bold(fmt.brand(input.version ? "A R B I T E R" : "Arbiter"))}`;
  const gap = Math.max(1, width - "A R B I T E R".length - versionText.length);
  const summary = truncate(
    `API ${toApiKeyPresenceLabel(input.apiKeyPresent)} · Mode ${toRunModeLabel(input.runMode)} · ${input.configCount} configs`,
    width
  );
  return [`${left}${" ".repeat(gap)}${fmt.muted(versionText)}`, fmt.muted(summary)].join("\n");
};

const renderCompactRailContent = (lines: string[], fmt: Formatter): string =>
  lines
    .map((rawLine) => (rawLine.length === 0 ? fmt.accent("│") : `${fmt.accent("│")}   ${rawLine}`))
    .join("\n");

export const createWizardFrameManager = () => {
  let interactiveScreenEnabled = false;
  let cursorHidden = false;
  let lastFrameRows = 0;

  const enter = (): void => {
    if (output.isTTY && !interactiveScreenEnabled) {
      output.write(CURSOR_HIDE);
      interactiveScreenEnabled = true;
      cursorHidden = true;
      lastFrameRows = 0;
    }
  };

  const leave = (): void => {
    if (interactiveScreenEnabled) {
      if (lastFrameRows > 0) {
        output.write(`\x1b[${lastFrameRows}A`);
      }
      output.write("\x1b[J");
      if (cursorHidden) {
        output.write(CURSOR_SHOW);
        cursorHidden = false;
      }
      interactiveScreenEnabled = false;
      lastFrameRows = 0;
    }
  };

  const exit = (message: string): void => {
    leave();
    output.write(`${message}\n`);
  };

  const printLine = (message: string): void => {
    leave();
    output.write(`${message}\n`);
  };

  const printLines = (lines: string[]): void => {
    leave();
    for (const line of lines) {
      output.write(`${line}\n`);
    }
  };

  const render = (input: StepFrame): void => {
    const fmt = createStdoutFormatter();
    const width = fmt.termWidth();
    const frameText = buildWizardFrameText(input, fmt, width, output.rows ?? 24);
    if (lastFrameRows > 0) {
      output.write(`\x1b[${lastFrameRows}A`);
      output.write("\x1b[J");
    } else {
      clearScreen();
    }
    output.write(`${frameText}\n`);
    lastFrameRows = countRenderedRows(frameText, width);
  };

  return {
    enter,
    leave,
    exit,
    printLine,
    printLines,
    clearScreen,
    render
  };
};

export const buildWizardFrameText = (
  input: StepFrame,
  fmt: Formatter,
  width = fmt.termWidth(),
  rows = 24
): string => {
  const parts: string[] = [];
  const compactHeight = rows <= 18;
  const railSteps = toRailSteps({
    currentRailIndex: input.currentRailIndex,
    completedUntilRailIndex: input.completedUntilRailIndex,
    showRunMode: input.showRunMode,
    stepSummaries: input.stepSummaries
  });

  parts.push(renderStatusStrip(input.contextLabel, 0, width, fmt));
  parts.push(renderSeparator(width, fmt));
  if (!compactHeight) {
    parts.push("");
    parts.push(
      renderBrandBlock(
        input.version,
        input.apiKeyPresent,
        input.runMode,
        input.configCount,
        width,
        fmt
      )
    );
    parts.push("");
  } else {
    parts.push(renderCompactBrandBlock(input, width, fmt));
  }

  for (const step of railSteps) {
    const isActiveStep = step.state === "active";
    parts.push(renderRailStep(step, fmt, input.dimmedRail === true));
    if (isActiveStep) {
      parts.push(
        compactHeight
          ? renderCompactRailContent(input.activeLines, fmt)
          : renderRailContent(input.activeLines, fmt)
      );
    }
  }

  if (!compactHeight) {
    parts.push("");
  }
  parts.push(renderSeparator(width, fmt));
  parts.push(input.footerText);
  return parts.join("\n");
};
