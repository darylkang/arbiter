import { renameSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

export const writeReceiptText = (runDir: string, text: string): string => {
  const path = resolve(runDir, "receipt.txt");
  const tmpPath = `${path}.tmp`;
  writeFileSync(tmpPath, text, "utf8");
  renameSync(tmpPath, path);
  return path;
};
