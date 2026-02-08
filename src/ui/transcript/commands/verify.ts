import type { TranscriptCommand } from "./types.js";

export const verifyCommand: TranscriptCommand = {
  name: "verify",
  usage: "/verify [run_dir]",
  description: "verify run artifacts and integrity",
  execute: ({ args, context }) => {
    context.showVerify(args[0]);
  }
};
