import { createWriteStream, writeFileSync } from "node:fs";
import { renameSync } from "node:fs";

export interface JsonlWriter {
  path: string;
  append: (record: unknown) => void;
  close: () => void;
}

export const createJsonlWriter = (path: string): JsonlWriter => {
  const stream = createWriteStream(path, { flags: "a" });
  return {
    path,
    append: (record: unknown) => {
      stream.write(`${JSON.stringify(record)}\n`);
    },
    close: () => {
      stream.end();
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
