import { resolve } from "node:path";

import type { RunLifecycleContext, RunLifecycleHooks } from "../run/lifecycle-hooks.js";
import { buildReceiptModel } from "./receipt-model.js";
import { formatReceiptText } from "./receipt-text.js";
import { writeReceiptText } from "./receipt-writer.js";
import { ExecutionLogger } from "./execution-log.js";

const shouldAttachInteractiveOutputs = (context: RunLifecycleContext): boolean =>
  Boolean(process.stdout.isTTY && !context.quiet);

export const createUiRunLifecycleHooks = (): RunLifecycleHooks => {
  let logger: ExecutionLogger | null = null;

  return {
    onRunSetup: (context): void => {
      if (!shouldAttachInteractiveOutputs(context)) {
        return;
      }
      const executionLogPath = resolve(context.runDir, "execution.log");
      logger = new ExecutionLogger(executionLogPath);
      logger.attach(context.bus);
    },
    onRunFinally: async (context): Promise<void> => {
      if (logger) {
        await logger.close();
        context.bus.emit({ type: "artifact.written", payload: { path: "execution.log" } });
        logger.detach();
        logger = null;
      }

      if (context.receiptMode === "skip") {
        return;
      }

      try {
        const model = buildReceiptModel(context.runDir);
        const text = formatReceiptText(model);
        writeReceiptText(context.runDir, text);
        context.bus.emit({ type: "artifact.written", payload: { path: "receipt.txt" } });

        if (context.receiptMode === "auto") {
          if (shouldAttachInteractiveOutputs(context)) {
            process.stdout.write(text);
          }
        }
      } catch (error) {
        context.warningSink.warn(
          `Failed to render receipt: ${error instanceof Error ? error.message : String(error)}`,
          "receipt"
        );
      }
    }
  };
};
