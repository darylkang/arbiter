import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import pty from "@homebridge/node-pty-prebuilt-multiarch";
import { renderFinalNormalScreenText } from "../../scripts/tui-visual-capture.mjs";

const REPO_ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const CLI_ENTRY = resolve(REPO_ROOT, "dist/cli/index.js");
const ANSI_CSI_REGEX = /\u001b\[[0-9;?]*[ -/]*[@-~]/g;
const ANSI_OSC_REGEX = /\u001b\][^\u0007]*\u0007/g;

assert.equal(
  existsSync(CLI_ENTRY),
  true,
  "expected dist/cli/index.js to exist; run npm run build before PTY tests"
);

const stripAnsi = (value) =>
  value
    .replace(ANSI_OSC_REGEX, "")
    .replace(ANSI_CSI_REGEX, "")
    .replace(/\r/g, "");

const withTimeout = async (promise, timeoutMs, label) => {
  let timeoutId = null;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};

const createMockConfig = (cwd, overrides = {}) => {
  const initResult = spawnSync("node", [CLI_ENTRY, "init"], {
    cwd,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env }
  });
  assert.equal(initResult.status, 0, `arbiter init failed: ${initResult.stderr?.toString("utf8") ?? ""}`);

  const configPath = join(cwd, "arbiter.config.json");
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  config.execution.k_max = 2;
  config.execution.k_min = 0;
  config.execution.batch_size = 1;
  config.execution.workers = 1;
  config.question.text = "Wizard e2e question";
  config.question.question_id = "wizard_e2e_q1";
  config.measurement.clustering.enabled = false;
  Object.assign(config.execution, overrides.execution ?? {});
  if (overrides.question) {
    Object.assign(config.question, overrides.question);
  }
  if (overrides.measurement?.clustering) {
    Object.assign(config.measurement.clustering, overrides.measurement.clustering);
  }
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
};

const REQUIRED_EXECUTED_RUN_ARTIFACTS = [
  "config.source.json",
  "config.resolved.json",
  "manifest.json",
  "trial_plan.jsonl",
  "trials.jsonl",
  "monitoring.jsonl",
  "receipt.txt"
];

const assertRunArtifacts = (cwd, runDirName) => {
  const runDir = join(cwd, "runs", runDirName);
  for (const artifact of REQUIRED_EXECUTED_RUN_ARTIFACTS) {
    assert.equal(
      existsSync(join(runDir, artifact)),
      true,
      `expected artifact ${artifact} in ${runDir}`
    );
  }
  assert.equal(
    existsSync(join(runDir, "parsed.jsonl")),
    false,
    "legacy parsed.jsonl should not be produced"
  );
  assert.equal(
    existsSync(join(runDir, "convergence_trace.jsonl")),
    false,
    "legacy convergence_trace.jsonl should not be produced"
  );
};

const createPtySession = (input) => {
  const proc = pty.spawn("node", [CLI_ENTRY, ...(input.args ?? [])], {
    name: "xterm-256color",
    cols: input.cols ?? 120,
    rows: input.rows ?? 40,
    cwd: input.cwd,
    env: {
      ...process.env,
      ...(input.env ?? {})
    }
  });

  let output = "";
  const exitPromise = new Promise((resolveExit) => {
    proc.onExit(resolveExit);
  });

  proc.onData((data) => {
    output += data;
  });

  const waitForText = (text, timeoutMs = 25000) =>
    new Promise((resolveText, rejectText) => {
      const deadline = Date.now() + timeoutMs;
      const poll = setInterval(() => {
        const current = stripAnsi(output);
        if (current.includes(text)) {
          clearInterval(poll);
          resolveText(true);
          return;
        }
        if (Date.now() >= deadline) {
          clearInterval(poll);
          const tail = current.slice(-1200);
          rejectText(
            new Error(
              `waitForText(${text}) timed out after ${timeoutMs}ms\n--- output tail ---\n${tail}\n--- end tail ---`
            )
          );
        }
      }, 25);
    });

  const pressEnter = () => {
    proc.write("\r");
  };

  const typeText = (text) => {
    proc.write(text);
  };

  const arrowDown = (count = 1) => {
    for (let index = 0; index < count; index += 1) {
      proc.write("\u001b[B");
    }
  };

  const escape = () => {
    proc.write("\u001b");
  };

  const waitForExit = async (timeoutMs = 30000) => withTimeout(exitPromise, timeoutMs, "waitForExit");

  const stop = async () => {
    try {
      proc.kill();
    } catch {
      // Process may already be terminated.
    }
    await withTimeout(exitPromise, 2000, "stopExit").catch(() => {});
  };

  return {
    waitForText,
    pressEnter,
    typeText,
    arrowDown,
    escape,
    resize: (cols, rows) => proc.resize(cols, rows),
    waitForExit,
    stop,
    getRawOutput: () => output,
    getOutput: () => stripAnsi(output)
  };
};

test("pty: wizard launches in TTY and exits cleanly from Step 0", { concurrency: false }, async () => {
  const cwd = mkdtempSync(join(tmpdir(), "arbiter-tui-e2e-exit-"));
  const session = createPtySession({ cwd });

  try {
    await session.waitForText("ARBITER", 25000);
    await session.waitForText("Choose how to start", 25000);
    await session.waitForText("Run existing config", 25000);
    await session.waitForText("Create new study (guided wizard)", 25000);
    session.escape();
    const exit = await session.waitForExit(25000);
    assert.equal(exit.exitCode, 0);
    assert.ok(session.getOutput().includes("Wizard exited."));
  } finally {
    await session.stop();
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("pty: wizard exits early with a clear resize message on undersized terminals", { concurrency: false }, async () => {
  const cwd = mkdtempSync(join(tmpdir(), "arbiter-tui-e2e-small-"));
  const session = createPtySession({ cwd, cols: 50, rows: 24 });

  try {
    await session.waitForText(
      "Interactive wizard requires at least 60 columns x 18 rows. Resize the terminal and try again.",
      25000
    );
    const exit = await session.waitForExit(25000);
    assert.equal(exit.exitCode, 0);
  } finally {
    await session.stop();
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("pty: run-existing mock path reaches RUN and RECEIPT then auto-exits", { concurrency: false }, async () => {
  const cwd = mkdtempSync(join(tmpdir(), "arbiter-tui-e2e-existing-"));
  createMockConfig(cwd);
  const session = createPtySession({ cwd });

  try {
    await session.waitForText("Choose how to start", 25000);
    session.pressEnter();

    await session.waitForText("Choose run mode", 25000);
    session.arrowDown(1);
    session.pressEnter();

    await session.waitForText("Review and Confirm", 25000);
    session.pressEnter();

    await session.waitForText("◆  Entry Path", 45000);
    await session.waitForText("▍ RUN", 45000);
    await session.waitForText("── PROGRESS", 45000);
    await session.waitForText("Mock mode: usage and cost are not tracked.", 45000);
    await session.waitForText("▍ RECEIPT", 45000);
    await session.waitForText("Stopped:", 45000);

    const exit = await session.waitForExit(45000);
    assert.equal(exit.exitCode, 0);

    const runDirs = readdirSync(join(cwd, "runs"), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    assert.ok(runDirs.length >= 1, "expected at least one run directory");
    const latestRunDir = runDirs.at(-1);
    assert.ok(latestRunDir);
    assertRunArtifacts(cwd, latestRunDir);
    const receiptArtifact = readFileSync(join(cwd, "runs", latestRunDir, "receipt.txt"), "utf8");
    assert.equal(ANSI_CSI_REGEX.test(receiptArtifact), false, "receipt.txt must remain ANSI-free");
    assert.equal(ANSI_OSC_REGEX.test(receiptArtifact), false, "receipt.txt must remain ANSI-free");

    const output = session.getOutput();
    const finalTranscript = await renderFinalNormalScreenText(session.getRawOutput());
    const mastheadIndex = output.indexOf("ARBITER");
    const summaryIndex = output.indexOf("◆  Entry Path");
    const runIndex = output.indexOf("▍ RUN");
    const receiptIndex = output.indexOf("▍ RECEIPT");
    assert.ok(mastheadIndex >= 0, "expected Stage 0 masthead in output");
    assert.ok(summaryIndex > mastheadIndex, "expected Stage 1 frozen rail after masthead");
    assert.ok(runIndex > summaryIndex, "expected Stage 2 run dashboard after Stage 1 summary");
    assert.ok(receiptIndex > runIndex, "expected Stage 3 receipt after Stage 2 output");
    assert.equal(
      output.includes("Choose the next action"),
      false,
      "stage 3 should auto-exit with no next-action menu"
    );
    assert.equal((finalTranscript.match(/▍ RUN/g) || []).length, 1);
    assert.equal((finalTranscript.match(/── PROGRESS/g) || []).length, 1);
    assert.equal((finalTranscript.match(/▍ RECEIPT/g) || []).length, 1);
    assert.equal((finalTranscript.match(/▍ SETUP/g) || []).length, 1);
    assert.equal((finalTranscript.match(/ARBITER/g) || []).length, 1);
    assert.equal((finalTranscript.match(/◆  Entry Path/g) || []).length, 1);
  } finally {
    await session.stop();
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("pty: wizard remains usable at the minimum supported terminal size", { concurrency: false }, async () => {
  const cwd = mkdtempSync(join(tmpdir(), "arbiter-tui-e2e-min-size-"));
  const session = createPtySession({ cwd, cols: 60, rows: 18 });

  try {
    await session.waitForText("Choose how to start", 25000);
    session.pressEnter();

    await session.waitForText("Choose run mode", 25000);
    session.pressEnter();

    await session.waitForText("Research Question", 25000);
    session.typeText("Minimum size path");
    session.pressEnter();

    await session.waitForText("▸  Protocol", 25000);
  } finally {
    await session.stop();
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("pty: create-new path submits Step 1 question with Enter", { concurrency: false }, async () => {
  const cwd = mkdtempSync(join(tmpdir(), "arbiter-tui-e2e-question-submit-"));
  const session = createPtySession({ cwd });

  try {
    await session.waitForText("Choose how to start", 25000);
    await session.waitForText("Create new study (guided wizard)", 25000);
    session.pressEnter();

    await session.waitForText("Choose run mode", 25000);
    await session.waitForText("Mock (no API calls)", 25000);
    session.pressEnter();

    await session.waitForText("Research Question", 25000);
    await session.waitForText("Enter continue · Esc back", 25000);
    session.typeText("Question submit fallback test");
    session.pressEnter();

    await session.waitForText("▸  Protocol", 25000);
  } finally {
    await session.stop();
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("pty: Esc back walks back through setup stages", { concurrency: false }, async () => {
  const cwd = mkdtempSync(join(tmpdir(), "arbiter-tui-e2e-esc-back-"));
  const session = createPtySession({ cwd });

  try {
    await session.waitForText("Choose how to start", 25000);
    session.pressEnter();

    await session.waitForText("Choose run mode", 25000);
    session.pressEnter();

    await session.waitForText("Research Question", 25000);
    session.escape();
    await session.waitForText("Choose run mode", 25000);

    session.escape();
    await session.waitForText("Choose how to start", 25000);

    session.pressEnter();
    await session.waitForText("Choose run mode", 25000);
    session.pressEnter();
    await session.waitForText("Research Question", 25000);
    session.typeText("Back nav coverage");
    session.pressEnter();

    await session.waitForText("▸  Protocol", 25000);
    session.pressEnter();
    await session.waitForText("▸  Models", 25000);
    session.escape();
    await session.waitForText("▸  Protocol", 25000);

    session.pressEnter();
    await session.waitForText("▸  Models", 25000);
    session.pressEnter();
    await session.waitForText("▸  Personas", 25000);
    session.escape();
    await session.waitForText("▸  Models", 25000);
  } finally {
    await session.stop();
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("pty: decode numeric input stays inside the Stage 1 TUI renderer", { concurrency: false }, async () => {
  const cwd = mkdtempSync(join(tmpdir(), "arbiter-tui-e2e-decode-inline-"));
  const session = createPtySession({ cwd });

  try {
    await session.waitForText("Choose how to start", 25000);
    session.pressEnter();

    await session.waitForText("Choose run mode", 25000);
    session.pressEnter();

    await session.waitForText("Research Question", 25000);
    session.typeText("Inline decode prompt test");
    session.pressEnter();

    await session.waitForText("▸  Protocol", 25000);
    session.pressEnter();

    await session.waitForText("▸  Models", 25000);
    await session.waitForText("── Mid", 25000);
    await session.waitForText("● GPT-5.4 Mini · OpenAI · 400K ctx · $0.75/$4.5", 25000);
    session.pressEnter();

    await session.waitForText("▸  Personas", 25000);
    await session.waitForText("Unframed default reasoning stance", 25000);
    await session.waitForText("Caution: contrasts include prompt-presence asymmetry.", 25000);
    await session.waitForText("Baseline · baseline", 25000);
    session.pressEnter();

    await session.waitForText("▸  Decode Params", 25000);
    await session.waitForText("Temperature mode", 25000);
    session.pressEnter();

    await session.waitForText("Enter a value within [0.0, 2.0].", 25000);
    const output = session.getOutput();
    assert.equal(
      output.includes("Temperature [0.7]:"),
      false,
      "decode step should not fall back to readline-style prompts"
    );
  } finally {
    await session.stop();
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("pty: models step blocks confirmation after all visible defaults are deselected", { concurrency: false }, async () => {
  const cwd = mkdtempSync(join(tmpdir(), "arbiter-tui-e2e-models-empty-"));
  const session = createPtySession({ cwd });

  try {
    await session.waitForText("Choose how to start", 25000);
    session.pressEnter();

    await session.waitForText("Choose run mode", 25000);
    session.pressEnter();

    await session.waitForText("Research Question", 25000);
    session.typeText("Models empty selection guard");
    session.pressEnter();

    await session.waitForText("▸  Protocol", 25000);
    session.pressEnter();

    await session.waitForText("▸  Models", 25000);
    await session.waitForText("● GPT-5.4 Mini · OpenAI · 400K ctx · $0.75/$4.5", 25000);

    session.typeText(" ");
    session.pressEnter();

    await session.waitForText("Fix required: select at least one model.", 25000);
  } finally {
    await session.stop();
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("pty: undersized dashboard path falls back cleanly without live monitor", { concurrency: false }, async () => {
  const cwd = mkdtempSync(join(tmpdir(), "arbiter-tui-e2e-dashboard-small-"));
  createMockConfig(cwd);
  const session = createPtySession({
    cwd,
    cols: 60,
    rows: 14,
    args: ["run", "--config", "arbiter.config.json", "--dashboard"]
  });

  try {
    await session.waitForText(
      "Dashboard requires at least 60 columns x 15 rows; continuing without live dashboard.",
      25000
    );
    await session.waitForText("Stopped:", 45000);
    const exit = await session.waitForExit(45000);
    assert.equal(exit.exitCode, 0);

    const output = session.getOutput();
    assert.equal(output.includes("── PROGRESS"), false);
    assert.equal(output.includes("▍ RECEIPT"), false);
  } finally {
    await session.stop();
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("pty: dashboard re-renders across a live terminal resize", { concurrency: false }, async () => {
  const cwd = mkdtempSync(join(tmpdir(), "arbiter-tui-e2e-dashboard-resize-"));
  createMockConfig(cwd, {
    execution: {
      k_max: 8
    }
  });
  const session = createPtySession({
    cwd,
    cols: 120,
    rows: 24,
    args: ["run", "--config", "arbiter.config.json", "--dashboard"],
    env: {
      ARBITER_MOCK_DELAY_MS: "120"
    }
  });

  try {
    await session.waitForText("▍ RUN", 25000);
    await session.waitForText("Trials: 1/8", 25000);

    session.resize(60, 14);
    await session.waitForText(
      "Dashboard requires at least 60 columns x 15 rows; continuing without live dashboard.",
      25000
    );

    session.resize(120, 24);
    await session.waitForText("Trials: 5/8", 45000);
    await session.waitForText("▍ RECEIPT", 45000);

    const exit = await session.waitForExit(45000);
    assert.equal(exit.exitCode, 0);
    const finalTranscript = await renderFinalNormalScreenText(session.getRawOutput());
    assert.equal((finalTranscript.match(/▍ RUN/g) || []).length, 1);
    assert.equal((finalTranscript.match(/▍ RECEIPT/g) || []).length, 1);
    assert.equal(finalTranscript.includes("◆  Entry Path"), false);
  } finally {
    await session.stop();
    rmSync(cwd, { recursive: true, force: true });
  }
});
