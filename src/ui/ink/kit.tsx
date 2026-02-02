import React from "react";
import { Box, Text, useStdout, type TextProps } from "ink";

export const theme = {
  bg: {
    base: "#1d2021",
    surface: "#282828",
    elevated: "#32302f"
  },
  fg: {
    primary: "#ebdbb2",
    secondary: "#d5c4a1",
    tertiary: "#bdae93"
  },
  accent: {
    primary: "#fe8019",
    glow: "#fabd2f",
    neon: "#d3869b"
  },
  status: {
    success: "#b8bb26",
    warning: "#fabd2f",
    error: "#fb4934",
    info: "#83a598"
  }
};

type BannerVariant = "full" | "compact" | "minimal";

export const BrandBanner: React.FC<{ variant?: BannerVariant }> = ({ variant = "compact" }) => {
  if (variant === "minimal") {
    return (
      <Text color={theme.accent.primary} bold>
        ARBITER
      </Text>
    );
  }
  if (variant === "full") {
    return (
      <Box flexDirection="column">
        <Text color={theme.accent.primary} bold>
          █████╗ ██████╗ ██████╗ ██╗████████╗███████╗██████╗
        </Text>
        <Text color={theme.accent.primary} bold>
          ██╔══██╗██╔══██╗██╔══██╗██║╚══██╔══╝██╔════╝██╔══██╗
        </Text>
        <Text color={theme.accent.primary} bold>
          ███████║██████╔╝██████╔╝██║   ██║   █████╗  ██████╔╝
        </Text>
        <Text color={theme.accent.primary} bold>
          ██╔══██║██╔══██╗██╔══██╗██║   ██║   ██╔══╝  ██╔══██╗
        </Text>
        <Text color={theme.accent.primary} bold>
          ██║  ██║██║  ██║██████╔╝██║   ██║   ███████╗██║  ██║
        </Text>
        <Text color={theme.accent.primary} bold>
          ╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝ ╚═╝   ╚═╝   ╚══════╝╚═╝  ╚═╝
        </Text>
      </Box>
    );
  }
  return (
    <Text color={theme.accent.primary} bold>
      ARBITER • research-grade CLI
    </Text>
  );
};

export const StatusLightsPanel: React.FC<{
  items: Array<{ label: string; ok: boolean; detail?: string }>;
}> = ({ items }) => (
  <Box flexDirection="column">
    {items.map((item) => (
      <Text key={item.label}>
        <Text color={item.ok ? theme.status.success : theme.status.warning}>●</Text>{" "}
        <Text color={theme.fg.secondary}>
          {item.label}
          {item.detail ? `: ${item.detail}` : ""}
        </Text>
      </Text>
    ))}
  </Box>
);

export const Stepper: React.FC<{ steps: string[]; activeIndex: number }> = ({
  steps,
  activeIndex
}) => (
  <Box>
    {steps.map((step, index) => (
      <Box key={step} marginRight={1}>
        <Text color={index === activeIndex ? theme.accent.glow : theme.fg.tertiary}>
          {step}
        </Text>
        {index < steps.length - 1 ? <Text color={theme.fg.tertiary}> ▸</Text> : null}
      </Box>
    ))}
  </Box>
);

export type SelectListItem = {
  id: string;
  label: string;
  description?: string;
  disabled?: boolean;
  note?: string;
};

export const SelectList: React.FC<{
  items: SelectListItem[];
  selectedIndex: number;
}> = ({ items, selectedIndex }) => (
  <Box flexDirection="column" gap={0}>
    {items.map((item, index) => {
      const isSelected = index === selectedIndex;
      const color = item.disabled
        ? theme.fg.tertiary
        : isSelected
        ? theme.accent.primary
        : theme.fg.secondary;
      return (
        <Box key={item.id} flexDirection="column" marginBottom={1}>
          <Text color={color} bold={isSelected}>
            {item.disabled ? "·" : isSelected ? "▶" : " "} {item.label}
            {item.note ? ` ${item.note}` : ""}
          </Text>
          {item.description ? (
            <Text color={theme.fg.tertiary}>  {item.description}</Text>
          ) : null}
        </Box>
      );
    })}
  </Box>
);

export const Panel: React.FC<{
  title?: string;
  children: React.ReactNode;
  borderStyle?: "single" | "double";
}> = ({ title, children, borderStyle = "single" }) => (
  <Box
    flexDirection="column"
    borderStyle={borderStyle}
    borderColor={theme.fg.tertiary}
    paddingX={1}
    paddingY={0}
  >
    {title ? (
      <Text color={theme.fg.secondary} bold>
        {title}
      </Text>
    ) : null}
    {children}
  </Box>
);

export const ProgressBar: React.FC<{
  value: number;
  max: number;
}> = ({ value, max }) => {
  const { stdout } = useStdout();
  const width = Math.max(10, Math.min(40, (stdout?.columns ?? 80) - 30));
  const ratio = max > 0 ? Math.min(1, value / max) : 0;
  const filled = Math.round(width * ratio);
  const empty = Math.max(0, width - filled);
  return (
    <Text>
      <Text color={theme.accent.primary}>{"█".repeat(filled)}</Text>
      <Text color={theme.fg.tertiary}>{"░".repeat(empty)}</Text>{" "}
      <Text color={theme.fg.secondary}>
        {value}/{max}
      </Text>
    </Text>
  );
};

export const TrendMiniChart: React.FC<{ values: Array<number | null | undefined> }> = ({
  values
}) => {
  const bars = values.map((value) => {
    if (value === null || value === undefined) {
      return "·";
    }
    const level = Math.max(0, Math.min(1, value));
    if (level < 0.2) return "▁";
    if (level < 0.4) return "▂";
    if (level < 0.6) return "▃";
    if (level < 0.8) return "▅";
    return "▇";
  });
  return <Text color={theme.accent.glow}>{bars.join(" ")}</Text>;
};

export const AlertBox: React.FC<{ tone: "info" | "warning" | "error"; children: React.ReactNode }> =
  ({ tone, children }) => (
    <Panel borderStyle="double">
      <Text color={theme.status[tone]}>{children}</Text>
    </Panel>
  );

export const FooterHelpBar: React.FC<{ hints: string[] }> = ({ hints }) => (
  <Box>
    <Text color={theme.fg.tertiary}>{hints.join("  ")}</Text>
  </Box>
);

export const LabelValue: React.FC<{
  label: string;
  value?: string;
  valueProps?: TextProps;
}> = ({ label, value, valueProps }) => (
  <Text color={theme.fg.secondary}>
    {label}:{" "}
    <Text color={theme.fg.primary} {...valueProps}>
      {value ?? "-"}
    </Text>
  </Text>
);

export const TextAreaDisplay: React.FC<{ value: string; height?: number }> = ({
  value,
  height = 6
}) => {
  const lines = value.split("\n");
  const padded = [...lines];
  while (padded.length < height) {
    padded.push("");
  }
  return (
    <Box flexDirection="column">
      {padded.slice(0, height).map((line, index) => (
        <Text key={index} color={theme.fg.primary}>
          {line || " "}
        </Text>
      ))}
    </Box>
  );
};
