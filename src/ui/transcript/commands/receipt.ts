import type { TranscriptCommand } from "./types.js";

export const receiptCommand: TranscriptCommand = {
  name: "receipt",
  usage: "/receipt [run_dir]",
  description: "render receipt text",
  execute: async ({ args, context }) => {
    await context.showReceipt(args[0]);
  }
};
