import { renameSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

export const writeReceiptText = (runDir: string, text: string): string => {
  if (process.env.ARBITER_RECEIPT_FAIL === "1") {
    throw new Error("Receipt write forced to fail (ARBITER_RECEIPT_FAIL=1)");
  }
  const path = resolve(runDir, "receipt.txt");
  const tmpPath = `${path}.tmp`;
  writeFileSync(tmpPath, text, "utf8");
  renameSync(tmpPath, path);
  return path;
};
