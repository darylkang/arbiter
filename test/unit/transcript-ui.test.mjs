import assert from "node:assert/strict";
import test from "node:test";

import { beginRun, applyRunEvent, appendTranscript } from "../../dist/ui/transcript/reducer.js";
import { createInitialState } from "../../dist/ui/transcript/state.js";
import { createIntakeFlowController } from "../../dist/ui/transcript/intake-flow.js";

const wizardOptions = {
  personas: [
    { id: "persona_neutral", label: "Neutral", description: "neutral" },
    { id: "persona_skeptical", label: "Skeptical", description: "skeptical" }
  ],
  models: [
    { slug: "openai/gpt-4o-mini-2024-07-18", label: "GPT-4o Mini", description: "baseline" },
    { slug: "anthropic/claude-sonnet-4", label: "Claude Sonnet 4", description: "reasoning" }
  ],
  decodePresets: [
    {
      id: "balanced",
      label: "Balanced",
      description: "balanced",
      temperature: 0.7,
      topP: 0.95,
      maxTokens: 512,
      seed: 424242
    }
  ],
  advancedPresets: [
    {
      id: "standard",
      label: "Standard",
      description: "standard",
      kMax: 20,
      workers: 4,
      batchSize: 2
    }
  ],
  protocols: [
    { id: "independent", label: "Independent", description: "single-pass" },
    { id: "debate_v1", label: "Debate", description: "proposer-critic" }
  ]
};

const makeState = () =>
  createInitialState({
    version: "0.1.0-test",
    configPath: "/tmp/arbiter.config.json",
    hasApiKey: false,
    hasConfig: false,
    runsCount: 0
  });

test("transcript run state transitions to post-run on completion and failure", () => {
  const state = makeState();

  beginRun(state, "mock");
  assert.equal(state.phase, "running");
  assert.equal(state.runMode, "mock");

  applyRunEvent(state, {
    type: "run.started",
    payload: {
      run_id: "run_1",
      started_at: "2026-02-08T00:00:00.000Z",
      resolved_config: { protocol: { type: "independent" }, execution: { workers: 3 } },
      debug_enabled: false,
      k_planned: 3
    }
  });
  assert.equal(state.runProgress.active, true);
  assert.equal(state.runProgress.planned, 3);
  assert.equal(state.runProgress.workerCount, 3);
  assert.deepEqual(state.runProgress.workerStatus, {
    1: { status: "idle" },
    2: { status: "idle" },
    3: { status: "idle" }
  });

  applyRunEvent(state, {
    type: "worker.status",
    payload: {
      batch_number: 0,
      worker_id: 2,
      status: "busy",
      trial_id: 9,
      updated_at: "2026-02-08T00:00:02.000Z"
    }
  });
  assert.deepEqual(state.runProgress.workerStatus[2], { status: "busy", trialId: 9 });

  applyRunEvent(state, {
    type: "run.completed",
    payload: {
      run_id: "run_1",
      completed_at: "2026-02-08T00:01:00.000Z",
      stop_reason: "completed",
      incomplete: false
    }
  });

  assert.equal(state.phase, "post-run");
  assert.equal(state.runProgress.active, false);
  assert.deepEqual(state.runProgress.workerStatus[2], { status: "idle" });

  beginRun(state, "mock");
  applyRunEvent(state, {
    type: "run.failed",
    payload: {
      run_id: "run_2",
      completed_at: "2026-02-08T00:02:00.000Z",
      error: "boom"
    }
  });
  assert.equal(state.phase, "post-run");
  assert.equal(state.runProgress.active, false);
});

test("appendTranscript keeps bounded transcript history", () => {
  const state = makeState();

  for (let i = 1; i <= 1005; i += 1) {
    appendTranscript(state, "status", `entry-${i}`, "2026-02-08T00:00:00.000Z");
  }

  assert.equal(state.transcript.length, 1000);
  assert.equal(state.transcript[0].id, "entry-6");
  assert.equal(state.transcript.at(-1)?.id, "entry-1005");
});

test("applyRunEvent throws on unknown event type", () => {
  const state = makeState();

  assert.throws(
    () => {
      applyRunEvent(state, /** @type {any} */ ({ type: "unknown.event", payload: {} }));
    },
    /Unhandled event type/
  );
});

test("intake flow follows guided setup and starts mock run", async () => {
  const state = makeState();
  const logs = [];
  const writes = [];
  const runs = [];
  let inputValue = "";

  const intake = createIntakeFlowController({
    state,
    wizardOptions,
    requestRender: () => logs.push("render"),
    appendSystem: (message) => logs.push(`system:${message}`),
    appendStatus: (message) => logs.push(`status:${message}`),
    appendError: (message) => logs.push(`error:${message}`),
    appendWarning: (message) => logs.push(`warning:${message}`),
    appendSummary: (message) => logs.push(`summary:${message}`),
    writeGuidedConfig: (flow) => writes.push(flow),
    startRun: async (mode) => {
      runs.push(mode);
    },
    setInputText: (value) => {
      inputValue = value;
    }
  });

  intake.startNewFlow("mock");
  assert.equal(state.phase, "intake");
  assert.equal(state.newFlow?.stage, "question");
  assert.equal(inputValue, "");

  intake.handlePlainInput("How do we test this guided flow?");
  assert.equal(state.newFlow?.stage, "labels");
  assert.equal(state.overlay?.kind, "select");
  state.overlay?.onSelect({ id: "free-form", label: "Free-form responses" });

  assert.equal(state.newFlow?.stage, "decode");
  assert.equal(state.overlay?.kind, "select");
  state.overlay?.onSelect({ id: "balanced", label: "balanced" });

  assert.equal(state.newFlow?.stage, "personas");
  assert.equal(state.overlay?.kind, "checklist");
  state.overlay?.onConfirm(["persona_neutral"]);

  assert.equal(state.newFlow?.stage, "models");
  assert.equal(state.overlay?.kind, "checklist");
  state.overlay?.onConfirm(["openai/gpt-4o-mini-2024-07-18"]);

  assert.equal(state.newFlow?.stage, "protocol");
  assert.equal(state.overlay?.kind, "select");
  state.overlay?.onSelect({ id: "independent", label: "Independent" });

  assert.equal(state.newFlow?.stage, "advanced");
  assert.equal(state.overlay?.kind, "select");
  state.overlay?.onSelect({ id: "standard", label: "Standard" });

  assert.equal(state.newFlow?.stage, "mode");
  assert.equal(state.overlay?.kind, "select");
  state.overlay?.onSelect({ id: "mock", label: "mock" });

  assert.equal(state.newFlow?.stage, "review");
  assert.equal(state.overlay?.kind, "select");
  state.overlay?.onSelect({ id: "start", label: "Start" });

  assert.equal(writes.length, 1);
  assert.deepEqual(runs, ["mock"]);
  assert.equal(state.phase, "idle");
  assert.equal(state.newFlow, null);
});

test("intake flow back-navigation preserves question text", () => {
  const state = makeState();
  let inputValue = "";

  const intake = createIntakeFlowController({
    state,
    wizardOptions,
    requestRender: () => {},
    appendSystem: () => {},
    appendStatus: () => {},
    appendError: () => {},
    appendWarning: () => {},
    appendSummary: () => {},
    writeGuidedConfig: () => {},
    startRun: async () => {},
    setInputText: (value) => {
      inputValue = value;
    }
  });

  intake.startNewFlow();
  intake.handlePlainInput("How do we test this?");
  state.overlay?.onCancel();
  assert.equal(state.newFlow?.stage, "question");
  assert.equal(inputValue, "How do we test this?");

  intake.handlePlainInput("How do we test this?");
  assert.equal(state.newFlow?.stage, "labels");
  assert.equal(state.overlay?.kind, "select");
  state.overlay?.onSelect({ id: "free-form", label: "Free-form responses" });

  state.overlay?.onSelect({ id: "balanced", label: "Balanced" });
  assert.equal(state.newFlow?.stage, "personas");
  state.overlay?.onCancel();
  assert.equal(state.newFlow?.stage, "decode");
  assert.equal(state.overlay?.kind, "select");
});

test("intake flow enforces question validation", () => {
  const state = makeState();
  const errors = [];

  const intake = createIntakeFlowController({
    state,
    wizardOptions,
    requestRender: () => {},
    appendSystem: () => {},
    appendStatus: () => {},
    appendError: (message) => errors.push(message),
    appendWarning: () => {},
    appendSummary: () => {},
    writeGuidedConfig: () => {},
    startRun: async () => {},
    setInputText: () => {}
  });

  intake.startNewFlow();
  intake.handlePlainInput("   ");
  assert.equal(state.newFlow?.stage, "question");
  assert.equal(state.overlay, null);
  assert.ok(errors.some((error) => error.includes("at least one non-space character")));

  intake.handlePlainInput("A".repeat(501));
  assert.equal(state.newFlow?.stage, "question");
  assert.equal(state.overlay, null);
  assert.ok(errors.some((error) => error.includes("max 500 characters")));

  intake.handlePlainInput("short");
  assert.equal(state.newFlow?.stage, "labels");
});

test("intake flow supports custom label entry and deduplicates labels", () => {
  const state = makeState();
  const statuses = [];
  let inputValue = "";

  const intake = createIntakeFlowController({
    state,
    wizardOptions,
    requestRender: () => {},
    appendSystem: () => {},
    appendStatus: (message) => statuses.push(message),
    appendError: () => {},
    appendWarning: () => {},
    appendSummary: () => {},
    writeGuidedConfig: () => {},
    startRun: async () => {},
    setInputText: (value) => {
      inputValue = value;
    }
  });

  intake.startNewFlow();
  intake.handlePlainInput("How do we test custom labels?");
  assert.equal(state.newFlow?.stage, "labels");
  assert.equal(state.overlay?.kind, "select");
  state.overlay?.onSelect({ id: "custom", label: "Define labels" });

  assert.equal(state.newFlow?.stage, "labels");
  assert.equal(state.overlay, null);
  assert.equal(inputValue, "");

  intake.handlePlainInput("yes, no, YES,  no ");
  assert.equal(state.newFlow?.stage, "decode");
  assert.equal(state.overlay?.kind, "select");
  assert.deepEqual(state.newFlow?.labels, ["yes", "no"]);
  assert.ok(statuses.some((status) => status.includes("Labels recorded: yes, no")));
});

test("intake flow asks for confirmation when restarting an active setup", () => {
  const state = makeState();
  const statuses = [];

  const intake = createIntakeFlowController({
    state,
    wizardOptions,
    requestRender: () => {},
    appendSystem: () => {},
    appendStatus: (message) => statuses.push(message),
    appendError: () => {},
    appendWarning: () => {},
    appendSummary: () => {},
    writeGuidedConfig: () => {},
    startRun: async () => {},
    setInputText: () => {}
  });

  intake.startNewFlow();
  intake.handlePlainInput("How do we test this?");
  intake.startNewFlow();

  assert.equal(state.phase, "intake");
  assert.equal(state.overlay?.kind, "confirm");
  assert.equal(state.overlay?.title, "Discard current setup?");
  state.overlay?.onCancel();
  assert.ok(statuses.some((status) => status.includes("Resuming current setup")));
});

test("intake flow save-only mode writes config without starting a run", async () => {
  const state = makeState();
  const statuses = [];
  const writes = [];
  const runs = [];

  const intake = createIntakeFlowController({
    state,
    wizardOptions,
    requestRender: () => {},
    appendSystem: () => {},
    appendStatus: (message) => statuses.push(message),
    appendError: () => {},
    appendWarning: () => {},
    appendSummary: () => {},
    writeGuidedConfig: (flow) => writes.push(flow),
    startRun: async (mode) => {
      runs.push(mode);
    },
    setInputText: () => {}
  });

  intake.startNewFlow();
  intake.handlePlainInput("How do we test save-only mode?");
  state.overlay?.onSelect({ id: "free-form", label: "Free-form responses" });
  state.overlay?.onSelect({ id: "balanced", label: "Balanced" });
  state.overlay?.onConfirm(["persona_neutral"]);
  state.overlay?.onConfirm(["openai/gpt-4o-mini-2024-07-18"]);
  state.overlay?.onSelect({ id: "independent", label: "Independent" });
  state.overlay?.onSelect({ id: "standard", label: "Standard" });
  state.overlay?.onSelect({ id: "save-only", label: "Save only" });
  state.overlay?.onSelect({ id: "start", label: "Start" });

  assert.equal(writes.length, 1);
  assert.deepEqual(runs, []);
  assert.equal(state.phase, "idle");
  assert.equal(state.newFlow, null);
  assert.ok(statuses.some((status) => status.includes("Setup complete. Choose the next action")));
});

test("intake flow cancels setup when writing guided config fails", async () => {
  const state = makeState();
  const errors = [];
  const statuses = [];
  const runs = [];

  const intake = createIntakeFlowController({
    state,
    wizardOptions,
    requestRender: () => {},
    appendSystem: () => {},
    appendStatus: (message) => statuses.push(message),
    appendError: (message) => errors.push(message),
    appendWarning: () => {},
    appendSummary: () => {},
    writeGuidedConfig: () => {
      throw new Error("disk full");
    },
    startRun: async (mode) => {
      runs.push(mode);
    },
    setInputText: () => {}
  });

  intake.startNewFlow();
  intake.handlePlainInput("How do we test write failures?");
  state.overlay?.onSelect({ id: "free-form", label: "Free-form responses" });
  state.overlay?.onSelect({ id: "balanced", label: "Balanced" });
  state.overlay?.onConfirm(["persona_neutral"]);
  state.overlay?.onConfirm(["openai/gpt-4o-mini-2024-07-18"]);
  state.overlay?.onSelect({ id: "independent", label: "Independent" });
  state.overlay?.onSelect({ id: "standard", label: "Standard" });
  state.overlay?.onSelect({ id: "mock", label: "Run mock now" });
  state.overlay?.onSelect({ id: "start", label: "Start" });

  assert.equal(state.phase, "idle");
  assert.equal(state.newFlow, null);
  assert.deepEqual(runs, []);
  assert.ok(errors.some((message) => message.includes("Failed to write configuration")));
  assert.ok(statuses.some((message) => message.includes("Setup cancelled")));
});

test("intake flow escape cancels from question step", () => {
  const state = makeState();
  let inputValue = "";

  const intake = createIntakeFlowController({
    state,
    wizardOptions,
    requestRender: () => {},
    appendSystem: () => {},
    appendStatus: () => {},
    appendError: () => {},
    appendWarning: () => {},
    appendSummary: () => {},
    writeGuidedConfig: () => {},
    startRun: async () => {},
    setInputText: (value) => {
      inputValue = value;
    }
  });

  intake.startNewFlow();
  intake.handlePlainInput("How do we test this?");
  state.overlay?.onCancel();
  assert.equal(state.newFlow?.stage, "question");
  assert.equal(inputValue, "How do we test this?");

  assert.equal(intake.handleEscape(), true);
  assert.equal(state.newFlow, null);
  assert.equal(state.phase, "idle");
});
