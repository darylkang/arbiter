export type CliMode = {
  filteredArgs: string[];
  headless: boolean;
  noCommand: boolean;
  shouldLaunchTUI: boolean;
};

export const resolveCliMode = (args: string[], isTTY: boolean): CliMode => {
  const headless = args.includes("--headless");
  const filteredArgs = args.filter((arg) => arg !== "--headless");
  const noCommand = filteredArgs.length === 0;
  const shouldLaunchTUI = noCommand && isTTY && !headless;
  return { filteredArgs, headless, noCommand, shouldLaunchTUI };
};
