import { randomBytes } from "node:crypto";

const pad = (value: number): string => value.toString().padStart(2, "0");

const normalizeSuffix = (value: string): string => {
  const normalized = value.toLowerCase().replace(/[^a-f0-9]/g, "");
  if (normalized.length === 0) {
    return "000000";
  }
  if (normalized.length >= 6) {
    return normalized.slice(0, 6);
  }
  return normalized.padEnd(6, "0");
};

export const generateRunId = (
  now: Date = new Date(),
  options?: {
    suffix?: string;
  }
): string => {
  const timestamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;
  const suffix =
    options?.suffix !== undefined
      ? normalizeSuffix(options.suffix)
      : randomBytes(3).toString("hex");
  return `${timestamp}_${suffix}`;
};
