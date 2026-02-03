export type Screen =
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

export type RunMode = "mock" | "live";

export type ProfileOption = {
  id: "quickstart" | "heterogeneity" | "debate" | "free";
  template: string;
  title: string;
  description: string;
  warning?: string;
};

export type RunState = {
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

export const defaultRunState = (): RunState => ({
  planned: 0,
  attempted: 0,
  eligible: 0,
  recentBatches: [],
  noveltyTrend: [],
  usage: { prompt: 0, completion: 0, total: 0 }
});

export type WelcomeOption = {
  id: string;
  label: string;
  description: string;
  disabled?: boolean;
};
