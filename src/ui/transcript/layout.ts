import { Container, Spacer, Text, type Component, type TUI } from "@mariozechner/pi-tui";

import { renderFooter } from "./components/footer.js";
import { renderHeader } from "./components/header.js";
import { TranscriptEditor } from "./components/input.js";
import { TranscriptComponent } from "./components/transcript.js";
import { createOverlayComponent } from "./components/overlay.js";
import type { AppState } from "./state.js";
import { editorTheme, palette } from "./theme.js";

export type TranscriptLayout = {
  root: Container;
  editor: TranscriptEditor;
  transcript: TranscriptComponent;
  sync: (state: AppState) => void;
  focusInput: () => void;
};

export const createTranscriptLayout = (input: {
  tui: TUI;
  onSubmit: (value: string) => void;
  onEscape: () => void;
  onCtrlC: () => void;
}): TranscriptLayout => {
  const root = new Container();
  const header = new Text("", 0, 0);
  const transcript = new TranscriptComponent();
  const promptHost = new Container();
  const editor = new TranscriptEditor(input.tui, editorTheme);
  const footer = new Text("", 0, 0);

  editor.onSubmit = input.onSubmit;
  editor.onEscape = input.onEscape;
  editor.onCtrlC = input.onCtrlC;

  let showEditor = true;
  let showPrompt = false;
  let promptFocusTarget: Component | null = null;

  const shouldShowEditor = (state: AppState): boolean => {
    if (state.phase === "running") {
      return true;
    }
    if (state.phase !== "intake") {
      return false;
    }
    if (!state.newFlow || state.overlay) {
      return false;
    }
    return (
      state.newFlow.stage === "question" ||
      (state.newFlow.stage === "labels" && state.newFlow.labelMode === "custom")
    );
  };

  const shouldShowPrompt = (state: AppState): boolean => state.overlay !== null;

  const rebuildTree = (): void => {
    root.clear();
    root.addChild(header);
    root.addChild(new Spacer(1));

    root.addChild(transcript);
    root.addChild(new Spacer(1));

    if (showPrompt) {
      root.addChild(promptHost);
      root.addChild(new Spacer(1));
    }

    if (showEditor) {
      root.addChild(editor);
      root.addChild(new Spacer(1));
    }

    root.addChild(footer);
  };

  rebuildTree();

  const sync = (state: AppState): void => {
    const layoutWidth = Math.max(24, input.tui.terminal.columns);

    const nextShowEditor = shouldShowEditor(state);
    const nextShowPrompt = shouldShowPrompt(state);
    if (nextShowEditor !== showEditor || nextShowPrompt !== showPrompt) {
      showEditor = nextShowEditor;
      showPrompt = nextShowPrompt;
      rebuildTree();
    }

    if (showPrompt && state.overlay) {
      const overlayComponent = createOverlayComponent(
        state.overlay,
        () => {
          input.tui.requestRender();
        },
        { width: layoutWidth }
      );
      promptHost.clear();
      promptHost.addChild(overlayComponent.component);
      promptFocusTarget = overlayComponent.focusTarget;
    } else {
      promptHost.clear();
      promptFocusTarget = null;
    }

    header.setText(renderHeader(state, layoutWidth));
    transcript.setState(state);
    footer.setText(renderFooter(state, layoutWidth));

    if (showEditor) {
      if (state.phase === "running") {
        editor.setText("Run in progress. Ctrl+C to request graceful stop.");
        editor.disableSubmit = true;
      } else {
        editor.disableSubmit = false;
      }
    } else {
      editor.setText("");
      editor.disableSubmit = true;
    }

    if (!state.hasApiKey && state.phase === "idle" && !state.overlay && !state.newFlow) {
      footer.setText(`${renderFooter(state, layoutWidth)}\n${palette.warning("live mode is unavailable without OPENROUTER_API_KEY")}`);
    }
  };

  return {
    root,
    editor,
    transcript,
    sync,
    focusInput: () => {
      if (showPrompt && promptFocusTarget) {
        input.tui.setFocus(promptFocusTarget);
        return;
      }
      if (showEditor) {
        input.tui.setFocus(editor);
      }
    }
  };
};
