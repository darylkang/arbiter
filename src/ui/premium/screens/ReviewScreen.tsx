import React, { useEffect, useRef, useState } from "react";
import { Box, Text, useInput } from "ink";
import { existsSync } from "node:fs";
import { dirname } from "node:path";

import { resolveConfig } from "../../../config/resolve-config.js";
import { validateConfig } from "../../../config/schema-validation.js";
import { BrandBanner, FooterHelpBar, LabelValue, Panel, Stepper, theme } from "../../ink/kit.js";
import type { ProfileOption, RunMode } from "../types.js";

export const ReviewScreen: React.FC<{
  question: string;
  profile: ProfileOption;
  runMode: RunMode;
  assetRoot: string;
  configPath: string;
  allowSave: boolean;
  costLine: string;
  ensureConfig: () => void;
  onRunMock: () => void;
  onRunLive: () => void;
  onSave: () => void;
  onBack: () => void;
  onWarning: (message: string, source?: string) => void;
}> = ({
  question,
  profile,
  runMode,
  assetRoot,
  configPath,
  allowSave,
  costLine,
  ensureConfig,
  onRunMock,
  onRunLive,
  onSave,
  onBack,
  onWarning
}) => {
  const [validating, setValidating] = useState(true);
  const [preflightStatus, setPreflightStatus] = useState<{ schema?: boolean }>({});
  const [preflightError, setPreflightError] = useState<string | null>(null);
  const warnedRef = useRef({ schema: false, apiKey: false, profile: false });

  useEffect(() => {
    setValidating(true);
    setPreflightError(null);
    try {
      if (!existsSync(configPath)) {
        ensureConfig();
      }
      if (!existsSync(configPath)) {
        throw new Error("Config file not found (save or create first).");
      }
      const resolved = resolveConfig({
        configPath,
        configRoot: dirname(configPath),
        assetRoot
      });
      if (!validateConfig(resolved.resolvedConfig)) {
        throw new Error("Resolved config invalid");
      }
      setPreflightStatus({ schema: true });
    } catch (error) {
      setPreflightError(error instanceof Error ? error.message : String(error));
      setPreflightStatus({ schema: false });
    } finally {
      setValidating(false);
    }
  }, [assetRoot, configPath, ensureConfig]);

  useEffect(() => {
    if (preflightStatus.schema === false && !warnedRef.current.schema) {
      onWarning("Pre-flight schema validation failed. Fix the config before running.", "preflight");
      warnedRef.current.schema = true;
    }
    if (runMode === "live" && !process.env.OPENROUTER_API_KEY && !warnedRef.current.apiKey) {
      onWarning("API key missing for live mode. Set OPENROUTER_API_KEY or switch to mock.", "preflight");
      warnedRef.current.apiKey = true;
    }
    if (profile.warning && !warnedRef.current.profile) {
      onWarning(profile.warning, "profile");
      warnedRef.current.profile = true;
    }
  }, [preflightStatus.schema, profile.warning, runMode, onWarning]);

  useInput((input, key) => {
    if (input === "m") {
      onRunMock();
    }
    if (key.return) {
      if (runMode === "mock") {
        onRunMock();
      } else {
        onRunLive();
      }
    }
    if (input === "s" && allowSave) {
      onSave();
    }
    if (input === "e" || key.escape) {
      onBack();
    }
  });

  return (
    <Box flexDirection="column" gap={1}>
      <BrandBanner variant="compact" />
      <Stepper steps={["Question", "Profile", "Review", "Run"]} activeIndex={2} />
      <Panel title="Review">
        <LabelValue label="Question" value={question.trim().slice(0, 120)} />
        <LabelValue label="Profile" value={profile.title} />
        <LabelValue label="Mode" value={runMode === "mock" ? "Mock" : "Live"} />
        <LabelValue label="Output" value="runs/" />
        <Text color={theme.fg.tertiary}>{costLine}</Text>
      </Panel>
      <Panel title="Pre-flight checks">
        <Text color={theme.fg.secondary}>
          Schema valid:{" "}
          <Text color={preflightStatus.schema ? theme.status.success : theme.status.error}>
            {preflightStatus.schema ? "OK" : validating ? "checking..." : "failed"}
          </Text>
        </Text>
        <Text color={theme.fg.secondary}>
          Live probe:{" "}
          <Text color={theme.fg.tertiary}>
            {process.env.OPENROUTER_API_KEY ? "ready" : "API key missing"}
          </Text>
        </Text>
        {preflightError ? <Text color={theme.status.error}>{preflightError}</Text> : null}
        {profile.warning ? <Text color={theme.status.warning}>{profile.warning}</Text> : null}
      </Panel>
      <FooterHelpBar
        hints={
          ["Enter start", "m run mock", allowSave ? "s save config" : "", "e back"].filter(Boolean)
        }
      />
    </Box>
  );
};
