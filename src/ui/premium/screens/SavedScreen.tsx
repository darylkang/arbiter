import React from "react";
import { Box, Text, useInput } from "ink";

import { BrandBanner, FooterHelpBar, Panel, theme } from "../../ink/kit.js";

export const SavedScreen: React.FC<{
  configPath: string;
  onNew: () => void;
  onQuit: () => void;
}> = ({ configPath, onNew, onQuit }) => {
  useInput((input) => {
    if (input === "n") {
      onNew();
    }
    if (input === "q") {
      onQuit();
    }
  });

  return (
    <Box flexDirection="column" gap={1}>
      <BrandBanner variant="compact" />
      <Panel title="Config saved">
        <Text color={theme.fg.secondary}>Saved: {configPath}</Text>
        <Text color={theme.fg.tertiary}>Run later with: arbiter run</Text>
      </Panel>
      <FooterHelpBar hints={["n new", "q quit", "w warnings"]} />
    </Box>
  );
};
