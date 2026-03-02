import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import pty from "@homebridge/node-pty-prebuilt-multiarch";

const REPO_ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const CLI_ENTRY = resolve(REPO_ROOT, "dist/cli/index.js");
const ANSI_CSI_REGEX = /\u001b\[[0-9;?]*[ -/]*[@-~]/g;
const ANSI_OSC_REGEX = /\u001b\][^\u0007]*\u0007/g;

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

const createMockConfig = (cwd) => {
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
  const proc = pty.spawn("node", [CLI_ENTRY], {
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
    waitForExit,
    stop,
    getOutput: () => stripAnsi(output)
  };
};

test("pty: wizard launches in TTY and exits cleanly from Step 0", { concurrency: false }, async () => {
  const cwd = mkdtempSync(join(tmpdir(), "arbiter-tui-e2e-exit-"));
  const session = createPtySession({ cwd });

  try {
    await session.waitForText("ARBITER", 25000);
    await session.waitForText("Step 0 — Entry path", 25000);
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

test("pty: run-existing mock path reaches RUN and RECEIPT then auto-exits", { concurrency: false }, async () => {
  const cwd = mkdtempSync(join(tmpdir(), "arbiter-tui-e2e-existing-"));
  createMockConfig(cwd);
  const session = createPtySession({ cwd });

  try {
    await session.waitForText("Step 0 — Entry path", 25000);
    session.pressEnter();

    await session.waitForText("Step 0 — Run mode", 25000);
    session.arrowDown(1);
    session.pressEnter();

    await session.waitForText("Step 7 — Review & Confirm", 25000);
    session.pressEnter();

    await session.waitForText("═══ RUN ═══", 45000);
    await session.waitForText("Usage so far: usage not applicable (mock mode)", 45000);
    await session.waitForText("═══ RECEIPT ═══", 45000);

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

    const output = session.getOutput();
    assert.equal(
      output.includes("Choose the next action"),
      false,
      "stage 3 should auto-exit with no next-action menu"
    );
  } finally {
    await session.stop();
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("pty: create-new path submits Step 1 question with Enter", { concurrency: false }, async () => {
  const cwd = mkdtempSync(join(tmpdir(), "arbiter-tui-e2e-question-submit-"));
  const session = createPtySession({ cwd });

  try {
    await session.waitForText("Step 0 — Entry path", 25000);
    await session.waitForText("Create new study (guided wizard)", 25000);
    session.pressEnter();

    await session.waitForText("Step 0 — Run mode", 25000);
    await session.waitForText("Mock (no API calls)", 25000);
    session.pressEnter();

    await session.waitForText("Step 1 — Research Question", 25000);
    await session.waitForText("Enter submit", 25000);
    session.typeText("Question submit fallback test");
    session.pressEnter();

    await session.waitForText("Step 2 — Protocol", 25000);
  } finally {
    await session.stop();
    rmSync(cwd, { recursive: true, force: true });
  }
});
