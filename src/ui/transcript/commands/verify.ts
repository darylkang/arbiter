import type { TranscriptCommand } from "./types.js";

export const verifyCommand: TranscriptCommand = {
  name: "verify",
  usage: "/verify [run_dir]",
  description: "verify run artifacts and integrity",
  execute: async ({ args, context }) => {
    await context.showVerify(args[0]);
  }
};
