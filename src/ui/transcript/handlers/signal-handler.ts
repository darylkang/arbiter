import type { AppState } from "../state.js";
import { appendTranscript } from "../reducer.js";

export const handleEditorCtrlC = (input: {
  state: AppState;
  requestRender: () => void;
  onExit: () => void;
  onInterruptRun: () => void;
}): void => {
  if (input.state.phase === "running") {
    appendTranscript(
      input.state,
      "warning",
      "SIGINT requested: stopping new trials and waiting for in-flight work to finish"
    );
    input.onInterruptRun();
    input.requestRender();
    return;
  }

  input.onExit();
};
