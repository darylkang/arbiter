import type { TranscriptCommand } from "./types.js";

export const analyzeCommand: TranscriptCommand = {
  name: "analyze",
  usage: "/analyze [run_dir]",
  description: "select a run and show verification + report",
  execute: async ({ args, context }) => {
    await context.analyzeRun(args[0]);
  }
};
