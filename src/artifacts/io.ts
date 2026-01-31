import { createWriteStream, writeFileSync } from "node:fs";
import { renameSync } from "node:fs";

export interface JsonlWriter {
  path: string;
  append: (record: unknown) => void;
  close: () => Promise<void>;
}

export const createJsonlWriter = (path: string): JsonlWriter => {
  const stream = createWriteStream(path, { flags: "a" });
  return {
    path,
    append: (record: unknown) => {
      stream.write(`${JSON.stringify(record)}\n`);
    },
    close: () => {
      return new Promise((resolve, reject) => {
        stream.on("error", (error) => reject(error));
        stream.end(() => resolve());
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
