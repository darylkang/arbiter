import type { TranscriptCommand } from "./types.js";

export const warningsCommand: TranscriptCommand = {
  name: "warnings",
  usage: "/warnings",
  description: "show recent warnings",
  aliases: ["warn"],
  execute: async ({ context }) => {
    await context.showWarnings();
  }
};
