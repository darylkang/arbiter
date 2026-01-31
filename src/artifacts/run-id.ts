import { randomBytes } from "node:crypto";

const pad = (value: number): string => value.toString().padStart(2, "0");

export const generateRunId = (now: Date = new Date()): string => {
  const timestamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;
  const suffix = randomBytes(3).toString("hex");
  return `${timestamp}_${suffix}`;
};
