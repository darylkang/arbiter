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

  root.addChild(header);
  root.addChild(new Spacer(1));
  root.addChild(progress);
  root.addChild(new Spacer(1));
  root.addChild(transcript);
  root.addChild(new Spacer(1));
  root.addChild(editor);
  root.addChild(new Spacer(1));
  root.addChild(footer);

  const sync = (state: AppState): void => {
    header.setText(renderHeader(state));

    if (state.runProgress.active || state.phase === "post-run") {
      progress.setText(renderProgressSummary(state.runProgress));
    } else {
      progress.setText(palette.steel("progress idle"));
    }

    transcript.setEntries(state.transcript);
    footer.setText(renderFooter(state));

    if (state.phase === "running") {
      editor.disableSubmit = true;
      if (!editor.getText()) {
        editor.setText("run in progress... ctrl+c to request graceful stop");
      }
    } else {
      if (editor.getText() === "run in progress... ctrl+c to request graceful stop") {
        editor.setText("");
      }
      editor.disableSubmit = false;
    }
  };

  return {
    root,
    editor,
    transcript,
    sync,
    focusInput: () => input.tui.setFocus(editor)
  };
};
