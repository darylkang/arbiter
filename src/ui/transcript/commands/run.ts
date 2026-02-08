import type { RunMode } from "../state.js";
import type { TranscriptCommand } from "./types.js";

const parseMode = (arg?: string): RunMode | null => {
  if (!arg || arg.trim().length === 0) {
    return "mock";
  }
  const normalized = arg.trim().toLowerCase();
  if (normalized === "mock" || normalized === "live") {
    return normalized;
  }
  return null;
};

export const runCommand: TranscriptCommand = {
  name: "run",
  usage: "/run mock|live",
  description: "execute current config",
  execute: async ({ args, context }) => {
    const mode = parseMode(args[0]);
    if (!mode) {
      context.appendError("invalid run mode. use /run mock or /run live");
      return;
    }
    await context.startRun(mode);
  }
};
