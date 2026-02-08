import assert from "node:assert/strict";
import test from "node:test";

import { EventBus } from "../../dist/events/event-bus.js";
import { createRunController } from "../../dist/ui/transcript/run-controller.js";
import { createInitialState } from "../../dist/ui/transcript/state.js";

const makeState = () =>
  createInitialState({
    version: "0.1.0-test",
    configPath: "/tmp/arbiter.config.json",
    hasApiKey: false,
    hasConfig: false,
    runsCount: 0
  });

const emitRunStarted = (bus, runId = "run_test_1") => {
  bus.emit({
    type: "run.started",
    payload: {
      run_id: runId,
      started_at: "2026-02-08T00:00:00.000Z",
      resolved_config: { protocol: { type: "independent" } },
      debug_enabled: false,
      k_planned: 1
    }
  });
};

const emitRunCompleted = (bus, runId = "run_test_1") => {
  bus.emit({
    type: "run.completed",
    payload: {
      run_id: runId,
      completed_at: "2026-02-08T00:00:01.000Z",
      stop_reason: "completed",
      incomplete: false
    }
  });
};

test("startRun refuses to run when config is missing", async () => {
  const state = makeState();
  let runMockCalls = 0;

  const controller = createRunController(
    {
      assetRoot: process.cwd(),
      state,
      requestRender: () => {}
    },
    {
      configExists: () => false,
      runMock: async () => {
        runMockCalls += 1;
        return { runDir: "/tmp/runs/should-not-run" };
      }
    }
  );

  await controller.startRun("mock");

  assert.equal(runMockCalls, 0);
  assert.equal(state.phase, "idle");
  assert.ok(
    state.transcript.some(
      (entry) =>
        entry.kind === "error" &&
        entry.content.includes("Configuration not found")
    )
  );
});

test("startRun live mode requires OPENROUTER_API_KEY", async () => {
  const state = makeState();
  let runLiveCalls = 0;
  const previousKey = process.env.OPENROUTER_API_KEY;
  delete process.env.OPENROUTER_API_KEY;

  try {
    const controller = createRunController(
      {
        assetRoot: process.cwd(),
        state,
        requestRender: () => {}
      },
      {
        configExists: () => true,
        runLive: async () => {
          runLiveCalls += 1;
          return { runDir: "/tmp/runs/should-not-run" };
        }
      }
    );

    await controller.startRun("live");

    assert.equal(runLiveCalls, 0);
    assert.equal(state.phase, "idle");
    assert.ok(
      state.transcript.some(
        (entry) => entry.kind === "error" && entry.content.includes("OpenRouter API key not found")
      )
    );
  } finally {
    if (previousKey === undefined) {
      delete process.env.OPENROUTER_API_KEY;
    } else {
      process.env.OPENROUTER_API_KEY = previousKey;
    }
  }
});

test("startRun success path updates run directory, receipt, and progress", async () => {
  const state = makeState();
  let renderCount = 0;

  const controller = createRunController(
    {
      assetRoot: process.cwd(),
      state,
      requestRender: () => {
        renderCount += 1;
      }
    },
    {
      configExists: () => true,
      runMock: async (options) => {
        emitRunStarted(options.bus, "run_success");
        options.bus.emit({
          type: "trial.completed",
          payload: {
            trial_record: {
              trial_id: 0,
              status: "success",
              requested_model_slug: "mock/model",
              actual_model: "mock/model",
              usage: {
                prompt_tokens: 2,
                completion_tokens: 3,
                total_tokens: 5
              },
              attempt: {
                retry_count: 0,
                completed_at: "2026-02-08T00:00:00.500Z"
              },
              calls: []
            }
          }
        });
        emitRunCompleted(options.bus, "run_success");
        return { runDir: "/tmp/runs/run_success" };
      },
      listRunsCount: () => 7,
      renderReceipt: () => "receipt preview text",
      createLifecycleHooks: () => ({})
    }
  );

  await controller.startRun("mock");

  assert.equal(state.phase, "post-run");
  assert.equal(state.runProgress.attempted, 1);
  assert.equal(state.runDir, "/tmp/runs/run_success");
  assert.equal(state.lastRunDir, "/tmp/runs/run_success");
  assert.equal(state.runsCount, 7);
  assert.ok(state.transcript.some((entry) => entry.kind === "receipt" && entry.content.includes("receipt preview text")));
  assert.ok(state.transcript.some((entry) => entry.kind === "status" && entry.content.includes("Artifacts written")));
  assert.ok(renderCount > 0);
});

test("startRun failure path transitions to post-run with error message", async () => {
  const state = makeState();

  const controller = createRunController(
    {
      assetRoot: process.cwd(),
      state,
      requestRender: () => {}
    },
    {
      configExists: () => true,
      runMock: async () => {
        throw new Error("mock failure");
      }
    }
  );

  await controller.startRun("mock");

  assert.equal(state.phase, "post-run");
  assert.ok(
    state.transcript.some(
      (entry) => entry.kind === "error" && entry.content.includes("Run execution failed: mock failure")
    )
  );
});

test("startRun prevents overlapping runs while one is in-flight", async () => {
  const state = makeState();

  let releaseRun = null;
  const gate = new Promise((resolve) => {
    releaseRun = resolve;
  });

  const controller = createRunController(
    {
      assetRoot: process.cwd(),
      state,
      requestRender: () => {}
    },
    {
      configExists: () => true,
      runMock: async (options) => {
        emitRunStarted(options.bus, "run_overlap");
        await gate;
        emitRunCompleted(options.bus, "run_overlap");
        return { runDir: "/tmp/runs/run_overlap" };
      },
      createLifecycleHooks: () => ({})
    }
  );

  const firstRun = controller.startRun("mock");
  await controller.startRun("mock");

  assert.ok(
    state.transcript.some(
      (entry) => entry.kind === "status" && entry.content.includes("A run is already active")
    )
  );

  releaseRun?.();
  await firstRun;
});

test("interrupt only signals when a run is active", () => {
  const state = makeState();
  const sentSignals = [];

  const controller = createRunController(
    {
      assetRoot: process.cwd(),
      state,
      requestRender: () => {}
    },
    {
      sendSignal: (pid, signal) => {
        sentSignals.push({ pid, signal });
      }
    }
  );

  controller.interrupt();
  assert.equal(sentSignals.length, 0);

  state.phase = "running";
  controller.interrupt();
  assert.equal(sentSignals.length, 1);
  assert.equal(sentSignals[0].pid, process.pid);
  assert.equal(sentSignals[0].signal, "SIGINT");
});

test("startRun reports EventBus flush failures as warnings", async () => {
  const state = makeState();
  const bus = new EventBus();

  bus.subscribe("run.completed", async () => {
    throw new Error("flush failure");
  });

  const controller = createRunController(
    {
      assetRoot: process.cwd(),
      state,
      requestRender: () => {}
    },
    {
      createBus: () => bus,
      configExists: () => true,
      runMock: async (options) => {
        emitRunStarted(options.bus, "run_flush_warning");
        emitRunCompleted(options.bus, "run_flush_warning");
        return { runDir: "/tmp/runs/run_flush_warning" };
      },
      createLifecycleHooks: () => ({})
    }
  );

  await controller.startRun("mock");

  assert.ok(
    state.warnings.some((warning) =>
      warning.message.includes("event flush error")
    )
  );
});
