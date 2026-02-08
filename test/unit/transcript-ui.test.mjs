import assert from "node:assert/strict";
import test from "node:test";

import { beginRun, applyRunEvent, appendTranscript } from "../../dist/ui/transcript/reducer.js";
import { createInitialState } from "../../dist/ui/transcript/state.js";
import { createIntakeFlowController } from "../../dist/ui/transcript/intake-flow.js";

const makeState = () =>
  createInitialState({
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
      resolved_config: { protocol: { type: "independent" } },
      debug_enabled: false,
      k_planned: 3
    }
  });
  assert.equal(state.runProgress.active, true);
  assert.equal(state.runProgress.planned, 3);

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

test("intake flow opens overlays, handles cancel, and starts selected run mode", async () => {
  const state = makeState();
  const logs = [];
  const writes = [];
  const runs = [];

  const intake = createIntakeFlowController({
    state,
    requestRender: () => logs.push("render"),
    appendSystem: (message) => logs.push(`system:${message}`),
    appendStatus: (message) => logs.push(`status:${message}`),
    appendError: (message) => logs.push(`error:${message}`),
    appendWarning: (message) => logs.push(`warning:${message}`),
    writeTemplateConfig: (profile, question) => writes.push({ profile: profile.id, question }),
    startRun: async (mode) => {
      runs.push(mode);
    }
  });

  intake.startNewFlow();
  assert.equal(state.phase, "intake");
  assert.equal(state.newFlow?.stage, "await_question");

  intake.handlePlainInput("How do we test this?");
  assert.equal(state.newFlow?.stage, "select_profile");
  assert.equal(state.overlay?.kind, "select");
  assert.equal(state.overlay?.title, "select profile");

  state.overlay?.onCancel();
  assert.equal(state.phase, "idle");
  assert.equal(state.newFlow, null);

  intake.startNewFlow();
  intake.handlePlainInput("How do we test this?");
  assert.equal(state.overlay?.kind, "select");
  state.overlay?.onSelect({ id: "quickstart", label: "quickstart" });

  assert.equal(state.overlay?.kind, "select");
  assert.equal(state.overlay?.title, "select run mode");
  state.overlay?.onSelect({ id: "mock", label: "run mock now" });

  assert.deepEqual(writes, [{ profile: "quickstart", question: "How do we test this?" }]);
  assert.deepEqual(runs, ["mock"]);
  assert.equal(state.phase, "idle");
});

test("intake flow rejects invalid profile and run-mode selections", () => {
  const state = makeState();
  const errors = [];

  const intake = createIntakeFlowController({
    state,
    requestRender: () => {},
    appendSystem: () => {},
    appendStatus: () => {},
    appendError: (message) => errors.push(message),
    appendWarning: () => {},
    writeTemplateConfig: () => {},
    startRun: async () => {}
  });

  intake.startNewFlow();
  intake.handlePlainInput("Question?");
  state.overlay?.onSelect({ id: "not-a-profile", label: "invalid" });

  assert.equal(state.phase, "idle");
  assert.equal(state.newFlow, null);
  assert.ok(errors.some((error) => error.includes("invalid profile selection")));

  intake.startNewFlow();
  intake.handlePlainInput("Question?");
  state.overlay?.onSelect({ id: "quickstart", label: "quickstart" });
  state.overlay?.onSelect({ id: "not-a-mode", label: "invalid" });

  assert.equal(state.phase, "idle");
  assert.equal(state.newFlow, null);
  assert.ok(errors.some((error) => error.includes("invalid run mode selection")));
});

test("intake flow blocks re-entry while already active", () => {
  const state = makeState();
  const statuses = [];

  const intake = createIntakeFlowController({
    state,
    requestRender: () => {},
    appendSystem: () => {},
    appendStatus: (message) => statuses.push(message),
    appendError: () => {},
    appendWarning: () => {},
    writeTemplateConfig: () => {},
    startRun: async () => {}
  });

  intake.startNewFlow();
  intake.startNewFlow();

  assert.equal(state.phase, "intake");
  assert.equal(state.newFlow?.stage, "await_question");
  assert.ok(statuses.some((status) => status.includes("intake already active")));
});
