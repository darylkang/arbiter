import { Editor, Key, matchesKey, type TUI } from "@mariozechner/pi-tui";
import type { EditorTheme } from "@mariozechner/pi-tui";

export class TranscriptEditor extends Editor {
  onEscape?: () => void;
  onCtrlC?: () => void;

  constructor(tui: TUI, theme: EditorTheme) {
    super(tui, theme, { paddingX: 1, autocompleteMaxVisible: 6 });
  }

  override handleInput(data: string): void {
    if (matchesKey(data, Key.escape) && this.onEscape && !this.isShowingAutocomplete()) {
      this.onEscape();
      return;
    }

    if (matchesKey(data, Key.ctrl("c")) && this.onCtrlC) {
      this.onCtrlC();
      return;
    }

    super.handleInput(data);
  }
}
