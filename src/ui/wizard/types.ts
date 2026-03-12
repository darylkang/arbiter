export type EntryPath = "existing" | "new";
export type RunMode = "live" | "mock";
export type ProtocolType = "independent" | "debate_v1";
export type TemperatureMode = "single" | "range";
export type SeedMode = "random" | "fixed";

export type WizardDraft = {
  question: string;
  protocolType: ProtocolType;
  participants: number;
  rounds: number;
  modelSlugs: string[];
  personaIds: string[];
  temperatureMode: TemperatureMode;
  temperatureSingle: number;
  temperatureMin: number;
  temperatureMax: number;
  seedMode: SeedMode;
  fixedSeed: number;
  useAdvancedDefaults: boolean;
  workers: number;
  batchSize: number;
  kMax: number;
  maxTokens: number;
  noveltyThreshold: number;
  noveltyPatience: number;
  kMin: number;
  similarityAdvisoryThreshold: number;
  outputDir: string;
};

export type Choice = {
  id: string;
  label: string;
  disabled?: boolean;
  disabledReason?: string;
};

export type ReviewAction = "run" | "save" | "revise" | "quit";

export type CatalogModel = {
  slug: string;
  display: string;
  provider: string;
  tier: string;
  isAliased: boolean;
  metadata: string;
};

export type PersonaOption = {
  id: string;
  displayName: string;
  subtitle: string;
  category: string;
  whenToUse: string;
  riskNote?: string;
  isDefault: boolean;
};

export const SELECT_BACK = "__BACK__";
export const SELECT_EXIT = "__EXIT__";

export type NavigationSignal = typeof SELECT_BACK | typeof SELECT_EXIT;
export type SelectOneResult = string | NavigationSignal;
export type SelectManyResult = string[] | NavigationSignal;

export type RawKey = {
  name?: string;
  ctrl?: boolean;
  sequence?: string;
};

export type StepIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const RAIL_ITEMS = [
  { label: "Entry Path", railIndex: 0 },
  { label: "Run Mode", railIndex: 1 },
  { label: "Research Question", railIndex: 2 },
  { label: "Protocol", railIndex: 3 },
  { label: "Models", railIndex: 4 },
  { label: "Personas", railIndex: 5 },
  { label: "Decode Params", railIndex: 6 },
  { label: "Advanced Settings", railIndex: 7 },
  { label: "Review and Confirm", railIndex: 8 }
] as const;

export type StepFrame = {
  version: string;
  currentRailIndex: number;
  completedUntilRailIndex: number;
  runMode: RunMode | null;
  apiKeyPresent: boolean;
  configCount: number;
  contextLabel: string;
  showRunMode: boolean;
  activeLabel: string;
  activeLines: string[];
  footerText: string;
  stepSummaries: Partial<Record<number, string>>;
  dimmedRail?: boolean;
};

export type PromptResult<T> = T | NavigationSignal;
