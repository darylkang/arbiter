import type { EventBus } from "../events/event-bus.js";

export type WarningRecord = {
  message: string;
  source?: string;
  recorded_at: string;
};

export type WarningSink = {
  warn: (message: string, source?: string) => void;
};

export const createConsoleWarningSink = (): WarningSink => ({
  warn: (message: string, source?: string) => {
    if (source) {
      console.warn(`[${source}] ${message}`);
    } else {
      console.warn(message);
    }
  }
});

export const createEventWarningSink = (bus: EventBus): WarningSink => ({
  warn: (message: string, source?: string) => {
    bus.emit({
      type: "warning.raised",
      payload: {
        message,
        source,
        recorded_at: new Date().toISOString()
      }
    });
  }
});
