import type { TranscriptCommand } from "./types.js";

export const reportCommand: TranscriptCommand = {
  name: "report",
  usage: "/report [run_dir]",
  description: "render top-level run report",
  execute: ({ args, context }) => {
    context.showReport(args[0]);
  }
};
