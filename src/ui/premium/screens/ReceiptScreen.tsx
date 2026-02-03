import React from "react";
import { Box, Text, useInput } from "ink";

import { BrandBanner, FooterHelpBar, Panel, theme } from "../../ink/kit.js";

export const ReceiptScreen: React.FC<{
  receiptText: string;
  onReport: () => void;
  onVerify: () => void;
  onNew: () => void;
  onQuit: () => void;
}> = ({ receiptText, onReport, onVerify, onNew, onQuit }) => {
  useInput((input) => {
    if (input === "r") {
      onReport();
    }
    if (input === "v") {
      onVerify();
    }
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
      <Panel title="Receipt">
        <Text color={theme.fg.primary}>{receiptText}</Text>
      </Panel>
      <FooterHelpBar hints={["r report", "v verify", "n new", "q quit", "w warnings"]} />
    </Box>
  );
};
