import React from "react";
import { Box, useInput } from "ink";

import { BrandBanner, FooterHelpBar, Panel, SelectList } from "../../ink/kit.js";

export const AnalyzeScreen: React.FC<{
  runDirs: string[];
  selectedIndex: number;
  onSelectIndex: (index: number) => void;
  onChoose: (dir: string) => void;
  onBack: () => void;
}> = ({ runDirs, selectedIndex, onSelectIndex, onChoose, onBack }) => {
  useInput((_, key) => {
    if (key.upArrow) {
      onSelectIndex(Math.max(0, selectedIndex - 1));
    }
    if (key.downArrow) {
      onSelectIndex(Math.min(runDirs.length - 1, selectedIndex + 1));
    }
    if (key.return && runDirs[selectedIndex]) {
      onChoose(runDirs[selectedIndex]);
    }
    if (key.escape) {
      onBack();
    }
  });

  const items = runDirs.map((dir) => ({
    id: dir,
    label: dir,
    description: `runs/${dir}`
  }));

  return (
    <Box flexDirection="column" gap={1}>
      <BrandBanner variant="compact" />
      <Panel title="Select a run">
        <SelectList items={items} selectedIndex={selectedIndex} />
      </Panel>
      <FooterHelpBar hints={["↑/↓ select", "Enter view", "Esc back"]} />
    </Box>
  );
};
