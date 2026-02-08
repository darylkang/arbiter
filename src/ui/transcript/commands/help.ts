import type { TranscriptCommand } from "./types.js";

const HELP_TEXT = [
  "commands:",
  "  /new                   start intake flow (question -> profile -> run mode)",
  "  /run [mock|live]       execute current config (defaults to mock)",
  "  /analyze [run_dir]     select or set run directory and show summary",
  "  /report [run_dir]      print report for a run",
  "  /verify [run_dir]      run integrity verification",
  "  /receipt [run_dir]     render run receipt",
  "  /warnings              show warning summary",
  "  /help                  show this help",
  "  /quit                  exit transcript ui"
].join("\n");

export const helpCommand: TranscriptCommand = {
  name: "help",
  usage: "/help",
  description: "show command help",
  aliases: ["h"],
  execute: ({ context }) => {
    context.appendSystem(HELP_TEXT);
  }
};
