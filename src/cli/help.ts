import type { Formatter } from "../ui/fmt.js";

export type HelpFlag = {
  name: string;
  description: string;
};

export type HelpCommand = {
  name: string;
  summary: string;
  usage: string;
  flags?: HelpFlag[];
  examples?: string[];
  group: "workflow" | "inspection" | "advanced";
};

const COMMANDS: HelpCommand[] = [
  {
    name: "init",
    summary: "create config from template",
    usage: "arbiter init [question] [--out <path>] [--force] [--template <name>]",
    group: "workflow",
    flags: [
      { name: "--out <path>", description: "config output path (default: arbiter.config.json)" },
      { name: "--force", description: "overwrite existing config file" },
      {
        name: "--template <name>",
        description: "default|quickstart_independent|heterogeneity_mix|debate_v1|free_quickstart|full"
      }
    ],
    examples: [
      "arbiter init \"What are the tradeoffs of event sourcing?\"",
      "arbiter init --template debate_v1 --out experiments/debate.json"
    ]
  },
  {
    name: "run",
    summary: "execute study (mock by default)",
    usage: "arbiter run [config.json] [--live] [--yes] [flags]",
    group: "workflow",
    flags: [
      { name: "--config <path>", description: "config path (default: arbiter.config.json)" },
      { name: "--mock", description: "explicitly run in mock mode (default behavior)" },
      { name: "--live", description: "run with real model calls (default mode is mock)" },
      { name: "--yes", description: "skip live-run confirmation prompt" },
      { name: "--out <runs_dir>", description: "output directory (default: runs)" },
      { name: "--debug", description: "preserve debug artifacts" },
      { name: "--quiet", description: "suppress progress output" },
      { name: "--max-trials <N>", description: "override execution.k_max" },
      { name: "--batch-size <N>", description: "override execution.batch_size" },
      { name: "--workers <N>", description: "override execution.workers" },
      { name: "--strict", description: "enforce model policy" },
      { name: "--permissive", description: "warn-only policy mode" },
      { name: "--allow-free", description: "allow free-tier models in strict mode" },
      { name: "--allow-aliased", description: "allow aliased models in strict mode" },
      {
        name: "--contract-failure <p>",
        description: "warn|exclude|fail (default: warn)"
      }
    ],
    examples: [
      "arbiter run",
      "arbiter run --live --yes",
      "arbiter run arbiter.config.json --max-trials 50 --batch-size 5"
    ]
  },
  {
    name: "validate",
    summary: "validate config and policy",
    usage: "arbiter validate [config.json] [--live]",
    group: "workflow",
    flags: [
      { name: "--config <path>", description: "config path (default: arbiter.config.json)" },
      { name: "--live", description: "also check OpenRouter connectivity" },
      { name: "--strict", description: "enforce model policy" },
      { name: "--permissive", description: "warn-only policy mode" },
      { name: "--allow-free", description: "allow free-tier models in strict mode" },
      { name: "--allow-aliased", description: "allow aliased models in strict mode" }
    ],
    examples: ["arbiter validate", "arbiter validate --live"]
  },
  {
    name: "report",
    summary: "summarize a completed run",
    usage: "arbiter report <run_dir> [--format text|json] [--top N]",
    group: "inspection",
    flags: [
      { name: "--format <type>", description: "text|json (default: text)" },
      { name: "--top <N>", description: "top exemplars/clusters to include (default: 3)" }
    ],
    examples: ["arbiter report runs/<run_id>", "arbiter report runs/<run_id> --format json"]
  },
  {
    name: "verify",
    summary: "check run artifact integrity",
    usage: "arbiter verify <run_dir>",
    group: "inspection",
    examples: ["arbiter verify runs/<run_id>"]
  },
  {
    name: "receipt",
    summary: "print receipt for a run",
    usage: "arbiter receipt <run_dir>",
    group: "inspection",
    examples: ["arbiter receipt runs/<run_id>"]
  },
  {
    name: "resolve",
    summary: "write resolved config and plan only",
    usage: "arbiter resolve [config.json] [--out <runs_dir>]",
    group: "advanced",
    flags: [
      { name: "--config <path>", description: "config path (default: arbiter.config.json)" },
      { name: "--out <runs_dir>", description: "output directory (default: runs)" }
    ],
    examples: ["arbiter resolve", "arbiter resolve my.config.json --out runs"]
  }
];

const byGroup = (group: HelpCommand["group"]): HelpCommand[] =>
  COMMANDS.filter((command) => command.group === group);

const renderCommandLine = (fmt: Formatter, command: HelpCommand): string => {
  if (!fmt.isTTY) {
    return `  ${command.name.padEnd(10)} ${command.summary}`;
  }
  return `  ${fmt.accent(command.name.padEnd(10))} ${fmt.text(command.summary)}`;
};

export const listHelpCommands = (): HelpCommand[] => COMMANDS.slice();

export const getHelpCommand = (name: string): HelpCommand | undefined =>
  COMMANDS.find((command) => command.name === name);

export const renderRootHelp = (fmt: Formatter): string => {
  const lines: string[] = [];

  lines.push(fmt.header("ARBITER // research-grade distributional study CLI"));
  lines.push("");
  lines.push(fmt.text("Workflow:"));
  byGroup("workflow").forEach((command) => lines.push(renderCommandLine(fmt, command)));
  lines.push("");
  lines.push(fmt.text("Inspection:"));
  byGroup("inspection").forEach((command) => lines.push(renderCommandLine(fmt, command)));
  lines.push("");
  lines.push(fmt.text("Advanced:"));
  byGroup("advanced").forEach((command) => lines.push(renderCommandLine(fmt, command)));
  lines.push("");
  lines.push(fmt.text("Global flags:"));
  lines.push(`  ${fmt.accent("--help")}      ${fmt.muted("show root or command help")}`);
  lines.push(`  ${fmt.accent("--version")}   ${fmt.muted("print package version")}`);
  lines.push(`  ${fmt.accent("--headless")}  ${fmt.muted("disable interactive transcript TUI")}`);
  lines.push("");
  lines.push(fmt.text("Quick start:"));
  lines.push(`  ${fmt.muted("arbiter init \"What are the tradeoffs of event sourcing?\"")}`);
  lines.push(`  ${fmt.muted("arbiter run")}`);
  lines.push(`  ${fmt.muted("arbiter report runs/<run_id>")}`);

  return `${lines.join("\n")}\n`;
};

export const renderCommandHelp = (fmt: Formatter, command: HelpCommand): string => {
  const lines: string[] = [];
  lines.push(fmt.header(`arbiter ${command.name} — ${command.summary}`));
  lines.push("");
  lines.push(fmt.text("Usage:"));
  lines.push(`  ${fmt.muted(command.usage)}`);

  if (command.flags && command.flags.length > 0) {
    lines.push("");
    lines.push(fmt.text("Flags:"));
    command.flags.forEach((flag) => {
      if (fmt.isTTY) {
        lines.push(`  ${fmt.accent(flag.name.padEnd(24))} ${fmt.muted(flag.description)}`);
      } else {
        lines.push(`  ${flag.name.padEnd(24)} ${flag.description}`);
      }
    });
  }

  if (command.examples && command.examples.length > 0) {
    lines.push("");
    lines.push(fmt.text("Examples:"));
    command.examples.forEach((example) => {
      lines.push(`  ${fmt.muted(example)}`);
    });
  }

  return `${lines.join("\n")}\n`;
};
