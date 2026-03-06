import { stdout as output } from "node:process";

import { createStdoutFormatter } from "../fmt.js";
import {
  renderBrandBlock,
  renderRailContent,
  renderRailStep,
  renderSeparator,
  renderStatusStrip,
  type RailStep
} from "../wizard-theme.js";
import { RAIL_ITEMS, type StepFrame } from "./types.js";

const ALT_SCREEN_ENABLE = "\x1b[?1049h";
const ALT_SCREEN_DISABLE = "\x1b[?1049l";
const CURSOR_HIDE = "\x1b[?25l";
const CURSOR_SHOW = "\x1b[?25h";

const clearScreen = (): void => {
  output.write("\x1b[H\x1b[J");
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

export const createWizardFrameManager = () => {
  let interactiveScreenEnabled = false;

  const enter = (): void => {
    if (output.isTTY && !interactiveScreenEnabled) {
      output.write(ALT_SCREEN_ENABLE);
      output.write(CURSOR_HIDE);
      interactiveScreenEnabled = true;
    }
  };

  const leave = (): void => {
    if (interactiveScreenEnabled) {
      output.write(CURSOR_SHOW);
      output.write(ALT_SCREEN_DISABLE);
      interactiveScreenEnabled = false;
    }
  };

  const exit = (message: string): void => {
    leave();
    output.write(`${message}\n`);
  };

  const render = (input: StepFrame): void => {
    const fmt = createStdoutFormatter();
    const width = fmt.termWidth();
    const parts: string[] = [];
    const railSteps = toRailSteps({
      currentRailIndex: input.currentRailIndex,
      completedUntilRailIndex: input.completedUntilRailIndex,
      showRunMode: input.showRunMode,
      stepSummaries: input.stepSummaries
    });

    clearScreen();

    parts.push(renderStatusStrip(input.contextLabel, 0, width, fmt));
    parts.push(renderSeparator(width, fmt));
    parts.push("");
    parts.push(
      renderBrandBlock(
        input.version,
        input.apiKeyPresent,
        input.runMode,
        input.configCount,
        fmt
      )
    );
    parts.push("");

    for (const step of railSteps) {
      const isActiveStep = step.state === "active";
      parts.push(renderRailStep(step, fmt, input.dimmedRail === true));
      if (isActiveStep) {
        parts.push(renderRailContent(input.activeLines, fmt));
      }
    }

    parts.push("");
    parts.push(renderSeparator(width, fmt));
    parts.push(input.footerText);
    output.write(`${parts.join("\n")}\n`);
  };

  return {
    enter,
    leave,
    exit,
    clearScreen,
    render
  };
};
