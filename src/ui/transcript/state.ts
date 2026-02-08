import type { WarningRecord } from "../../utils/warnings.js";

export type TranscriptPhase = "idle" | "intake" | "running" | "post-run";
export type RunMode = "mock" | "live";
export type RunModeSelection = RunMode | "save-only";

export type DecodePresetId = "balanced" | "focused" | "exploratory";
export type AdvancedPresetId = "quick" | "standard" | "thorough";
export type ProtocolChoice = "independent" | "debate_v1";
export type DebateVariant = "standard" | "adversarial";

export type TranscriptEntryKind =
  | "system"
  | "user"
  | "status"
  | "progress"
  | "warning"
  | "error"
  | "report"
  | "verify"
  | "receipt";

export type TranscriptEntry = {
  id: string;
  kind: TranscriptEntryKind;
  content: string;
  timestamp: string;
};

export type OverlayItem = {
  id: string;
  label: string;
  description?: string;
  disabled?: boolean;
};

export type SelectOverlay = {
  kind: "select";
  title: string;
  body?: string;
  items: OverlayItem[];
  selectedIndex: number;
  onSelect: (item: OverlayItem) => void;
  onCancel: () => void;
};

export type ChecklistOverlay = {
  kind: "checklist";
  title: string;
  items: Array<OverlayItem & { selected: boolean }>;
  selectedIndex: number;
  onConfirm: (selectedIds: string[]) => void;
  onCancel: () => void;
};

export type ConfirmOverlay = {
  kind: "confirm";
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  selectedIndex: number;
};

export type OverlayState = SelectOverlay | ChecklistOverlay | ConfirmOverlay;

export type RunProgress = {
  active: boolean;
  planned: number;
  attempted: number;
  eligible: number;
  parseSuccess: number;
  parseFallback: number;
  parseFailed: number;
  workerCount: number;
  workerStatus: Record<
    number,
    {
      status: "busy" | "idle";
      trialId?: number;
    }
  >;
  currentBatch?: {
    batchNumber: number;
    total: number;
    completed: number;
  };
  batchStatusCounts: Record<string, number>;
  recentBatches: Array<{
    batchNumber: number;
    noveltyRate: number | null;
    meanMaxSim: number | null;
    clusterCount?: number;
  }>;
  noveltyTrend: Array<number | null>;
  stopStatus?: {
    mode: string;
    wouldStop: boolean;
    shouldStop: boolean;
  };
  usage: {
    prompt: number;
    completion: number;
    total: number;
    cost?: number;
  };
};

export type GuidedSetupStage =
  | "question"
  | "decode"
  | "personas"
  | "models"
  | "protocol"
  | "advanced"
  | "mode"
  | "review";

export type GuidedSetupState = {
  stage: GuidedSetupStage;
  question: string;
  decodePreset: DecodePresetId;
  temperature: number;
  topP: number;
  maxTokens: number;
  seed: number;
  personaIds: string[];
  modelSlugs: string[];
  protocol: ProtocolChoice;
  debateVariant: DebateVariant;
  advancedPreset: AdvancedPresetId;
  kMax: number;
  workers: number;
  batchSize: number;
  runMode: RunModeSelection;
};

export type AppState = {
  version: string;
  phase: TranscriptPhase;
  transcript: TranscriptEntry[];
  nextTranscriptEntryId: number;
  overlay: OverlayState | null;
  runProgress: RunProgress;
  warnings: WarningRecord[];
  warningKeys: Set<string>;
  newFlow: GuidedSetupState | null;
  configPath: string;
  runDir: string;
  lastRunDir: string;
  runMode: RunMode | null;
  question: string;
  hasApiKey: boolean;
  hasConfig: boolean;
  runsCount: number;
};

const defaultRunProgress = (): RunProgress => ({
  active: false,
  planned: 0,
  attempted: 0,
  eligible: 0,
  parseSuccess: 0,
  parseFallback: 0,
  parseFailed: 0,
  workerCount: 0,
  workerStatus: {},
  batchStatusCounts: {},
  recentBatches: [],
  noveltyTrend: [],
  usage: {
    prompt: 0,
    completion: 0,
    total: 0
  }
});

export const createInitialState = (input: {
  version: string;
  configPath: string;
  hasApiKey: boolean;
  hasConfig: boolean;
  runsCount: number;
}): AppState => ({
  version: input.version,
  phase: "idle",
  transcript: [],
  nextTranscriptEntryId: 1,
  overlay: null,
  runProgress: defaultRunProgress(),
  warnings: [],
  warningKeys: new Set<string>(),
  newFlow: null,
  configPath: input.configPath,
  runDir: "",
  lastRunDir: "",
  runMode: null,
  question: "",
  hasApiKey: input.hasApiKey,
  hasConfig: input.hasConfig,
  runsCount: input.runsCount
});

export const resetRunProgress = (state: AppState): void => {
  state.runProgress = defaultRunProgress();
};
