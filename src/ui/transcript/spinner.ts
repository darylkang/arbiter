import { Loader, type OverlayOptions, type TUI } from "@mariozechner/pi-tui";

import { palette } from "./theme.js";

const SPINNER_OPTIONS: OverlayOptions = {
  anchor: "center",
  width: 56,
  maxHeight: 5
};

export const withSpinner = async <T>(input: {
  tui: TUI;
  label: string;
  work: () => Promise<T>;
}): Promise<T> => {
  const loader = new Loader(
    input.tui,
    (text) => palette.amber(text),
    (text) => palette.steel(text),
    input.label
  );

  let shown = false;
  try {
    input.tui.showOverlay(loader, SPINNER_OPTIONS);
    shown = true;
    loader.start();
    return await input.work();
  } finally {
    try {
      loader.stop();
    } catch {
      // Ignore loader stop errors during teardown.
    }

    if (shown && input.tui.hasOverlay()) {
      input.tui.hideOverlay();
    }
  }
};
