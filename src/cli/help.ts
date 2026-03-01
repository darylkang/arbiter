import type { Formatter } from "../ui/fmt.js";

export type HelpCommand = {
  name: "init" | "run";
  summary: string;
  usage: string;
  flags?: Array<{ name: string; description: string }>;
  examples?: string[];
};

const COMMANDS: HelpCommand[] = [
  {
    name: "init",
    summary: "create a default config in the current directory",
    usage: "arbiter init",
    examples: ["arbiter init", "arbiter", "arbiter run --config arbiter.config.json"]
  },
  {
    name: "run",
    summary: "execute a config headlessly",
    usage:
      "arbiter run --config <path> [--out <dir>] [--workers <n>] [--batch-size <n>] [--max-trials <n>] [--mode <mock|live>] [--dashboard]",
    flags: [
      { name: "--config <path>", description: "required config path" },
      { name: "--out <dir>", description: "run output directory (default: ./runs)" },
      { name: "--workers <n>", description: "override execution.workers" },
      { name: "--batch-size <n>", description: "override execution.batch_size" },
      { name: "--max-trials <n>", description: "override execution.k_max" },
      { name: "--mode <mock|live>", description: "runtime runner override (default: mock)" },
      { name: "--dashboard", description: "TTY-only Stage 2/3 monitor output" }
    ],
    examples: [
      "arbiter run --config arbiter.config.json",
      "arbiter run --config arbiter.config.json --mode live",
      "arbiter run --config arbiter.config.json --dashboard"
    ]
  }
];

export const getHelpCommand = (name: string): HelpCommand | undefined =>
  COMMANDS.find((command) => command.name === name);

export const renderRootHelp = (fmt: Formatter): string => {
  const lines: string[] = [];
  lines.push(fmt.header("ARBITER"));
  lines.push("");
  lines.push(fmt.text("Commands:"));
  lines.push(`  ${fmt.accent("arbiter")}            ${fmt.muted("launch wizard in TTY; print help in non-TTY")}`);
  for (const command of COMMANDS) {
    lines.push(`  ${fmt.accent(`arbiter ${command.name}`.padEnd(18))} ${fmt.muted(command.summary)}`);
  }
  lines.push("");
  lines.push(fmt.text("Global flags:"));
  lines.push(`  ${fmt.accent("--help, -h")}      ${fmt.muted("show help")}`);
  lines.push(`  ${fmt.accent("--version, -V")}   ${fmt.muted("print version")}`);
  lines.push("");
  lines.push(fmt.text("Examples:"));
  lines.push(`  ${fmt.muted("arbiter")}`);
  lines.push(`  ${fmt.muted("arbiter init")}`);
  lines.push(`  ${fmt.muted("arbiter run --config arbiter.config.json")}`);
  return `${lines.join("\n")}\n`;
};

export const renderCommandHelp = (fmt: Formatter, command: HelpCommand): string => {
  const lines: string[] = [];
  lines.push(fmt.header(`arbiter ${command.name}`));
  lines.push("");
  lines.push(fmt.text("Usage:"));
  lines.push(`  ${fmt.muted(command.usage)}`);

  if (command.flags && command.flags.length > 0) {
    lines.push("");
    lines.push(fmt.text("Flags:"));
    for (const flag of command.flags) {
      lines.push(`  ${fmt.accent(flag.name.padEnd(20))} ${fmt.muted(flag.description)}`);
    }
  }

  if (command.examples && command.examples.length > 0) {
    lines.push("");
    lines.push(fmt.text("Examples:"));
    for (const example of command.examples) {
      lines.push(`  ${fmt.muted(example)}`);
    }
  }

  return `${lines.join("\n")}\n`;
};
