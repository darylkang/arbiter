import { resolve } from "node:path";
import { emitKeypressEvents } from "node:readline";
import { stdout as output } from "node:process";

import { UI_COPY } from "../copy.js";
import type {
  Choice,
  NavigationSignal,
  PromptResult,
  RawKey,
  SelectManyResult,
  SelectOneResult,
  StepFrame
} from "./types.js";
import { SELECT_BACK, SELECT_EXIT } from "./types.js";

const clearScreen = (): void => {
  output.write("\x1b[H\x1b[J");
};

const firstEnabledIndex = (choices: Choice[], fallbackIndex: number): number => {
  if (choices.length === 0) {
    return 0;
  }
  const clamped = Math.max(0, Math.min(fallbackIndex, choices.length - 1));
  if (!choices[clamped]?.disabled) {
    return clamped;
  }
  const found = choices.findIndex((choice) => !choice.disabled);
  return found >= 0 ? found : 0;
};

const nextSelectableIndex = (choices: Choice[], currentIndex: number, delta: number): number => {
  if (choices.length === 0) {
    return 0;
  }
  for (let hops = 0; hops < choices.length; hops += 1) {
    const next = (currentIndex + delta * (hops + 1) + choices.length) % choices.length;
    if (!choices[next]?.disabled) {
      return next;
    }
  }
  return currentIndex;
};

const withRawKeyCapture = async <T>(inputControl: {
  render: (errorLine?: string) => void;
  onKey: (str: string, key: RawKey) => { done: true; value: T } | { done: false; error?: string };
}): Promise<T> => {
  const stdin = process.stdin;
  if (!stdin.isTTY) {
    throw new Error("Wizard key-driven input requires a TTY.");
  }

  return new Promise<T>((resolvePromise) => {
    emitKeypressEvents(stdin);
    const wasRaw = Boolean(stdin.isRaw);
    stdin.setRawMode(true);
    stdin.resume();

    let currentError = "";

    const render = (): void => {
      inputControl.render(currentError || undefined);
    };

    const cleanup = (): void => {
      stdin.removeListener("keypress", onKeyPress);
      stdin.setRawMode(wasRaw);
      if (!wasRaw) {
        stdin.pause();
      }
    };

    const onKeyPress = (str: string, key: RawKey): void => {
      const result = inputControl.onKey(str, key);
      if (result.done) {
        cleanup();
        resolvePromise(result.value);
        return;
      }
      currentError = result.error ?? "";
      render();
    };

    stdin.on("keypress", onKeyPress);
    render();
  });
};

export const askInlineValue = async <T>(inputControl: {
  frame: StepFrame;
  title: string;
  helperLines?: string[];
  initialValue: string;
  footerText?: string;
  emptyHint?: string;
  parse: (value: string) => { ok: true; value: T } | { ok: false; error: string };
  renderStepFrame: (frame: StepFrame) => void;
}): Promise<PromptResult<T>> => {
  let buffer = inputControl.initialValue;
  return withRawKeyCapture<PromptResult<T>>({
    render: (errorLine) => {
      const lines = [inputControl.title];
      if (inputControl.helperLines && inputControl.helperLines.length > 0) {
        lines.push(...inputControl.helperLines);
      }
      lines.push("");
      lines.push(buffer.length > 0 ? `▸ ${buffer}` : "▸ ");
      if (buffer.length === 0 && inputControl.emptyHint) {
        lines.push(inputControl.emptyHint);
      }
      if (errorLine) {
        lines.push("");
        lines.push(errorLine);
      }
      inputControl.renderStepFrame({
        ...inputControl.frame,
        activeLines: [...inputControl.frame.activeLines, ...lines],
        footerText: inputControl.footerText ?? "Enter confirm · Esc back"
      });
    },
    onKey: (str, key) => {
      if (key.ctrl && key.name === "c") {
        return { done: true, value: SELECT_EXIT };
      }
      if (key.name === "escape") {
        return { done: true, value: SELECT_BACK };
      }
      if (key.name === "return" || key.sequence === "\r" || key.sequence === "\n") {
        const parsed = inputControl.parse(buffer);
        if (!parsed.ok) {
          return { done: false, error: parsed.error };
        }
        return { done: true, value: parsed.value };
      }
      if (key.name === "backspace" || key.sequence === "\x7f") {
        if (buffer.length > 0) {
          buffer = buffer.slice(0, -1);
        }
        return { done: false };
      }
      if (str && !key.ctrl && str >= " " && str !== "\x7f") {
        buffer += str;
        return { done: false };
      }
      return { done: false };
    }
  });
};

export const askIntegerInput = async (inputControl: {
  frame: StepFrame;
  title: string;
  helperLines?: string[];
  defaultValue: number;
  min: number;
  onInvalid?: () => string;
  renderStepFrame: (frame: StepFrame) => void;
}): Promise<PromptResult<number>> =>
  askInlineValue<number>({
    frame: inputControl.frame,
    title: inputControl.title,
    helperLines: inputControl.helperLines,
    initialValue: String(inputControl.defaultValue),
    renderStepFrame: inputControl.renderStepFrame,
    parse: (raw) => {
      const value = raw.trim().length === 0 ? String(inputControl.defaultValue) : raw.trim();
      const parsed = Number(value);
      if (Number.isInteger(parsed) && parsed >= inputControl.min) {
        return { ok: true, value: parsed };
      }
      return {
        ok: false,
        error:
          inputControl.onInvalid?.() ??
          `Fix required: ${inputControl.title.toLowerCase()} must be an integer greater than or equal to ${inputControl.min}.`
      };
    }
  });

export const askFloatInput = async (inputControl: {
  frame: StepFrame;
  title: string;
  helperLines?: string[];
  defaultValue: number;
  min: number;
  max: number;
  onInvalid?: () => string;
  renderStepFrame: (frame: StepFrame) => void;
}): Promise<PromptResult<number>> =>
  askInlineValue<number>({
    frame: inputControl.frame,
    title: inputControl.title,
    helperLines: inputControl.helperLines,
    initialValue: String(inputControl.defaultValue),
    renderStepFrame: inputControl.renderStepFrame,
    parse: (raw) => {
      const value = raw.trim().length === 0 ? String(inputControl.defaultValue) : raw.trim();
      const parsed = Number(value);
      if (Number.isFinite(parsed) && parsed >= inputControl.min && parsed <= inputControl.max) {
        return { ok: true, value: parsed };
      }
      return {
        ok: false,
        error:
          inputControl.onInvalid?.() ??
          `Fix required: ${inputControl.title.toLowerCase()} must be within [${inputControl.min}, ${inputControl.max}].`
      };
    }
  });

export const askTextInput = async (inputControl: {
  frame: StepFrame;
  title: string;
  helperLines?: string[];
  defaultValue: string;
  onInvalid?: (value: string) => string | undefined;
  renderStepFrame: (frame: StepFrame) => void;
}): Promise<PromptResult<string>> =>
  askInlineValue<string>({
    frame: inputControl.frame,
    title: inputControl.title,
    helperLines: inputControl.helperLines,
    initialValue: inputControl.defaultValue,
    emptyHint: "(empty uses the current value)",
    renderStepFrame: inputControl.renderStepFrame,
    parse: (raw) => {
      const value = raw.trim().length === 0 ? inputControl.defaultValue : raw.trim();
      const error = inputControl.onInvalid?.(value);
      if (error) {
        return { ok: false, error };
      }
      return { ok: true, value };
    }
  });

export const selectOne = async (inputControl: {
  prompt: string;
  choices: Choice[];
  defaultIndex?: number;
  frame?: StepFrame;
  renderStepFrame: (frame: StepFrame) => void;
}): Promise<SelectOneResult> => {
  let selectedIndex = firstEnabledIndex(inputControl.choices, inputControl.defaultIndex ?? 0);
  return withRawKeyCapture<SelectOneResult>({
    render: (errorLine) => {
      const includePrompt =
        !inputControl.frame ||
        inputControl.prompt.trim().toLowerCase() !== inputControl.frame.activeLabel.trim().toLowerCase();
      const lines: string[] = includePrompt ? [inputControl.prompt, ""] : [""];
      inputControl.choices.forEach((choice, index) => {
        const marker = index === selectedIndex ? "▸ " : "  ";
        const selectedGlyph = index === selectedIndex ? "●" : "○";
        lines.push(`${marker}${selectedGlyph} ${choice.label}`);
      });
      const disabledReasons = inputControl.choices
        .filter((choice) => choice.disabled && typeof choice.disabledReason === "string")
        .map((choice) => choice.disabledReason as string);
      if (disabledReasons.length > 0) {
        lines.push("");
        lines.push(...disabledReasons);
      }
      if (errorLine) {
        lines.push("");
        lines.push(errorLine);
      }
      if (inputControl.frame) {
        inputControl.renderStepFrame({
          ...inputControl.frame,
          activeLines: [...inputControl.frame.activeLines, ...lines],
          footerText: "↑/↓ move · Enter select · Esc back"
        });
      } else {
        clearScreen();
        output.write(`${lines.join("\n")}\n`);
      }
    },
    onKey: (_str, key) => {
      if (key.ctrl && key.name === "c") {
        return { done: true, value: SELECT_EXIT };
      }
      if (key.name === "up") {
        selectedIndex = nextSelectableIndex(inputControl.choices, selectedIndex, -1);
        return { done: false };
      }
      if (key.name === "down") {
        selectedIndex = nextSelectableIndex(inputControl.choices, selectedIndex, 1);
        return { done: false };
      }
      if (key.name === "escape") {
        return { done: true, value: SELECT_BACK };
      }
      if (key.name === "return" || key.sequence === "\r") {
        const choice = inputControl.choices[selectedIndex];
        if (!choice || choice.disabled) {
          return {
            done: false,
            error: choice?.disabledReason ?? UI_COPY.disabledOption
          };
        }
        return { done: true, value: choice.id };
      }
      return { done: false };
    }
  });
};

export const selectMany = async (inputControl: {
  prompt: string;
  choices: Choice[];
  defaults: string[];
  emptySelectionError?: string;
  frame?: StepFrame;
  extraLines?: (selected: ReadonlySet<string>) => string[];
  renderStepFrame: (frame: StepFrame) => void;
}): Promise<SelectManyResult> => {
  const selectedIds = new Set(inputControl.defaults);
  let selectedIndex = firstEnabledIndex(inputControl.choices, 0);
  return withRawKeyCapture<SelectManyResult>({
    render: (errorLine) => {
      const includePrompt =
        !inputControl.frame ||
        inputControl.prompt.trim().toLowerCase() !== inputControl.frame.activeLabel.trim().toLowerCase();
      const lines: string[] = includePrompt ? [inputControl.prompt, ""] : [""];
      inputControl.choices.forEach((choice, index) => {
        const cursor = index === selectedIndex ? "▸ " : "  ";
        const checked = selectedIds.has(choice.id) ? "■" : "□";
        lines.push(`${cursor}${checked} ${choice.label}`);
      });
      if (inputControl.extraLines) {
        const extras = inputControl.extraLines(selectedIds);
        if (extras.length > 0) {
          lines.push("");
          lines.push(...extras);
        }
      }
      if (errorLine) {
        lines.push("");
        lines.push(errorLine);
      }
      if (inputControl.frame) {
        inputControl.renderStepFrame({
          ...inputControl.frame,
          activeLines: [...inputControl.frame.activeLines, ...lines],
          footerText: "↑/↓ move · Space toggle · Enter confirm · Esc back"
        });
      } else {
        clearScreen();
        output.write(`${lines.join("\n")}\n`);
      }
    },
    onKey: (_str, key) => {
      if (key.ctrl && key.name === "c") {
        return { done: true, value: SELECT_EXIT };
      }
      if (key.name === "up") {
        selectedIndex = nextSelectableIndex(inputControl.choices, selectedIndex, -1);
        return { done: false };
      }
      if (key.name === "down") {
        selectedIndex = nextSelectableIndex(inputControl.choices, selectedIndex, 1);
        return { done: false };
      }
      if (key.name === "escape") {
        return { done: true, value: SELECT_BACK };
      }
      if (key.name === "space") {
        const choice = inputControl.choices[selectedIndex];
        if (choice && !choice.disabled) {
          if (selectedIds.has(choice.id)) {
            selectedIds.delete(choice.id);
          } else {
            selectedIds.add(choice.id);
          }
        }
        return { done: false };
      }
      if (key.name === "return" || key.sequence === "\r") {
        if (selectedIds.size === 0) {
          return { done: false, error: inputControl.emptySelectionError ?? "Fix required: select at least one option." };
        }
        return { done: true, value: Array.from(selectedIds) };
      }
      return { done: false };
    }
  });
};

export const askMultilineQuestion = async (inputControl: {
  initial: string;
  frame: StepFrame;
  renderStepFrame: (frame: StepFrame) => void;
}): Promise<string | NavigationSignal> => {
  let buffer = inputControl.initial;
  return withRawKeyCapture<string | NavigationSignal>({
    render: (errorLine) => {
      const lines = [
        "Question",
        "Type your question and press Enter to continue.",
        "",
        buffer.length === 0 ? "(start typing)" : buffer,
        "",
        `Characters: ${buffer.length}`
      ];
      if (errorLine) {
        lines.push("");
        lines.push(errorLine);
      }
      inputControl.renderStepFrame({
        ...inputControl.frame,
        activeLines: [...inputControl.frame.activeLines, ...lines],
        footerText: "Enter continue · Esc back"
      });
    },
    onKey: (str, key) => {
      if (key.ctrl && key.name === "c") {
        return { done: true, value: SELECT_EXIT };
      }
      if (key.name === "escape") {
        return { done: true, value: SELECT_BACK };
      }

      const submitRequested =
        key.name === "return" ||
        key.sequence === "\r" ||
        key.sequence === "\n";

      if (submitRequested) {
        const question = buffer.trim();
        if (question.length === 0) {
          return { done: false, error: "Fix required: enter a research question to continue." };
        }
        return { done: true, value: question };
      }

      if (key.name === "backspace" || key.sequence === "\x7f") {
        if (buffer.length > 0) {
          buffer = buffer.slice(0, -1);
        }
        return { done: false };
      }

      if (str && !key.ctrl && str >= " " && str !== "\x7f") {
        buffer += str;
        return { done: false };
      }

      return { done: false };
    }
  });
};

export const chooseConfigFile = async (inputControl: {
  configs: string[];
  frame: StepFrame;
  renderStepFrame: (frame: StepFrame) => void;
}): Promise<string | null> => {
  if (inputControl.configs.length === 1) {
    return resolve(process.cwd(), inputControl.configs[0]);
  }

  const selected = await selectOne({
    prompt: "Select a config file",
    choices: inputControl.configs.map((name) => ({ id: name, label: name })),
    defaultIndex: 0,
    frame: inputControl.frame,
    renderStepFrame: inputControl.renderStepFrame
  });
  if (selected === SELECT_EXIT || selected === SELECT_BACK) {
    return null;
  }
  return resolve(process.cwd(), selected);
};
