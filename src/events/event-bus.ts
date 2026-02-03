import type { Event, EventType } from "./types.js";

type EventPayloadMap = {
  [K in EventType]: Extract<Event, { type: K }>["payload"];
};
type EventHandler<T extends EventType> = (payload: EventPayloadMap[T]) => void;
type AnyHandler = (payload: unknown) => void;
type ErrorHandler = (error: unknown) => void;

export class EventBus {
  private handlers = new Map<EventType, AnyHandler[]>();

  subscribe<T extends EventType>(type: T, handler: EventHandler<T>): () => void {
    const wrapped: AnyHandler = (payload): void => {
      handler(payload as EventPayloadMap[T]);
    };

    const existing = this.handlers.get(type);
    if (existing) {
      existing.push(wrapped);
    } else {
      this.handlers.set(type, [wrapped]);
    }

    return (): void => {
      const handlers = this.handlers.get(type);
      if (!handlers) {
        return;
      }
      const index = handlers.indexOf(wrapped);
      if (index >= 0) {
        handlers.splice(index, 1);
      }
      if (handlers.length === 0) {
        this.handlers.delete(type);
      }
    };
  }

  subscribeSafe<T extends EventType>(
    type: T,
    handler: EventHandler<T>,
    onError?: ErrorHandler
  ): () => void {
    const wrapped: AnyHandler = (payload): void => {
      try {
        handler(payload as EventPayloadMap[T]);
      } catch (error) {
        if (onError) {
          onError(error);
        }
      }
    };

    const existing = this.handlers.get(type);
    if (existing) {
      existing.push(wrapped);
    } else {
      this.handlers.set(type, [wrapped]);
    }

    return (): void => {
      const handlers = this.handlers.get(type);
      if (!handlers) {
        return;
      }
      const index = handlers.indexOf(wrapped);
      if (index >= 0) {
        handlers.splice(index, 1);
      }
      if (handlers.length === 0) {
        this.handlers.delete(type);
      }
    };
  }

  emit(event: Event): void {
    const handlers = this.handlers.get(event.type);
    if (!handlers || handlers.length === 0) {
      return;
    }
    handlers.forEach((handler) => handler(event.payload));
  }
}
