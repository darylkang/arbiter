import React, { useState } from "react";
import { Box, Text, useInput } from "ink";

import { BrandBanner, FooterHelpBar, Panel, SelectList, StatusLightsPanel, theme } from "../../ink/kit.js";
import type { WelcomeOption } from "../types.js";

export const WelcomeScreen: React.FC<{
  options: WelcomeOption[];
  hasApiKey: boolean;
  hasConfig: boolean;
  runsCount: number;
  showHelp: boolean;
  onSelect: (id: string) => void;
  onToggleHelp: () => void;
  onQuit: () => void;
}> = ({ options, hasApiKey, hasConfig, runsCount, showHelp, onSelect, onToggleHelp, onQuit }) => {
  const [selected, setSelected] = useState(0);

  useInput((input, key) => {
    if (showHelp) {
      if (key.escape || key.return || input === "?") {
        onToggleHelp();
      }
      return;
    }
    if (key.upArrow) {
      setSelected((prev) => Math.max(0, prev - 1));
    }
    if (key.downArrow) {
      setSelected((prev) => Math.min(options.length - 1, prev + 1));
    }
    if (key.return) {
      const choice = options[selected];
      if (choice && !choice.disabled) {
        onSelect(choice.id);
      }
    }
    if (input === "q") {
      onQuit();
    }
    if (input === "?") {
      onToggleHelp();
    }
  });

  return (
    <Box flexDirection="column" gap={1}>
      <BrandBanner variant="full" />
      <Panel>
        <StatusLightsPanel
          items={[
            { label: "API key", ok: hasApiKey, detail: hasApiKey ? "configured" : "missing" },
            { label: "Config", ok: hasConfig, detail: hasConfig ? "found" : "none" },
            { label: "Runs", ok: runsCount > 0, detail: `${runsCount}` }
          ]}
        />
      </Panel>
      <Panel title="Actions">
        <SelectList items={options} selectedIndex={selected} />
      </Panel>
      <FooterHelpBar hints={["↑/↓ select", "Enter choose", "? help", "q quit"]} />
      {showHelp ? (
        <Panel title="What is Arbiter?" borderStyle="double">
          <Text color={theme.fg.primary}>
            Arbiter samples LLM responses under a fixed measurement procedure to study
            distributional behavior. It is audit-first and does not score correctness.
          </Text>
        </Panel>
      ) : null}
    </Box>
  );
};
