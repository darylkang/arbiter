import React from "react";
import { Box, Text, useInput } from "ink";

import { BrandBanner, FooterHelpBar, Panel, SelectList, Stepper, theme } from "../../ink/kit.js";
import type { ProfileOption } from "../types.js";

export const ProfileScreen: React.FC<{
  profileIndex: number;
  profiles: ProfileOption[];
  onSelect: (index: number) => void;
  onNext: () => void;
  onBack: () => void;
}> = ({ profileIndex, profiles, onSelect, onNext, onBack }) => {
  useInput((_, key) => {
    if (key.upArrow) {
      onSelect(Math.max(0, profileIndex - 1));
    }
    if (key.downArrow) {
      onSelect(Math.min(profiles.length - 1, profileIndex + 1));
    }
    if (key.return) {
      onNext();
    }
    if (key.escape) {
      onBack();
    }
  });

  const listItems = profiles.map((profile) => ({
    id: profile.id,
    label: profile.title,
    description: profile.description,
    note: profile.id === "free" ? "(exploratory)" : undefined
  }));

  return (
    <Box flexDirection="column" gap={1}>
      <BrandBanner variant="compact" />
      <Stepper steps={["Question", "Profile", "Review", "Run"]} activeIndex={1} />
      <Panel title="Profiles">
        <SelectList items={listItems} selectedIndex={profileIndex} />
        {profiles[profileIndex]?.warning ? (
          <Text color={theme.status.warning}>{profiles[profileIndex]?.warning}</Text>
        ) : null}
      </Panel>
      <FooterHelpBar hints={["↑/↓ select", "Enter next", "Esc back"]} />
    </Box>
  );
};
