export type UiRunMode = "live" | "mock" | null;

export const UI_COPY = {
  brand: "A R B I T E R",
  tagline: "Distributional reasoning harness",
  stoppingCaveat: "Stopping indicates diminishing novelty, not correctness.",
  groupingCaveat: "Groups reflect embedding similarity, not semantic categories.",
  headlessNoTty: "TTY not detected. Showing headless help.",
  dashboardNoTty: "Dashboard requested without TTY; continuing in headless mode.",
  disabledOption: "That option is not available.",
  runExistingUnavailable:
    "Run existing config is unavailable: no config files found in this directory.",
  liveModeUnavailable:
    "Live mode is unavailable: OPENROUTER_API_KEY not detected.",
  gracefulStopRequested:
    "Graceful stop requested. Finishing in-flight trials and writing partial artifacts.",
  startingRun: "Starting run",
  runHeader: "── PROGRESS ──",
  receiptHeader: "── RECEIPT ──"
} as const;

export const toRunModeLabel = (mode: UiRunMode): string => {
  if (mode === "live") {
    return "Live";
  }
  if (mode === "mock") {
    return "Mock";
  }
  return "—";
};

export const toApiKeyPresenceLabel = (present: boolean): string =>
  present ? "detected" : "not detected";

export const toStopBanner = (reason?: string): string => {
  switch (reason) {
    case "converged":
      return "Stopped: novelty saturation";
    case "k_max_reached":
      return "Stopped: max trials reached";
    case "user_interrupt":
      return "Stopped: user requested graceful stop";
    case "completed":
      return "Stopped: sampling complete";
    default:
      return "Stopped: run failed";
  }
};
