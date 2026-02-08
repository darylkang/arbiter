import { Container, Spacer, Text, type TUI } from "@mariozechner/pi-tui";

import { renderFooter } from "./components/footer.js";
import { renderHeader } from "./components/header.js";
import { TranscriptEditor } from "./components/input.js";
import { renderProgressSummary } from "./components/progress.js";
import { TranscriptComponent } from "./components/transcript.js";
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
  const progress = new Text("", 0, 0);
  const transcript = new TranscriptComponent();
  const editor = new TranscriptEditor(input.tui, editorTheme);
  const footer = new Text("", 0, 0);

  editor.onSubmit = input.onSubmit;
  editor.onEscape = input.onEscape;
  editor.onCtrlC = input.onCtrlC;

  let showProgress = true;
  let showEditor = true;

  const rebuildTree = (): void => {
    root.clear();
    root.addChild(header);
    root.addChild(new Spacer(1));

    if (showProgress) {
      root.addChild(progress);
      root.addChild(new Spacer(1));
    }

    root.addChild(transcript);
    root.addChild(new Spacer(1));

    if (showEditor) {
      root.addChild(editor);
      root.addChild(new Spacer(1));
    }

    root.addChild(footer);
  };

  rebuildTree();

  const sync = (state: AppState): void => {
    const layoutWidth = Math.max(24, input.tui.terminal.columns);

    const nextShowProgress = state.phase === "running" || state.phase === "post-run";
    const nextShowEditor = state.phase === "idle" || state.phase === "intake";
    if (nextShowProgress !== showProgress || nextShowEditor !== showEditor) {
      showProgress = nextShowProgress;
      showEditor = nextShowEditor;
      rebuildTree();
    }

    header.setText(renderHeader(state, layoutWidth));

    if (showProgress) {
      progress.setText(renderProgressSummary(state.runProgress));
    } else {
      progress.setText("");
    }

    transcript.setEntries(state.transcript);
    footer.setText(renderFooter(state, layoutWidth));

    if (showEditor) {
      editor.disableSubmit = false;
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
      if (showEditor) {
        input.tui.setFocus(editor);
      }
    }
  };
};
