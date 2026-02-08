import type { TranscriptCommand } from "./types.js";

export const newCommand: TranscriptCommand = {
  name: "new",
  usage: "/new",
  description: "start intake flow",
  execute: ({ context }) => {
    context.startNewFlow();
  }
};
