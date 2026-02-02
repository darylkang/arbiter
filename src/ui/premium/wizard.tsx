import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Box, Text, useApp, useInput } from "ink";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { getAssetRoot } from "../../utils/asset-root.js";
import { resolveConfig } from "../../config/resolve-config.js";
import { validateConfig } from "../../config/schema-validation.js";
import { listModels } from "../../openrouter/client.js";
import { EventBus } from "../../events/event-bus.js";
import type { Event, EventType } from "../../events/types.js";
import { buildReceiptModel } from "../receipt-model.js";
import { formatReceiptText } from "../receipt-text.js";
import { buildReportModel, formatReportText } from "../../tools/report-run.js";
import { runMockCommand, runLiveCommand } from "../../cli/commands.js";
import { resolveWelcomeAction, type WelcomeAction } from "./routing.js";

import {
  BrandBanner,
  StatusLightsPanel,
  Stepper,
  SelectList,
  Panel,
  ProgressBar,
  TrendMiniChart,
  FooterHelpBar,
  LabelValue,
  TextAreaDisplay,
  theme
} from "../ink/kit.js";

const DEFAULT_CONFIG_PATH = "arbiter.config.json";

type Screen =
  | "welcome"
  | "question"
  | "profile"
  | "details"
  | "review"
  | "run"
  | "receipt"
  | "analyze"
  | "analyze-result"
  | "saved";

type RunMode = "mock" | "live";

type ProfileOption = {
  id: "quickstart" | "heterogeneity" | "debate" | "free";
  template: string;
  title: string;
  description: string;
  warning?: string;
};

const PROFILES: ProfileOption[] = [
  {
    id: "quickstart",
    template: "quickstart_independent",
    title: "Quickstart",
    description: "Single-model baseline with advisor-only stopping."
  },
  {
    id: "heterogeneity",
    template: "heterogeneity_mix",
    title: "Heterogeneity Mix",
    description: "Multi-model + multi-persona sampling."
  },
  {
    id: "debate",
    template: "debate_v1",
    title: "Proposer–Critic–Revision",
    description: "Structured critique protocol (3 calls)."
  },
  {
    id: "free",
    template: "free_quickstart",
    title: "Free Tier",
    description: "Free model onboarding profile.",
    warning:
      "Free-tier models are suitable for learning and prototyping. For publishable research, use paid models with stable versioning."
  }
];

type RunState = {
  planned: number;
  attempted: number;
  eligible: number;
  currentBatch?: { batchNumber: number; total: number; completed: number };
  recentBatches: Array<{
    batchNumber: number;
    noveltyRate: number | null;
    meanMaxSim: number | null;
    clusterCount?: number;
  }>;
  noveltyTrend: Array<number | null>;
  stopStatus?: { mode: string; wouldStop: boolean; shouldStop: boolean };
  usage: { prompt: number; completion: number; total: number; cost?: number };
};

const defaultRunState = (): RunState => ({
  planned: 0,
  attempted: 0,
  eligible: 0,
  recentBatches: [],
  noveltyTrend: [],
  usage: { prompt: 0, completion: 0, total: 0 }
});

const loadTemplate = (assetRoot: string, template: string): Record<string, unknown> => {
  const path = resolve(assetRoot, "templates", `${template}.config.json`);
  const raw = readFileSync(path, "utf8");
  return JSON.parse(raw) as Record<string, unknown>;
};

const writeTemplateConfig = (
  assetRoot: string,
  template: string,
  question: string,
  targetPath: string
): void => {
  const data = loadTemplate(assetRoot, template);
  const questionBlock = (data.question ?? {}) as Record<string, unknown>;
  questionBlock.text = question;
  data.question = questionBlock;
  writeFileSync(targetPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
};

const getRunsList = (): string[] => {
  try {
    const entries = readdirSync("runs", { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort()
      .reverse();
  } catch {
    return [];
  }
};

const loadConfigFile = (path: string): Record<string, unknown> | null => {
  try {
    const raw = readFileSync(path, "utf8");
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
};

const buildSummary = (template: Record<string, unknown>): string[] => {
  const sampling = template.sampling as Record<string, unknown>;
  const execution = template.execution as Record<string, unknown>;
  const stopPolicy = (execution?.stop_policy as Record<string, unknown> | undefined) ?? undefined;
  const measurement = template.measurement as Record<string, unknown>;
  const protocol = template.protocol as Record<string, unknown>;
  const models = Array.isArray(sampling?.models)
    ? sampling.models.map((item) => (item as Record<string, unknown>).model).join(", ")
    : "-";
  const personas = Array.isArray(sampling?.personas)
    ? sampling.personas.map((item) => (item as Record<string, unknown>).persona).join(", ")
    : "-";
  const protocolType = protocol?.type ?? "-";
  return [
    `Models: ${models}`,
    `Personas: ${personas}`,
    `Protocol: ${String(protocolType)}`,
    `K_max: ${String(execution?.k_max ?? "-")}`,
    `Batch size: ${String(execution?.batch_size ?? "-")}`,
    `Workers: ${String(execution?.workers ?? "-")}`,
    `Novelty epsilon: ${String(stopPolicy?.novelty_epsilon ?? "-")}`,
    `Patience: ${String(stopPolicy?.patience ?? "-")}`,
    `Embedding: ${String(measurement?.embedding_model ?? "-")}`
  ];
};

const estimateCostLine = (template: Record<string, unknown>): string => {
  const execution = template.execution as Record<string, unknown>;
  const decode = (template.sampling as Record<string, unknown>)?.decode as Record<string, unknown>;
  const kMax = Number(execution?.k_max ?? 0);
  const maxTokens = Number(decode?.max_tokens ?? 256);
  if (!Number.isFinite(kMax) || kMax <= 0 || !Number.isFinite(maxTokens) || maxTokens <= 0) {
    return "Usage will be tracked during the run.";
  }
  return `Estimated output tokens ~${Math.round(kMax * maxTokens)} (rough). Usage will be tracked.`;
};

const RUN_EVENT_TYPES: EventType[] = [
  "run.started",
  "trial.completed",
  "embedding.recorded",
  "batch.started",
  "batch.completed",
  "convergence.record"
];

const useRunEvents = (bus: EventBus | null, onUpdate: (event: Event) => void): void => {
  useEffect(() => {
    if (!bus) {
      return undefined;
    }
    const unsubs = RUN_EVENT_TYPES.map((type) =>
      bus.subscribe(type, (payload) => onUpdate({ type, payload } as Event))
    );
    return () => {
      unsubs.forEach((unsub) => unsub());
    };
  }, [bus, onUpdate]);
};

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

type WelcomeOption = {
  id: string;
  label: string;
  description: string;
  disabled?: boolean;
};

const WelcomeScreen: React.FC<{
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

const QuestionScreen: React.FC<{
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

const ProfileScreen: React.FC<{
  profileIndex: number;
  onSelect: (index: number) => void;
  onNext: () => void;
  onBack: () => void;
}> = ({ profileIndex, onSelect, onNext, onBack }) => {
  useInput((_, key) => {
    if (key.upArrow) {
      onSelect(Math.max(0, profileIndex - 1));
    }
    if (key.downArrow) {
      onSelect(Math.min(PROFILES.length - 1, profileIndex + 1));
    }
    if (key.return) {
      onNext();
    }
    if (key.escape) {
      onBack();
    }
  });

  const listItems = PROFILES.map((profile) => ({
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
        {PROFILES[profileIndex]?.warning ? (
          <Text color={theme.status.warning}>{PROFILES[profileIndex]?.warning}</Text>
        ) : null}
      </Panel>
      <FooterHelpBar hints={["↑/↓ select", "Enter next", "Esc back"]} />
    </Box>
  );
};

const DetailsScreen: React.FC<{
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

const ReviewScreen: React.FC<{
  question: string;
  profile: ProfileOption;
  template: Record<string, unknown>;
  runMode: RunMode;
  assetRoot: string;
  configPath: string;
  allowSave: boolean;
  onRunMock: () => void;
  onRunLive: () => void;
  onSave: () => void;
  onBack: () => void;
}> = ({
  question,
  profile,
  template,
  runMode,
  assetRoot,
  configPath,
  allowSave,
  onRunMock,
  onRunLive,
  onSave,
  onBack
}) => {
  const [validating, setValidating] = useState(true);
  const [preflightStatus, setPreflightStatus] = useState<{ schema?: boolean }>({});
  const [preflightError, setPreflightError] = useState<string | null>(null);

  useEffect(() => {
    setValidating(true);
    setPreflightError(null);
    try {
      if (!existsSync(configPath)) {
        writeTemplateConfig(assetRoot, profile.template, question, configPath);
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
  }, [assetRoot, configPath, question, profile.template]);

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
        <Text color={theme.fg.tertiary}>{estimateCostLine(template)}</Text>
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
        hints={["Enter start", "m run mock", allowSave ? "s save config" : "", "e back"].filter(
          Boolean
        )}
      />
    </Box>
  );
};

const RunScreen: React.FC<{ runState: RunState }> = ({ runState }) => {
  const stopStatus = runState.stopStatus;
  const hasClusters = runState.recentBatches.some((batch) => batch.clusterCount !== undefined);

  return (
    <Box flexDirection="column" gap={1}>
      <BrandBanner variant="compact" />
      <Panel title="Run progress">
        <Text color={theme.fg.secondary}>
          Progress: <ProgressBar value={runState.attempted} max={runState.planned || 1} />
        </Text>
        {runState.currentBatch ? (
          <Text color={theme.fg.secondary}>
            Batch {runState.currentBatch.batchNumber}: {runState.currentBatch.completed}/
            {runState.currentBatch.total} complete
          </Text>
        ) : null}
        <Text color={theme.fg.secondary}>Eligible embeddings: {runState.eligible}</Text>
        {runState.recentBatches.length > 0 ? (
          <Box flexDirection="column" marginTop={1}>
            <Text color={theme.fg.tertiary}>Recent batches:</Text>
            {runState.recentBatches.map((batch) => (
              <Text key={batch.batchNumber} color={theme.fg.secondary}>
                Batch {batch.batchNumber}: novelty{" "}
                {batch.noveltyRate === null ? "null" : batch.noveltyRate.toFixed(3)} | mean sim{" "}
                {batch.meanMaxSim === null ? "null" : batch.meanMaxSim.toFixed(3)}
                {batch.clusterCount !== undefined ? ` | groups ${batch.clusterCount}` : ""}
              </Text>
            ))}
            <Text color={theme.fg.tertiary}>Novelty trend:</Text>
            <TrendMiniChart values={runState.noveltyTrend} />
            {hasClusters ? (
              <Text color={theme.fg.tertiary}>
                Embedding groups reflect similarity in the embedding space, not semantic meaning.
              </Text>
            ) : null}
          </Box>
        ) : null}
        {stopStatus ? (
          <Text color={theme.fg.secondary}>
            Sampling:{" "}
            {stopStatus.shouldStop
              ? "stopped due to low novelty"
              : stopStatus.wouldStop
              ? "likely to stop soon"
              : "sampling continues"}
          </Text>
        ) : null}
      </Panel>
      <Panel title="Usage">
        <Text color={theme.fg.secondary}>
          Tokens: in {runState.usage.prompt}, out {runState.usage.completion}, total{" "}
          {runState.usage.total}
        </Text>
        <Text color={theme.fg.tertiary}>
          Usage tracked; cost shown if provider supplies it.
        </Text>
      </Panel>
      <FooterHelpBar hints={["Ctrl+C graceful stop"]} />
    </Box>
  );
};

const ReceiptScreen: React.FC<{
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
      <FooterHelpBar hints={["r report", "v verify", "n new", "q quit"]} />
    </Box>
  );
};

const AnalyzeScreen: React.FC<{
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
    description: resolve("runs", dir)
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

const AnalyzeResultScreen: React.FC<{
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
      <FooterHelpBar hints={["r report", "c receipt", "v verify", "b back", "q quit"]} />
    </Box>
  );
};

const SavedScreen: React.FC<{ configPath: string; onNew: () => void; onQuit: () => void }> = ({
  configPath,
  onNew,
  onQuit
}) => {
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
      <FooterHelpBar hints={["n new", "q quit"]} />
    </Box>
  );
};

export const PremiumWizard: React.FC = () => {
  const { exit } = useApp();
  const assetRoot = getAssetRoot();
  const [screen, setScreen] = useState<Screen>("welcome");
  const [question, setQuestion] = useState<string>("What are the tradeoffs of event sourcing?");
  const [profileIndex, setProfileIndex] = useState(0);
  const [runMode, setRunMode] = useState<RunMode>("mock");
  const [useExistingConfig, setUseExistingConfig] = useState(false);
  const [configPath] = useState<string>(resolve(process.cwd(), DEFAULT_CONFIG_PATH));
  const [runDir, setRunDir] = useState<string>("");
  const [reportText, setReportText] = useState<string>("");
  const [bus, setBus] = useState<EventBus | null>(null);
  const [runState, setRunState] = useState<RunState>(defaultRunState());
  const [showHelp, setShowHelp] = useState(false);
  const [runsList, setRunsList] = useState<string[]>(getRunsList());
  const [selectedRunIndex, setSelectedRunIndex] = useState(0);

  const selectedProfile = PROFILES[profileIndex] ?? PROFILES[0];
  const existingConfigTemplate = useMemo(
    () => (useExistingConfig ? loadConfigFile(configPath) : null),
    [configPath, useExistingConfig]
  );
  const selectedTemplate = useMemo(() => {
    if (useExistingConfig && existingConfigTemplate) {
      return existingConfigTemplate;
    }
    return loadTemplate(assetRoot, selectedProfile.template);
  }, [assetRoot, existingConfigTemplate, selectedProfile, useExistingConfig]);

  useEffect(() => {
    if (screen === "welcome" || screen === "analyze") {
      setRunsList(getRunsList());
    }
  }, [screen]);

  const handleRunEvent = useCallback((event: Event) => {
    setRunState((state) => {
      const next = { ...state };
      if (event.type === "run.started") {
        next.planned = event.payload.k_planned ?? next.planned;
      }
      if (event.type === "trial.completed") {
        next.attempted += 1;
        if (next.currentBatch && next.currentBatch.completed < next.currentBatch.total) {
          next.currentBatch = {
            ...next.currentBatch,
            completed: next.currentBatch.completed + 1
          };
        }
        const usage = event.payload.trial_record.usage;
        if (usage) {
          next.usage.prompt += usage.prompt_tokens;
          next.usage.completion += usage.completion_tokens;
          next.usage.total += usage.total_tokens;
          if (usage.cost !== undefined) {
            next.usage.cost = (next.usage.cost ?? 0) + usage.cost;
          }
        }
      }
      if (event.type === "embedding.recorded") {
        if (event.payload.embedding_record.embedding_status === "success") {
          next.eligible += 1;
        }
      }
      if (event.type === "batch.started") {
        next.currentBatch = {
          batchNumber: event.payload.batch_number,
          total: event.payload.trial_ids.length,
          completed: 0
        };
      }
      if (event.type === "batch.completed") {
        next.currentBatch = undefined;
      }
      if (event.type === "convergence.record") {
        const record = event.payload.convergence_record;
        next.recentBatches = [
          ...next.recentBatches.slice(-2),
          {
            batchNumber: record.batch_number,
            noveltyRate: record.novelty_rate ?? null,
            meanMaxSim: record.mean_max_sim_to_prior ?? null,
            clusterCount: record.cluster_count
          }
        ];
        next.noveltyTrend = [...next.noveltyTrend.slice(-12), record.novelty_rate ?? null];
        next.stopStatus = {
          mode: record.stop.mode,
          wouldStop: record.stop.would_stop,
          shouldStop: record.stop.should_stop
        };
      }
      return next;
    });
  }, []);

  useRunEvents(bus, handleRunEvent);

  const handleStartRun = useCallback(
    async (mode: RunMode): Promise<void> => {
      const path = configPath;
      const busInstance = new EventBus();
      setBus(busInstance);
      setRunState(defaultRunState());
      setScreen("run");
      try {
        if (mode === "mock") {
          const parsed = {
            positional: [path],
            flags: { "--config": path, "--out": "runs", "--quiet": true }
          };
          const result = await runMockCommand(parsed, assetRoot, {
            bus: busInstance,
            receiptMode: "writeOnly",
            forceInk: true,
            showPreview: false
          });
          if (result && typeof result === "object" && "runDir" in result) {
            setRunDir((result as { runDir?: string }).runDir ?? "");
          }
        } else {
          const parsed = {
            positional: [path],
            flags: { "--config": path, "--out": "runs", "--quiet": true }
          };
          const result = await runLiveCommand(parsed, assetRoot, {
            bus: busInstance,
            receiptMode: "writeOnly",
            forceInk: true,
            showPreview: false
          });
          if (result && typeof result === "object" && "runDir" in result) {
            setRunDir((result as { runDir?: string }).runDir ?? "");
          }
        }
        setScreen("receipt");
      } catch (error) {
        setReportText(
          `Run failed: ${error instanceof Error ? error.message : String(error)}`
        );
        setScreen("analyze-result");
      }
    },
    [assetRoot, configPath]
  );

  const handleRunMock = useCallback(() => {
    void handleStartRun("mock");
  }, [handleStartRun]);

  const handleRunLive = useCallback(() => {
    if (!process.env.OPENROUTER_API_KEY) {
      setReportText("OPENROUTER_API_KEY missing for live run.");
      setScreen("analyze-result");
      return;
    }
    const run = async (): Promise<void> => {
      try {
        await listModels();
        await handleStartRun("live");
      } catch (error) {
        setReportText(
          `Live probe failed: ${error instanceof Error ? error.message : String(error)}`
        );
        setScreen("analyze-result");
      }
    };
    void run();
  }, [handleStartRun]);

  const welcomeOptions: WelcomeOption[] = [
    { id: "new", label: "Start a new study", description: "Guided setup." },
    { id: "learn", label: "Learn with mock mode", description: "No API calls." },
    {
      id: "run-existing",
      label: "Run existing config",
      description: "Use arbiter.config.json in this folder.",
      disabled: !existsSync(configPath)
    },
    {
      id: "analyze",
      label: "Analyze a previous run",
      description: "Report or verify an existing run.",
      disabled: runsList.length === 0
    },
    { id: "help", label: "What is Arbiter?", description: "Short help." },
    { id: "quit", label: "Quit", description: "" }
  ];

  const handleWelcomeSelect = (id: string): void => {
    const outcome = resolveWelcomeAction(id as WelcomeAction);
    if (outcome.kind === "exit") {
      exit();
      return;
    }
    if (outcome.kind === "help") {
      setShowHelp(true);
      return;
    }
    if (outcome.kind === "screen") {
      if (outcome.runMode) {
        setRunMode(outcome.runMode);
      }
      setUseExistingConfig(outcome.screen === "review");
      if (outcome.screen === "review") {
        const existing = loadConfigFile(configPath);
        const questionText = (existing?.question as { text?: unknown } | undefined)?.text;
        if (typeof questionText === "string" && questionText.trim().length > 0) {
          setQuestion(questionText);
        }
      }
      setScreen(outcome.screen);
    }
  };

  const receiptText = runDir ? formatReceiptText(buildReceiptModel(runDir)) : "Run complete.";
  const displayProfile: ProfileOption = useExistingConfig
    ? {
        id: "quickstart",
        template: selectedProfile.template,
        title: "Existing config",
        description: "Using arbiter.config.json"
      }
    : selectedProfile;

  if (screen === "welcome") {
    const hasApiKey = Boolean(process.env.OPENROUTER_API_KEY);
    const hasConfig = existsSync(configPath);
    const runsCount = runsList.length;

    return (
      <WelcomeScreen
        options={welcomeOptions}
        hasApiKey={hasApiKey}
        hasConfig={hasConfig}
        runsCount={runsCount}
        showHelp={showHelp}
        onSelect={handleWelcomeSelect}
        onToggleHelp={() => setShowHelp((prev) => !prev)}
        onQuit={() => exit()}
      />
    );
  }

  if (screen === "question") {
    return (
      <QuestionScreen
        question={question}
        onChange={setQuestion}
        onNext={() => setScreen("profile")}
        onBack={() => setScreen("welcome")}
      />
    );
  }

  if (screen === "profile") {
    return (
      <ProfileScreen
        profileIndex={profileIndex}
        onSelect={setProfileIndex}
        onNext={() => setScreen("details")}
        onBack={() => setScreen("question")}
      />
    );
  }

  if (screen === "details") {
    const summary = buildSummary(selectedTemplate);
    return (
      <DetailsScreen
        summary={summary}
        onNext={() => setScreen("review")}
        onSave={() => {
          writeTemplateConfig(assetRoot, selectedProfile.template, question, configPath);
          setScreen("saved");
        }}
        onBack={() => setScreen("profile")}
      />
    );
  }

  if (screen === "review") {
    return (
      <ReviewScreen
        question={question}
        profile={displayProfile}
        template={selectedTemplate}
        runMode={runMode}
        assetRoot={assetRoot}
        configPath={configPath}
        allowSave={!useExistingConfig}
        onRunMock={handleRunMock}
        onRunLive={handleRunLive}
        onSave={() => {
          writeTemplateConfig(assetRoot, selectedProfile.template, question, configPath);
          setScreen("saved");
        }}
        onBack={() => setScreen("details")}
      />
    );
  }

  if (screen === "run") {
    return <RunScreen runState={runState} />;
  }

  if (screen === "receipt") {
    return (
      <ReceiptScreen
        receiptText={receiptText}
        onReport={() => {
          if (runDir) {
            setReportText(formatReportText(buildReportModel(runDir, 3)));
            setScreen("analyze-result");
          }
        }}
        onVerify={() => {
          if (runDir) {
            setReportText("Use: arbiter verify " + runDir);
            setScreen("analyze-result");
          }
        }}
        onNew={() => setScreen("welcome")}
        onQuit={() => exit()}
      />
    );
  }

  if (screen === "analyze") {
    return (
      <AnalyzeScreen
        runDirs={runsList}
        selectedIndex={selectedRunIndex}
        onSelectIndex={setSelectedRunIndex}
        onChoose={(dir) => {
          setRunDir(resolve("runs", dir));
          setScreen("analyze-result");
        }}
        onBack={() => setScreen("welcome")}
      />
    );
  }

  if (screen === "analyze-result") {
    return (
      <AnalyzeResultScreen
        reportText={reportText}
        onReport={() => {
          if (runDir) {
            setReportText(formatReportText(buildReportModel(runDir, 3)));
          }
        }}
        onReceipt={() => {
          if (runDir) {
            setReportText(formatReceiptText(buildReceiptModel(runDir)));
          }
        }}
        onVerify={() => {
          if (runDir) {
            setReportText(`Run: arbiter verify ${runDir}`);
          }
        }}
        onBack={() => setScreen("analyze")}
        onQuit={() => exit()}
      />
    );
  }

  if (screen === "saved") {
    return (
      <SavedScreen
        configPath={configPath}
        onNew={() => setScreen("welcome")}
        onQuit={() => exit()}
      />
    );
  }

  return null;
};

export const runPremiumWizard = async (): Promise<void> => {
  const { render } = await import("ink");
  const instance = render(<PremiumWizard />);
  await instance.waitUntilExit();
};
