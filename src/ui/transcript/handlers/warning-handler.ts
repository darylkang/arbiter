import type { EventBus } from "../../../events/event-bus.js";
import type { AppState } from "../state.js";
import { appendWarning } from "../reducer.js";

export const attachWarningHandler = (input: {
  bus: EventBus;
  state: AppState;
  onUpdate: () => void;
  onError: (error: unknown) => void;
}): (() => void) =>
  input.bus.subscribeSafe(
    "warning.raised",
    (payload) => {
      appendWarning(input.state, payload);
      input.onUpdate();
    },
    input.onError
  );
