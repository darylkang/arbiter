import type { EventBus } from "../events/event-bus.js";
import type { ArbiterResolvedConfig } from "../generated/config.types.js";
import type { WarningSink } from "../utils/warnings.js";

export type RunMode = "mock" | "live";

export type RunLifecycleContext = {
  mode: RunMode;
  bus: EventBus;
  runDir: string;
  runId: string;
  resolvedConfig: ArbiterResolvedConfig;
  debug: boolean;
  quiet: boolean;
  receiptMode: "auto" | "writeOnly" | "skip";
  warningSink: WarningSink;
};

export interface RunLifecycleHooks {
  onRunSetup?(context: RunLifecycleContext): Promise<void> | void;
  onRunFinally?(context: RunLifecycleContext): Promise<void> | void;
}
