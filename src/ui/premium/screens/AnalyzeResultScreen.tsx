import React from "react";
import { Box, Text, useInput } from "ink";

import { BrandBanner, FooterHelpBar, Panel, theme } from "../../ink/kit.js";

export const AnalyzeResultScreen: React.FC<{
  reportText: string;
  onReport: () => void;
  onReceipt: () => void;
  onVerify: () => void;
  onBack: () => void;
  onQuit: () => void;
}> = ({ reportText, onReport, onReceipt, onVerify, onBack, onQuit }) => {
  useInput((input) => {
    if (input === "r") {
      onReport();
    }
    if (input === "c") {
      onReceipt();
    }
    if (input === "v") {
      onVerify();
    }
    if (input === "b") {
      onBack();
    }
    if (input === "q") {
      onQuit();
    }
  });

  return (
    <Box flexDirection="column" gap={1}>
      <BrandBanner variant="compact" />
      <Panel title="Analysis">
        <Text color={theme.fg.primary}>
          {reportText || "Select r (report), c (receipt) or v (verify)."}
        </Text>
      </Panel>
      <FooterHelpBar hints={["r report", "c receipt", "v verify", "b back", "q quit", "w warnings"]} />
    </Box>
  );
};
