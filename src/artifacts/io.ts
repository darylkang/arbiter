import { createWriteStream, writeFileSync } from "node:fs";
import { renameSync } from "node:fs";

export interface JsonlWriter {
  path: string;
  append: (record: unknown) => void;
  close: () => Promise<void>;
}

export const createJsonlWriter = (path: string): JsonlWriter => {
  const stream = createWriteStream(path, { flags: "a" });
  let streamError: Error | null = null;
  let closed = false;
  let waitingForDrain = false;
  const pendingChunks: string[] = [];
  let drainPromise: Promise<void> | null = null;
  let resolveDrain: (() => void) | null = null;

  stream.on("error", (error) => {
    streamError = error;
  });

  stream.on("drain", () => {
    waitingForDrain = false;
    const resolve = resolveDrain;
    resolveDrain = null;
    drainPromise = null;
    if (resolve) {
      resolve();
    }
    flushPending();
  });

  const flushPending = (): void => {
    if (streamError) {
      return;
    }

    while (!waitingForDrain && pendingChunks.length > 0) {
      const chunk = pendingChunks.shift();
      if (chunk === undefined) {
        return;
      }
      if (!stream.write(chunk)) {
        waitingForDrain = true;
        if (!drainPromise) {
          drainPromise = new Promise<void>((resolve) => {
            resolveDrain = resolve;
          });
        }
      }
    }
  };

  const waitForPendingWrites = async (): Promise<void> => {
    flushPending();
    while (waitingForDrain || pendingChunks.length > 0) {
      if (drainPromise) {
        await drainPromise;
      } else {
        flushPending();
      }
      if (streamError) {
        throw streamError;
      }
    }
  };

  return {
    path,
    append: (record: unknown) => {
      if (closed) {
        throw new Error(`JSONL writer is closed: ${path}`);
      }
      if (streamError) {
        throw streamError;
      }
      pendingChunks.push(`${JSON.stringify(record)}\n`);
      flushPending();
    },
    close: async () => {
      if (closed) {
        return;
      }
      closed = true;
      if (streamError) {
        throw streamError;
      }
      await waitForPendingWrites();
      await new Promise<void>((resolve, reject) => {
        const onError = (error: Error): void => {
          streamError = error;
          cleanup();
          reject(error);
        };
        const onFinish = (): void => {
          cleanup();
          if (streamError) {
            reject(streamError);
            return;
          }
          resolve();
        };
        const cleanup = (): void => {
          stream.off("error", onError);
          stream.off("finish", onFinish);
        };

        stream.once("error", onError);
        stream.once("finish", onFinish);
        stream.end();
      });
    }
  };
};

export const touchFile = (path: string): void => {
  writeFileSync(path, "", { flag: "a" });
};

export const writeJsonAtomic = (path: string, data: unknown): void => {
  const tmpPath = `${path}.tmp`;
  writeFileSync(tmpPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  renameSync(tmpPath, path);
};
