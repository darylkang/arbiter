import assert from "node:assert/strict";
import test from "node:test";

import { createPlainFormatter } from "../../src/ui/fmt.ts";
import {
  renderBrandBlock,
  renderRuledSection,
  renderWorkerRow
} from "../../src/ui/wizard-theme.ts";
import { buildWizardFrameText } from "../../src/ui/wizard/frame-manager.ts";
import {
  buildReceiptDisplayText,
  buildRunDashboardText
} from "../../src/ui/run-lifecycle-hooks.ts";

test("renderBrandBlock uses the provided width instead of terminal globals", () => {
  const fmt = createPlainFormatter({ columns: 120 });
  const text = renderBrandBlock("0.1.0", false, "mock", 2, 72, fmt);

  assert.equal(
    text,
    [
      "A R B I T E R                                                     v0.1.0",
      "Distributional reasoning harness",
      "",
      "API key:   not detected",
      "Run mode:  Mock",
      "Configs:   2 in current directory"
    ].join("\n")
  );
});

test("renderRuledSection and renderWorkerRow produce stable plain fixtures", () => {
  const fmt = createPlainFormatter({ columns: 80 });

  assert.equal(
    renderRuledSection("monitoring", 40, fmt),
    "── MONITORING ──────────────────────────"
  );

  assert.equal(
    renderWorkerRow(
      {
        id: 2,
        state: "idle",
        trialId: undefined,
        model: "—",
        tick: 1
      },
      fmt,
      80
    ),
    "W2  ⠙░░░░░░░░░  idle      trial —    —"
  );
});

test("Stage 1 frame builder has a deterministic plain-text fixture", () => {
  const fmt = createPlainFormatter({ columns: 80 });

  const text = buildWizardFrameText(
    {
      version: "0.1.0",
      currentRailIndex: 2,
      completedUntilRailIndex: 1,
      runMode: "mock",
      apiKeyPresent: false,
      configCount: 2,
      contextLabel: "setup / question",
      showRunMode: true,
      activeLabel: "Research Question",
      activeLines: ["Research Question", "", "What pattern matters?", "", "(start typing)"],
      footerText: "Enter submit · Esc back",
      stepSummaries: {
        0: "Create new study",
        1: "Mock"
      }
    },
    fmt,
    80
  );

  assert.equal(
    text,
    [
      "› arbiter  setup / question                                                00:00",
      "────────────────────────────────────────────────────────────────────────────────",
      "",
      "A R B I T E R                                                             v0.1.0",
      "Distributional reasoning harness",
      "",
      "API key:   not detected",
      "Run mode:  Mock",
      "Configs:   2 in current directory",
      "",
      "✔  Entry Path         Create new study",
      "✔  Run Mode           Mock",
      "◆  Research Question",
      "│",
      "│   Research Question",
      "│",
      "│   What pattern matters?",
      "│",
      "│   (start typing)",
      "│",
      "◇  Protocol",
      "◇  Models",
      "◇  Personas",
      "◇  Decode Params",
      "◇  Advanced Settings",
      "◇  Review and Confirm",
      "",
      "────────────────────────────────────────────────────────────────────────────────",
      "Enter submit · Esc back"
    ].join("\n")
  );
});

test("Stage 2 dashboard builder has a deterministic plain-text fixture", () => {
  const fmt = createPlainFormatter({ columns: 80 });

  const text = buildRunDashboardText(
    {
      statusContext: "run / monitoring",
      elapsedMs: 65_000,
      progressLabel: "Trials: 2/8 · Workers: 2",
      progressPct: 25,
      eta: "00:03:00",
      monitoringRows: [
        { key: "Novelty rate", value: "0.180 (threshold 0.050)" },
        { key: "Patience", value: "2/4" },
        { key: "Status", value: "sampling continues" }
      ],
      caveatLines: [{ text: "Stopping indicates diminishing novelty, not correctness.", tone: "muted" }],
      workerRows: [
        { id: 1, state: "running", trialId: 2, model: "GPT-5", tick: 1 },
        { id: 2, state: "idle", trialId: undefined, model: "—", tick: 1 }
      ],
      usageLines: [{ text: "Usage so far: 1200 tokens (in 700, out 500)", tone: "text" }],
      footerText: "Ctrl+C graceful stop"
    },
    { width: 80, fmt }
  );

  assert.equal(
    text,
    [
      "› arbiter  run / monitoring                                                01:05",
      "────────────────────────────────────────────────────────────────────────────────",
      "",
      "── PROGRESS ────────────────────────────────────────────────────────────────────",
      "",
      "Trials: 2/8 · Workers: 2",
      "███████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   25%    00:01:05  ETA 00:03:00",
      "",
      "── MONITORING ──────────────────────────────────────────────────────────────────",
      "",
      "Novelty rate    0.180 (threshold 0.050)",
      "Patience        2/4",
      "Status          sampling continues",
      "",
      "Stopping indicates diminishing novelty, not correctness.",
      "",
      "── WORKERS ─────────────────────────────────────────────────────────────────────",
      "",
      "ID  Activity      State     Trial     Model",
      "W1  ░███░░░░░░  running   trial 2    GPT-5",
      "W2  ⠙░░░░░░░░░  idle      trial —    —",
      "",
      "── USAGE ───────────────────────────────────────────────────────────────────────",
      "",
      "Usage so far: 1200 tokens (in 700, out 500)",
      "",
      "────────────────────────────────────────────────────────────────────────────────",
      "Ctrl+C graceful stop",
      ""
    ].join("\n")
  );
});

test("Stage 3 receipt builder has a deterministic plain-text fixture", () => {
  const fmt = createPlainFormatter({ columns: 80 });

  const text = buildReceiptDisplayText(
    {
      statusContext: "run / receipt",
      stopBanner: "Stopped: novelty saturation",
      caveatLines: [{ text: "Stopping indicates diminishing novelty, not correctness.", tone: "muted" }],
      summaryRows: [
        { key: "Stop reason", value: "novelty saturation" },
        { key: "Trials", value: "8 / 8 / 8 (planned / completed / eligible)" },
        { key: "Duration", value: "00:04:12" }
      ],
      groupLines: [
        { text: "Embedding groups: 3", tone: "text" },
        { text: "Groups reflect embedding similarity, not semantic categories.", tone: "muted" }
      ],
      artifactRows: ["Only generated files are listed.", "config.resolved.json    manifest.json"],
      reproduceCommand: "arbiter run --config runs/example/config.resolved.json",
      footerText: "Run complete."
    },
    { width: 80, fmt }
  );

  assert.equal(
    text,
    [
      "› arbiter  run / receipt                                                   00:00",
      "────────────────────────────────────────────────────────────────────────────────",
      "",
      "── RECEIPT ─────────────────────────────────────────────────────────────────────",
      "",
      "Stopped: novelty saturation",
      "Stopping indicates diminishing novelty, not correctness.",
      "",
      "── SUMMARY ─────────────────────────────────────────────────────────────────────",
      "",
      "Stop reason     novelty saturation",
      "Trials          8 / 8 / 8 (planned / completed / eligible)",
      "Duration        00:04:12",
      "",
      "── GROUPS ──────────────────────────────────────────────────────────────────────",
      "",
      "Embedding groups: 3",
      "Groups reflect embedding similarity, not semantic categories.",
      "",
      "── ARTIFACTS ───────────────────────────────────────────────────────────────────",
      "",
      "Only generated files are listed.",
      "config.resolved.json    manifest.json",
      "",
      "── REPRODUCE ───────────────────────────────────────────────────────────────────",
      "",
      "arbiter run --config runs/example/config.resolved.json",
      "",
      "────────────────────────────────────────────────────────────────────────────────",
      "Run complete.",
      ""
    ].join("\n")
  );
});
