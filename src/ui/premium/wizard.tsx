import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { Box, useApp, useInput } from "ink";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { getAssetRoot } from "../../utils/asset-root.js";
import { listModels } from "../../openrouter/client.js";
import { EventBus } from "../../events/event-bus.js";
import type { Event, EventType } from "../../events/types.js";
import { buildReceiptModel } from "../receipt-model.js";
import { formatReceiptText } from "../receipt-text.js";
import { createUiRunLifecycleHooks } from "../run-lifecycle-hooks.js";
import { buildReportModel, formatReportText } from "../../tools/report-run.js";
import { runLiveService, runMockService } from "../../run/run-service.js";
import { createEventWarningSink, type WarningRecord } from "../../utils/warnings.js";
import { resolveWelcomeAction, type WelcomeAction } from "./routing.js";

import { WarningsPanel } from "../ink/kit.js";
import {
  defaultRunState,
  type ProfileOption,
  type RunMode,
  type RunState,
  type Screen,
  type WelcomeOption
} from "./types.js";
import { WelcomeScreen } from "./screens/WelcomeScreen.js";
import { QuestionScreen } from "./screens/QuestionScreen.js";
import { ProfileScreen } from "./screens/ProfileScreen.js";
import { DetailsScreen } from "./screens/DetailsScreen.js";
import { ReviewScreen } from "./screens/ReviewScreen.js";
import { RunScreen } from "./screens/RunScreen.js";
import { ReceiptScreen } from "./screens/ReceiptScreen.js";
import { AnalyzeScreen } from "./screens/AnalyzeScreen.js";
import { AnalyzeResultScreen } from "./screens/AnalyzeResultScreen.js";
import { SavedScreen } from "./screens/SavedScreen.js";

const DEFAULT_CONFIG_PATH = "arbiter.config.json";

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
  "parsed.output",
  "embedding.recorded",
  "batch.started",
  "batch.completed",
  "convergence.record",
  "run.completed",
  "run.failed"
];

const useRunEvents = (
  bus: EventBus | null,
  onUpdate: (event: Event) => void,
  onError: (error: unknown, type: EventType) => void
): void => {
  useEffect(() => {
    if (!bus) {
      return undefined;
    }
    const unsubs = RUN_EVENT_TYPES.map((type) =>
      bus.subscribeSafe(
        type,
        (payload) => onUpdate({ type, payload } as Event),
        (error) => onError(error, type)
      )
    );
    return () => {
      unsubs.forEach((unsub) => unsub());
    };
  }, [bus, onUpdate, onError]);
};

const useWarningEvents = (
  bus: EventBus | null,
  onWarning: (warning: WarningRecord) => void,
  onError: (error: unknown) => void
): void => {
  useEffect(() => {
    if (!bus) {
      return undefined;
    }
    const unsub = bus.subscribeSafe(
      "warning.raised",
      (payload) => onWarning(payload),
      (error) => onError(error)
    );
    return () => {
      unsub();
    };
  }, [bus, onWarning, onError]);
};

const parseRateLimit = (message?: string, code?: string | null): boolean => {
  const combined = `${code ?? ""} ${message ?? ""}`.toLowerCase();
  return combined.includes("rate") && combined.includes("limit");
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
  const [warnings, setWarnings] = useState<WarningRecord[]>([]);
  const [warningsExpanded, setWarningsExpanded] = useState(false);
  const parseCountsRef = useRef({ success: 0, fallback: 0, failed: 0 });
  const warningKeysRef = useRef(new Set<string>());

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

  useInput((input) => {
    if (input === "w" && screen !== "question") {
      setWarningsExpanded((prev) => !prev);
    }
  });

  const addWarning = useCallback((message: string, source?: string) => {
    setWarnings((prev) => [
      ...prev,
      { message, source, recorded_at: new Date().toISOString() }
    ]);
  }, []);

  const addWarningOnce = useCallback(
    (key: string, message: string, source?: string) => {
      if (warningKeysRef.current.has(key)) {
        return;
      }
      warningKeysRef.current.add(key);
      addWarning(message, source);
    },
    [addWarning]
  );

  const handleRunEvent = useCallback(
    (event: Event) => {
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
          const record = event.payload.trial_record;
          if (record.actual_model && record.requested_model_slug && record.actual_model !== record.requested_model_slug) {
            addWarningOnce(
              "model-mismatch",
              "Requested and actual models differ for some trials. See trials.jsonl actual_model.",
              "provenance"
            );
          }
          const retryCount = record.attempt?.retry_count ?? 0;
          const callRetries = Array.isArray(record.calls)
            ? record.calls.some((call) => (call.attempt?.retry_count ?? 0) > 0)
            : false;
          if (retryCount > 0 || callRetries) {
            addWarningOnce(
              "retries",
              "Some calls required retries; inspect trials.jsonl for retry counts.",
              "runtime"
            );
          }
          if (record.status === "model_unavailable") {
            addWarningOnce(
              "model-unavailable",
              "Some trials failed with model_unavailable.",
              "runtime"
            );
          }
          if (record.error && parseRateLimit(record.error.message, record.error.code ?? null)) {
            addWarningOnce(
              "rate-limit",
              "Rate limit errors occurred; some trials may have failed.",
              "runtime"
            );
          }
        }
        if (event.type === "parsed.output") {
          const status = event.payload.parsed_record.parse_status;
          if (status === "success" || status === "fallback" || status === "failed") {
            const nextCounts = { ...parseCountsRef.current };
            nextCounts[status] += 1;
            parseCountsRef.current = nextCounts;
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
        if (event.type === "run.completed" || event.type === "run.failed") {
          const counts = parseCountsRef.current;
          if (counts.fallback > 0) {
            addWarningOnce(
              "parse-fallback",
              `${counts.fallback} trial(s) used fallback parsing; review parsed.jsonl for raw outputs.`,
              "parsing"
            );
          }
          if (counts.failed > 0) {
            addWarningOnce(
              "parse-failed",
              `${counts.failed} trial(s) had failed parsing with empty output.`,
              "parsing"
            );
          }
        }
        return next;
      });
    },
    [addWarningOnce]
  );

  const handleRunEventError = useCallback(
    (error: unknown, type: EventType) => {
      const message = error instanceof Error ? error.message : String(error);
      addWarningOnce(
        `event-${type}`,
        `Event handler error for ${type}: ${message}`,
        "ui"
      );
    },
    [addWarningOnce]
  );

  const handleWarningEvent = useCallback(
    (warning: WarningRecord) => {
      setWarnings((prev) => [...prev, warning]);
    },
    []
  );

  const handleWarningError = useCallback(
    (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      addWarningOnce("warning-handler", `Warning handler error: ${message}`, "ui");
    },
    [addWarningOnce]
  );

  useRunEvents(bus, handleRunEvent, handleRunEventError);
  useWarningEvents(bus, handleWarningEvent, handleWarningError);

  const handleStartRun = useCallback(
    async (mode: RunMode): Promise<void> => {
      const path = configPath;
      const busInstance = new EventBus();
      const warningSink = createEventWarningSink(busInstance);
      setBus(busInstance);
      setWarnings([]);
      warningKeysRef.current.clear();
      parseCountsRef.current = { success: 0, fallback: 0, failed: 0 };
      setWarningsExpanded(false);
      setRunState(defaultRunState());
      setScreen("run");
      try {
        if (mode === "mock") {
          const result = await runMockService({
            configPath: path,
            assetRoot,
            runsDir: "runs",
            debug: false,
            quiet: true,
            bus: busInstance,
            receiptMode: "writeOnly",
            hooks: createUiRunLifecycleHooks({ forceInk: true }),
            warningSink,
            forwardWarningEvents: false
          });
          if (result && typeof result === "object" && "runDir" in result) {
            setRunDir((result as { runDir?: string }).runDir ?? "");
          }
        } else {
          const result = await runLiveService({
            configPath: path,
            assetRoot,
            runsDir: "runs",
            debug: false,
            quiet: true,
            bus: busInstance,
            receiptMode: "writeOnly",
            hooks: createUiRunLifecycleHooks({ forceInk: true }),
            warningSink,
            forwardWarningEvents: false
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

  const ensureConfig = (): void => {
    writeTemplateConfig(assetRoot, selectedProfile.template, question, configPath);
  };

  const renderWithWarnings = (content: React.ReactNode): React.ReactNode => (
    <Box flexDirection="column" gap={1}>
      {content}
      <WarningsPanel warnings={warnings} expanded={warningsExpanded} />
    </Box>
  );

  if (screen === "welcome") {
    const hasApiKey = Boolean(process.env.OPENROUTER_API_KEY);
    const hasConfig = existsSync(configPath);
    const runsCount = runsList.length;

    return renderWithWarnings(
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
    return renderWithWarnings(
      <QuestionScreen
        question={question}
        onChange={setQuestion}
        onNext={() => setScreen("profile")}
        onBack={() => setScreen("welcome")}
      />
    );
  }

  if (screen === "profile") {
    return renderWithWarnings(
      <ProfileScreen
        profileIndex={profileIndex}
        profiles={PROFILES}
        onSelect={setProfileIndex}
        onNext={() => setScreen("details")}
        onBack={() => setScreen("question")}
      />
    );
  }

  if (screen === "details") {
    const summary = buildSummary(selectedTemplate);
    return renderWithWarnings(
      <DetailsScreen
        summary={summary}
        onNext={() => {
          ensureConfig();
          setScreen("review");
        }}
        onSave={() => {
          ensureConfig();
          setScreen("saved");
        }}
        onBack={() => setScreen("profile")}
      />
    );
  }

  if (screen === "review") {
    const costLine = estimateCostLine(selectedTemplate);
    return renderWithWarnings(
      <ReviewScreen
        question={question}
        profile={displayProfile}
        runMode={runMode}
        assetRoot={assetRoot}
        configPath={configPath}
        allowSave={!useExistingConfig}
        costLine={costLine}
        ensureConfig={ensureConfig}
        onRunMock={handleRunMock}
        onRunLive={handleRunLive}
        onSave={() => {
          ensureConfig();
          setScreen("saved");
        }}
        onBack={() => setScreen("details")}
        onWarning={addWarning}
      />
    );
  }

  if (screen === "run") {
    return renderWithWarnings(<RunScreen runState={runState} warningHint="w warnings" />);
  }

  if (screen === "receipt") {
    return renderWithWarnings(
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
    return renderWithWarnings(
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
    return renderWithWarnings(
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
    return renderWithWarnings(
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
