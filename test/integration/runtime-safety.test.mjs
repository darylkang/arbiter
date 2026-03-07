import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import { EventBus } from "../../src/events/event-bus.ts";
import { deriveFailureStatus } from "../../src/engine/status.ts";
import { runMockService } from "../../src/run/run-service.ts";
import { createEventWarningSink } from "../../src/utils/warnings.ts";
import { buildIndependentSmokeConfig } from "../helpers/scenarios.mjs";
import { REPO_ROOT, withTempWorkspace, writeJson } from "../helpers/workspace.mjs";

const quietWarningSink = (bus) => createEventWarningSink(bus);

test("runMockService does not leak signal handlers across repeated invocations", { concurrency: false }, async () => {
  await withTempWorkspace("arbiter-signal-", async (cwd) => {
    const runsDir = resolve(cwd, "runs");
    mkdirSync(runsDir, { recursive: true });
    const configPath = resolve(cwd, "arbiter.config.json");
    writeJson(
      configPath,
      buildIndependentSmokeConfig({
        questionText: "Signal handler test",
        questionId: "signal_test",
        kMax: 1,
        batchSize: 1,
        workers: 1
      })
    );

    const runOnce = async () => {
      const bus = new EventBus();
      await runMockService({
        configPath,
        assetRoot: REPO_ROOT,
        runsDir,
        debug: false,
        quiet: true,
        bus,
        receiptMode: "skip",
        warningSink: quietWarningSink(bus),
        forwardWarningEvents: false
      });
    };

    const beforeSigint = process.listenerCount("SIGINT");
    const beforeSigterm = process.listenerCount("SIGTERM");

    await runOnce();
    await runOnce();

    assert.equal(process.listenerCount("SIGINT"), beforeSigint);
    assert.equal(process.listenerCount("SIGTERM"), beforeSigterm);
  });
});

test("quiet mock runs do not write warnings directly to stdout or stderr", { concurrency: false }, async () => {
  await withTempWorkspace("arbiter-tui-warn-", async (cwd) => {
    const runsDir = resolve(cwd, "runs");
    mkdirSync(runsDir, { recursive: true });
    const configPath = resolve(cwd, "arbiter.config.json");
    writeJson(
      configPath,
      buildIndependentSmokeConfig({
        questionText: "TUI warning sink test",
        questionId: "tui_warn",
        kMax: 1,
        batchSize: 1,
        workers: 1,
        seed: 7
      })
    );

    let stderrWrites = 0;
    const originalStdout = process.stdout.write.bind(process.stdout);
    const originalStderr = process.stderr.write.bind(process.stderr);
    const originalWarn = console.warn;
    const originalError = console.error;

    process.stdout.write = (chunk, encoding, cb) => {
      return originalStdout(chunk, encoding, cb);
    };
    process.stderr.write = (chunk, encoding, cb) => {
      stderrWrites += 1;
      return originalStderr(chunk, encoding, cb);
    };
    console.warn = () => {
      throw new Error("console.warn called during transcript-style run");
    };
    console.error = () => {
      throw new Error("console.error called during transcript-style run");
    };

    try {
      const bus = new EventBus();
      await runMockService({
        configPath,
        assetRoot: REPO_ROOT,
        runsDir,
        debug: false,
        quiet: true,
        bus,
        receiptMode: "skip",
        warningSink: quietWarningSink(bus),
        forwardWarningEvents: false
      });
    } finally {
      process.stdout.write = originalStdout;
      process.stderr.write = originalStderr;
      console.warn = originalWarn;
      console.error = originalError;
    }

    assert.equal(stderrWrites, 0);
  });
});

test("deriveFailureStatus remains shadow-covered in the integration lane", () => {
  assert.equal(
    deriveFailureStatus({ timeoutExhausted: true, modelUnavailable: true }),
    "timeout_exhausted"
  );
  assert.equal(
    deriveFailureStatus({ timeoutExhausted: false, modelUnavailable: true }),
    "model_unavailable"
  );
});
