import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

export const sha256Hex = (data: string | Buffer): string =>
  createHash("sha256").update(data).digest("hex");

export const sha256FileHex = (path: string): string => sha256Hex(readFileSync(path));
