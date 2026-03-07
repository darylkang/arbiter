import { stdout as output } from "node:process";

import { createStdoutFormatter, type Formatter } from "../fmt.js";
import { countRenderedRows } from "../runtime/live-region.js";
import {
  renderBrandBlock,
  renderRailContent,
  renderRailStep,
  renderSeparator,
  renderStageHeader,
  type RailStep
} from "../wizard-theme.js";
import { UI_COPY } from "../copy.js";
import { RAIL_ITEMS, type StepFrame } from "./types.js";

const CURSOR_HIDE = "\x1b[?25l";
const CURSOR_SHOW = "\x1b[?25h";

const clearScreen = (): void => {
  output.write("\x1b[2J\x1b[H");
};

const rewindToFrameStart = (rows: number): void => {
  if (rows <= 0) {
    return;
  }
  output.write("\r");
  const moveUp = Math.max(0, rows - 1);
  if (moveUp > 0) {
    output.write(`\x1b[${moveUp}A`);
  }
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
        rewindToFrameStart(lastFrameRows);
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
      rewindToFrameStart(lastFrameRows);
      output.write("\x1b[J");
    } else {
      clearScreen();
    }
    output.write(frameText);
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
  const headerVariant = compactHeight
    ? "minimal"
    : input.currentRailIndex <= 1
      ? "expanded"
      : "compact";

  parts.push(
    renderBrandBlock(
      input.version,
      input.apiKeyPresent,
      input.runMode,
      input.configCount,
      width,
      fmt,
      headerVariant
    )
  );
  parts.push("");
  parts.push(renderStageHeader(UI_COPY.setupHeader, 0, width, fmt));
  if (!compactHeight) {
    parts.push("");
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

  parts.push("");
  parts.push(renderSeparator(width, fmt));
  parts.push(fmt.muted(input.footerText));
  return parts.join("\n");
};
