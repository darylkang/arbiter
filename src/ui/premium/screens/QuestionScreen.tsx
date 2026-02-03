import React from "react";
import { Box, Text, useInput } from "ink";

import { BrandBanner, FooterHelpBar, Panel, Stepper, TextAreaDisplay, theme } from "../../ink/kit.js";

const TextAreaInput: React.FC<{
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
}> = ({ value, onChange, onSubmit }) => {
  useInput((input, key) => {
    if (key.ctrl && key.return) {
      onSubmit();
      return;
    }
    if (key.ctrl && input === "s") {
      onSubmit();
      return;
    }
    if (key.backspace || key.delete) {
      onChange(value.slice(0, -1));
      return;
    }
    if (key.return) {
      onChange(`${value}\n`);
      return;
    }
    if (input) {
      onChange(value + input);
    }
  });

  return (
    <Panel title="Question">
      <TextAreaDisplay value={value} />
      <Text color={theme.fg.tertiary}>Tip: Ctrl+Enter or Ctrl+S to continue</Text>
    </Panel>
  );
};

export const QuestionScreen: React.FC<{
  question: string;
  onChange: (value: string) => void;
  onNext: () => void;
  onBack: () => void;
}> = ({ question, onChange, onNext, onBack }) => {
  useInput((_, key) => {
    if (key.escape) {
      onBack();
    }
  });

  return (
    <Box flexDirection="column" gap={1}>
      <BrandBanner variant="compact" />
      <Stepper steps={["Question", "Profile", "Review", "Run"]} activeIndex={0} />
      <TextAreaInput value={question} onChange={onChange} onSubmit={onNext} />
      <FooterHelpBar hints={["Ctrl+Enter next", "Esc back"]} />
    </Box>
  );
};
