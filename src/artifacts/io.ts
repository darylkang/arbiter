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

  stream.on("error", (error) => {
    streamError = error;
  });

  return {
    path,
    append: (record: unknown) => {
      if (closed) {
        throw new Error(`JSONL writer is closed: ${path}`);
      }
      if (streamError) {
        throw streamError;
      }
      stream.write(`${JSON.stringify(record)}\n`);
    },
    close: () => {
      if (closed) {
        return Promise.resolve();
      }
      closed = true;
      if (streamError) {
        return Promise.reject(streamError);
      }
      return new Promise((resolve, reject) => {
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
