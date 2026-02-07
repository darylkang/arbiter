import type { Event, EventType } from "./types.js";

type EventPayloadMap = {
  [K in EventType]: Extract<Event, { type: K }>["payload"];
};
type EventHandler<T extends EventType> = (payload: EventPayloadMap[T]) => void | Promise<void>;
type AnyHandler = (payload: unknown) => void | Promise<void>;
type ErrorHandler = (error: unknown) => void;

export class EventBus {
  private handlers = new Map<EventType, AnyHandler[]>();
  private pending = new Set<Promise<void>>();
  private asyncErrors: unknown[] = [];

  private trackPending(result: Promise<void>, onError?: ErrorHandler): void {
    const wrapped = result
      .catch((error) => {
        if (onError) {
          onError(error);
          return;
        }
        this.asyncErrors.push(error);
      })
      .finally(() => {
        this.pending.delete(wrapped);
      });
    this.pending.add(wrapped);
  }

  subscribe<T extends EventType>(type: T, handler: EventHandler<T>): () => void {
    const wrapped: AnyHandler = (payload): void => {
      const result = handler(payload as EventPayloadMap[T]);
      if (result && typeof result === "object" && "then" in result) {
        this.trackPending(result);
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

  subscribeSafe<T extends EventType>(
    type: T,
    handler: EventHandler<T>,
    onError?: ErrorHandler
  ): () => void {
    const wrapped: AnyHandler = (payload): void => {
      try {
        const result = handler(payload as EventPayloadMap[T]);
        if (result && typeof result === "object" && "then" in result) {
          this.trackPending(result, onError);
        }
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
    const snapshot = handlers.slice();
    snapshot.forEach((handler) => handler(event.payload));
  }

  async flush(): Promise<void> {
    while (this.pending.size > 0) {
      await Promise.allSettled(Array.from(this.pending));
    }
    if (this.asyncErrors.length > 0) {
      const errors = this.asyncErrors.splice(0);
      throw new AggregateError(errors, "EventBus async handlers failed");
    }
  }
}
