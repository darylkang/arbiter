import type { TranscriptCommand } from "./types.js";

export const quitCommand: TranscriptCommand = {
  name: "quit",
  usage: "/quit",
  description: "exit transcript UI",
  aliases: ["q", "exit"],
  execute: ({ context }) => {
    if (context.state.phase === "running") {
      context.appendSystem(
        "Run in progress. Press Ctrl+C to request graceful stop before quitting."
      );
      return;
    }
    context.exit();
  }
};
