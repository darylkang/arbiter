import type { Event, EventType } from "../../../events/types.js";
import type { EventBus } from "../../../events/event-bus.js";
import type { AppState } from "../state.js";
import { applyRunEvent } from "../reducer.js";

const RUN_EVENT_TYPES: EventType[] = [
  "run.started",
  "trial.completed",
  "parsed.output",
  "embedding.recorded",
  "batch.started",
  "batch.completed",
  "worker.status",
  "convergence.record",
  "run.completed",
  "run.failed"
];

export const attachRunEventHandler = (input: {
  bus: EventBus;
  state: AppState;
  onUpdate: () => void;
  onError: (error: unknown, eventType: EventType) => void;
}): (() => void) => {
  const unsubs = RUN_EVENT_TYPES.map((type) =>
    input.bus.subscribeSafe(
      type,
      (payload) => {
        applyRunEvent(input.state, { type, payload } as Event);
        input.onUpdate();
      },
      (error) => input.onError(error, type)
    )
  );

  return (): void => {
    unsubs.forEach((unsub) => unsub());
  };
};
