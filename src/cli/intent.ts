export type CliMode = {
  filteredArgs: string[];
  noCommand: boolean;
  shouldLaunchWizard: boolean;
};

export const resolveCliMode = (args: string[], isTTY: boolean): CliMode => {
  const filteredArgs = args.slice();
  const noCommand = filteredArgs.length === 0;
  const shouldLaunchWizard = noCommand && isTTY;
  return { filteredArgs, noCommand, shouldLaunchWizard };
};
