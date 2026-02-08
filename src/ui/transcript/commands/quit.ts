import type { TranscriptCommand } from "./types.js";

export const quitCommand: TranscriptCommand = {
  name: "quit",
  usage: "/quit",
  description: "exit transcript ui",
  aliases: ["q", "exit"],
  execute: ({ context }) => {
    if (context.state.phase === "running") {
      context.appendSystem("run in progress. press ctrl+c to request graceful stop before quitting");
      return;
    }
    context.exit();
  }
};
