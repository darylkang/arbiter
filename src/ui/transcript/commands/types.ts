import type { RunMode } from "../state.js";
import type { AppState } from "../state.js";

export type CommandContext = {
  state: AppState;
  appendSystem: (message: string) => void;
  appendError: (message: string) => void;
  appendStatus: (message: string) => void;
  requestRender: () => void;
  exit: () => void;
  startRun: (mode: RunMode) => Promise<void>;
  startNewFlow: () => void;
  showWarnings: () => Promise<void>;
  showReport: (runDirArg?: string) => Promise<void>;
  showVerify: (runDirArg?: string) => Promise<void>;
  showReceipt: (runDirArg?: string) => Promise<void>;
  analyzeRun: (runDirArg?: string) => Promise<void>;
};

export type CommandInvocation = {
  raw: string;
  name: string;
  args: string[];
  context: CommandContext;
};

export type TranscriptCommand = {
  name: string;
  aliases?: string[];
  usage: string;
  description: string;
  execute: (input: CommandInvocation) => Promise<void> | void;
};
