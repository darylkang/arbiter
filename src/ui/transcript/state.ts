import type { WarningRecord } from "../../utils/warnings.js";

export type TranscriptPhase = "idle" | "intake" | "running" | "post-run";
export type RunMode = "mock" | "live";

export type ProfileId = "quickstart" | "heterogeneity" | "debate" | "free";

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
  currentBatch?: {
    batchNumber: number;
    total: number;
    completed: number;
  };
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

export type NewFlowState = {
  stage: "await_question" | "select_profile" | "select_mode";
  question?: string;
  profileId?: ProfileId;
};

export type AppState = {
  phase: TranscriptPhase;
  transcript: TranscriptEntry[];
  nextTranscriptEntryId: number;
  overlay: OverlayState | null;
  runProgress: RunProgress;
  warnings: WarningRecord[];
  warningKeys: Set<string>;
  newFlow: NewFlowState | null;
  configPath: string;
  runDir: string;
  lastRunDir: string;
  runMode: RunMode | null;
  question: string;
  profileId: ProfileId;
  hasApiKey: boolean;
  hasConfig: boolean;
  runsCount: number;
  warningsExpanded: boolean;
};

const defaultRunProgress = (): RunProgress => ({
  active: false,
  planned: 0,
  attempted: 0,
  eligible: 0,
  parseSuccess: 0,
  parseFallback: 0,
  parseFailed: 0,
  recentBatches: [],
  noveltyTrend: [],
  usage: {
    prompt: 0,
    completion: 0,
    total: 0
  }
});

export const createInitialState = (input: {
  configPath: string;
  hasApiKey: boolean;
  hasConfig: boolean;
  runsCount: number;
}): AppState => ({
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
  profileId: "quickstart",
  hasApiKey: input.hasApiKey,
  hasConfig: input.hasConfig,
  runsCount: input.runsCount,
  warningsExpanded: false
});

export const resetRunProgress = (state: AppState): void => {
  state.runProgress = defaultRunProgress();
};
