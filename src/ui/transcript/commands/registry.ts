import { analyzeCommand } from "./analyze.js";
import { helpCommand } from "./help.js";
import { newCommand } from "./new.js";
import { quitCommand } from "./quit.js";
import { receiptCommand } from "./receipt.js";
import { reportCommand } from "./report.js";
import { runCommand } from "./run.js";
import type { CommandContext, TranscriptCommand } from "./types.js";
import { verifyCommand } from "./verify.js";
import { formatError } from "../error-format.js";
import { warningsCommand } from "./warnings.js";

export type SlashCommandSpec = {
  name: string;
  description?: string;
};

export type ParsedCommandInput = {
  name: string;
  args: string[];
  raw: string;
};

const BUILTIN_COMMANDS: TranscriptCommand[] = [
  helpCommand,
  newCommand,
  runCommand,
  analyzeCommand,
  reportCommand,
  verifyCommand,
  receiptCommand,
  warningsCommand,
  quitCommand
];

const tokenize = (value: string): string[] => {
  const tokens: string[] = [];
  let current = "";
  let quote: '"' | "'" | null = null;
  let escaping = false;

  for (const char of value) {
    if (escaping) {
      current += char;
      escaping = false;
      continue;
    }

    if (char === "\\") {
      escaping = true;
      continue;
    }

    if (quote) {
      if (char === quote) {
        quote = null;
      } else {
        current += char;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (/\s/.test(char)) {
      if (current.length > 0) {
        tokens.push(current);
        current = "";
      }
      continue;
    }

    current += char;
  }

  if (escaping) {
    current += "\\";
  }

  if (current.length > 0) {
    tokens.push(current);
  }

  return tokens;
};

export const parseCommandInput = (value: string): ParsedCommandInput | null => {
  const trimmed = value.trim();
  if (!trimmed.startsWith("/")) {
    return null;
  }

  const raw = trimmed.slice(1).trim();
  if (!raw) {
    return null;
  }

  const tokens = tokenize(raw);
  if (tokens.length === 0) {
    return null;
  }

  const [name, ...args] = tokens;
  return {
    name: name.toLowerCase(),
    args,
    raw: trimmed
  };
};

export const listCommands = (): TranscriptCommand[] => BUILTIN_COMMANDS.slice();

export const listSlashCommands = (): SlashCommandSpec[] => {
  const slash: SlashCommandSpec[] = [];
  BUILTIN_COMMANDS.forEach((command) => {
    slash.push({ name: command.name, description: command.description });
    command.aliases?.forEach((alias) => {
      slash.push({
        name: alias,
        description: `alias for /${command.name}`
      });
    });
  });
  return slash;
};

const buildCommandMap = (): Map<string, TranscriptCommand> => {
  const map = new Map<string, TranscriptCommand>();
  BUILTIN_COMMANDS.forEach((command) => {
    map.set(command.name, command);
    command.aliases?.forEach((alias) => {
      map.set(alias, command);
    });
  });
  return map;
};

const COMMAND_MAP = buildCommandMap();

export const executeCommandInput = async (input: {
  value: string;
  context: CommandContext;
}): Promise<boolean> => {
  const parsed = parseCommandInput(input.value);
  if (!parsed) {
    return false;
  }

  const command = COMMAND_MAP.get(parsed.name);
  if (!command) {
    input.context.appendError(`unknown command: /${parsed.name}. use /help`);
    return true;
  }

  try {
    await command.execute({
      raw: parsed.raw,
      name: parsed.name,
      args: parsed.args,
      context: input.context
    });
  } catch (error) {
    input.context.appendError(`command failed: ${formatError(error)}`);
  }

  return true;
};
