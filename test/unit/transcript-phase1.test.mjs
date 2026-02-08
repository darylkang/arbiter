import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import { executeCommandInput, listSlashCommands, parseCommandInput } from "../../dist/ui/transcript/commands/registry.js";
import { renderFooter } from "../../dist/ui/transcript/components/footer.js";
import { renderHeader } from "../../dist/ui/transcript/components/header.js";
import { renderProgressSummary } from "../../dist/ui/transcript/components/progress.js";
import { appendWarningOnce, applyRunEvent, beginRun } from "../../dist/ui/transcript/reducer.js";
import { listRunDirs, resolveRunDirArg } from "../../dist/ui/transcript/run-dirs.js";
import { createInitialState } from "../../dist/ui/transcript/state.js";
import { getBannerLines } from "../../dist/ui/transcript/theme.js";

const ANSI_REGEX = /\u001b\[[0-9;]*m/g;

const stripAnsi = (value) => value.replace(ANSI_REGEX, "");
const normalizePath = (value) => value.replace(/^\/private/, "");

const makeState = () =>
  createInitialState({
    configPath: "/tmp/arbiter.config.json",
    hasApiKey: false,
    hasConfig: false,
    runsCount: 0
  });

test("trial completion accumulates usage and deduplicates model-mismatch warnings", () => {
  const state = makeState();
  beginRun(state, "mock");

  applyRunEvent(state, {
    type: "trial.completed",
    payload: {
      trial_record: {
        trial_id: 0,
        status: "success",
        requested_model_slug: "model/a",
        actual_model: "model/b",
        usage: { prompt_tokens: 11, completion_tokens: 5, total_tokens: 16 },
        attempt: { retry_count: 0, completed_at: "2026-02-08T00:00:00.000Z" },
        calls: []
      }
    }
  });

  applyRunEvent(state, {
    type: "trial.completed",
    payload: {
      trial_record: {
        trial_id: 1,
        status: "success",
        requested_model_slug: "model/a",
        actual_model: "model/b",
        usage: { prompt_tokens: 4, completion_tokens: 2, total_tokens: 6 },
        attempt: { retry_count: 0, completed_at: "2026-02-08T00:00:01.000Z" },
        calls: []
      }
    }
  });

  assert.equal(state.runProgress.attempted, 2);
  assert.equal(state.runProgress.usage.prompt, 15);
  assert.equal(state.runProgress.usage.completion, 7);
  assert.equal(state.runProgress.usage.total, 22);
  assert.equal(state.warnings.length, 1);
  assert.ok(state.warnings[0].message.includes("requested and actual models differ"));
});

test("beginRun resets warning and progress state", () => {
  const state = makeState();
  appendWarningOnce(state, "dup", "warn once", "tests");
  state.runProgress.attempted = 3;
  state.runProgress.eligible = 2;
  state.runProgress.parseFallback = 1;

  beginRun(state, "live");

  assert.equal(state.phase, "running");
  assert.equal(state.runMode, "live");
  assert.equal(state.warningKeys.size, 0);
  assert.equal(state.warnings.length, 0);
  assert.equal(state.runProgress.attempted, 0);
  assert.equal(state.runProgress.eligible, 0);
  assert.equal(state.runProgress.parseFallback, 0);
});

test("parseCommandInput handles edge cases", () => {
  assert.equal(parseCommandInput("plain text"), null);
  assert.equal(parseCommandInput("/"), null);
  assert.equal(parseCommandInput("/   "), null);

  assert.deepEqual(parseCommandInput('/analyze "runs/sample id"'), {
    name: "analyze",
    args: ["runs/sample id"],
    raw: '/analyze "runs/sample id"'
  });

  assert.deepEqual(parseCommandInput("/run mock\\"), {
    name: "run",
    args: ["mock\\"],
    raw: "/run mock\\"
  });
});

test("resolveRunDirArg and listRunDirs follow expected path handling", { concurrency: false }, () => {
  const cwd = process.cwd();
  const root = mkdtempSync(join(tmpdir(), "arbiter-transcript-paths-"));
  const explicitDir = join(root, "custom-dir");
  const runOne = join(root, "runs", "001");
  const runTwo = join(root, "runs", "002");

  mkdirSync(explicitDir, { recursive: true });
  mkdirSync(runOne, { recursive: true });
  mkdirSync(runTwo, { recursive: true });

  process.chdir(root);
  try {
    assert.equal(
      normalizePath(resolveRunDirArg({ lastRunDir: "" }, "./custom-dir")),
      normalizePath(explicitDir)
    );
    assert.equal(
      normalizePath(resolveRunDirArg({ lastRunDir: "" }, "002")),
      normalizePath(runTwo)
    );
    assert.equal(
      normalizePath(resolveRunDirArg({ lastRunDir: runOne })),
      normalizePath(runOne)
    );
    assert.equal(resolveRunDirArg({ lastRunDir: "" }), null);

    assert.deepEqual(
      listRunDirs().map(normalizePath),
      [runTwo, runOne].map(normalizePath)
    );
  } finally {
    process.chdir(cwd);
    rmSync(root, { recursive: true, force: true });
  }
});

test("listRunDirs reports non-ENOENT failures through callback", { concurrency: false }, () => {
  const cwd = process.cwd();
  const root = mkdtempSync(join(tmpdir(), "arbiter-transcript-errors-"));
  const messages = [];

  writeFileSync(join(root, "runs"), "not a directory\n", "utf8");

  process.chdir(root);
  try {
    const dirs = listRunDirs({
      onError: (message) => messages.push(message)
    });
    assert.deepEqual(dirs, []);
    assert.equal(messages.length, 1);
    assert.ok(messages[0].includes("failed to list run directories"));
  } finally {
    process.chdir(cwd);
    rmSync(root, { recursive: true, force: true });
  }
});

test("header/footer adapt to width and warnings", () => {
  const state = makeState();

  const narrowHeader = stripAnsi(renderHeader(state, 40));
  const wideHeader = stripAnsi(renderHeader(state, 80));
  const narrowLines = narrowHeader.split("\n");
  const wideLines = wideHeader.split("\n");

  assert.equal(getBannerLines(59).length, 0);
  assert.equal(getBannerLines(60).length > 0, true);
  assert.equal(narrowLines[narrowLines.length - 1].length, 40);
  assert.equal(wideLines[wideLines.length - 1].length, 78);
  assert.equal(narrowHeader.includes("████"), false);
  assert.equal(wideHeader.includes("████"), true);

  const footerNoWarnings = stripAnsi(renderFooter(state, 80));
  assert.ok(footerNoWarnings.includes("warnings 0"));

  state.warnings.push({ message: "a", recorded_at: "2026-02-08T00:00:00.000Z" });
  state.warnings.push({ message: "b", recorded_at: "2026-02-08T00:00:01.000Z" });
  state.warnings.push({ message: "c", recorded_at: "2026-02-08T00:00:02.000Z" });
  const footerWarnings = stripAnsi(renderFooter(state, 80));
  assert.ok(footerWarnings.includes("warnings 3 (/warnings)"));
});

test("progress summary formats convergence and cost details", () => {
  const state = makeState();
  state.runProgress = {
    active: true,
    planned: 10,
    attempted: 4,
    eligible: 3,
    parseSuccess: 2,
    parseFallback: 1,
    parseFailed: 0,
    currentBatch: { batchNumber: 2, total: 5, completed: 3 },
    recentBatches: [
      {
        batchNumber: 2,
        noveltyRate: 0.12,
        meanMaxSim: 0.34,
        clusterCount: 4
      }
    ],
    noveltyTrend: [0.12],
    usage: {
      prompt: 21,
      completion: 8,
      total: 29,
      cost: 0.5
    }
  };

  const summary = renderProgressSummary(state.runProgress);
  assert.ok(summary.includes("4/10"));
  assert.ok(summary.includes("eligible 3"));
  assert.ok(summary.includes("tokens in 21 out 8 total 29 | cost 0.500000"));
  assert.ok(summary.includes("novelty 0.120 | mean_sim 0.340 | clusters 4"));
});

test("command registry executes all transcript commands and aliases", async () => {
  const events = [];
  const context = {
    state: { ...makeState(), phase: "idle" },
    appendSystem: (message) => events.push(["system", message]),
    appendError: (message) => events.push(["error", message]),
    appendStatus: (message) => events.push(["status", message]),
    requestRender: () => events.push(["render", ""]),
    exit: () => events.push(["exit", ""]),
    startRun: async (mode) => events.push(["run", mode]),
    startNewFlow: () => events.push(["new", ""]),
    showWarnings: async () => events.push(["warnings", ""]),
    showReport: async (runDir) => events.push(["report", runDir ?? ""]),
    showVerify: async (runDir) => events.push(["verify", runDir ?? ""]),
    showReceipt: async (runDir) => events.push(["receipt", runDir ?? ""]),
    analyzeRun: async (runDir) => events.push(["analyze", runDir ?? ""])
  };

  assert.equal(await executeCommandInput({ value: "/new", context }), true);
  assert.equal(await executeCommandInput({ value: "/run", context }), true);
  assert.equal(await executeCommandInput({ value: "/run live", context }), true);
  assert.equal(await executeCommandInput({ value: "/analyze runs/demo", context }), true);
  assert.equal(await executeCommandInput({ value: "/report runs/demo", context }), true);
  assert.equal(await executeCommandInput({ value: "/verify runs/demo", context }), true);
  assert.equal(await executeCommandInput({ value: "/receipt runs/demo", context }), true);
  assert.equal(await executeCommandInput({ value: "/warnings", context }), true);
  assert.equal(await executeCommandInput({ value: "/help", context }), true);
  assert.equal(await executeCommandInput({ value: "/h", context }), true);
  assert.equal(await executeCommandInput({ value: "/warn", context }), true);
  assert.equal(await executeCommandInput({ value: "/q", context }), true);

  assert.deepEqual(events.find((entry) => entry[0] === "new"), ["new", ""]);
  assert.deepEqual(events.find((entry) => entry[0] === "run"), ["run", "mock"]);
  assert.ok(events.some((entry) => entry[0] === "run" && entry[1] === "live"));
  assert.deepEqual(events.find((entry) => entry[0] === "analyze"), ["analyze", "runs/demo"]);
  assert.deepEqual(events.find((entry) => entry[0] === "report"), ["report", "runs/demo"]);
  assert.deepEqual(events.find((entry) => entry[0] === "verify"), ["verify", "runs/demo"]);
  assert.deepEqual(events.find((entry) => entry[0] === "receipt"), ["receipt", "runs/demo"]);
  assert.ok(events.some((entry) => entry[0] === "warnings"));
  assert.ok(events.some((entry) => entry[0] === "system" && String(entry[1]).includes("commands:")));
  assert.ok(events.some((entry) => entry[0] === "exit"));

  context.state.phase = "running";
  events.length = 0;
  assert.equal(await executeCommandInput({ value: "/quit", context }), true);
  assert.equal(events.some((entry) => entry[0] === "exit"), false);
  assert.ok(events.some((entry) => entry[0] === "system" && String(entry[1]).includes("run in progress")));
});

test("slash command list includes command aliases", () => {
  const slash = listSlashCommands();
  const names = slash.map((item) => item.name);
  assert.ok(names.includes("help"));
  assert.ok(names.includes("h"));
  assert.ok(names.includes("warnings"));
  assert.ok(names.includes("warn"));
  assert.ok(names.includes("quit"));
  assert.ok(names.includes("q"));
});
