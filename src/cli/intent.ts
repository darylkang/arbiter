export type CliMode = {
  filteredArgs: string[];
  headless: boolean;
  forceWizard: boolean;
  noCommand: boolean;
  shouldLaunchWizard: boolean;
};

export const resolveCliMode = (args: string[], isTTY: boolean): CliMode => {
  const forceWizard = args.includes("--wizard");
  const headless = args.includes("--headless");
  const filteredArgs = args.filter((arg) => arg !== "--headless" && arg !== "--wizard");
  const noCommand = filteredArgs.length === 0;
  const shouldLaunchWizard = (noCommand && isTTY && !headless) || forceWizard;
  return { filteredArgs, headless, forceWizard, noCommand, shouldLaunchWizard };
};
