import React from "react";
import { Box, Text, useInput } from "ink";

import { BrandBanner, FooterHelpBar, Panel, Stepper, theme } from "../../ink/kit.js";

export const DetailsScreen: React.FC<{
  summary: string[];
  onNext: () => void;
  onSave: () => void;
  onBack: () => void;
}> = ({ summary, onNext, onSave, onBack }) => {
  useInput((input, key) => {
    if (key.return) {
      onNext();
    }
    if (input === "s") {
      onSave();
    }
    if (key.escape) {
      onBack();
    }
  });

  return (
    <Box flexDirection="column" gap={1}>
      <BrandBanner variant="compact" />
      <Stepper steps={["Question", "Profile", "Review", "Run"]} activeIndex={2} />
      <Panel title="Profile details">
        {summary.map((line) => (
          <Text key={line} color={theme.fg.secondary}>
            {line}
          </Text>
        ))}
      </Panel>
      <FooterHelpBar hints={["Enter use as-is", "s save only", "Esc back"]} />
    </Box>
  );
};
