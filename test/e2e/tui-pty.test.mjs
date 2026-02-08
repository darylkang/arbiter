import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import pty from "@homebridge/node-pty-prebuilt-multiarch";

const REPO_ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const CLI_ENTRY = resolve(REPO_ROOT, "dist/cli/index.js");
const TEMPLATE_PATH = resolve(REPO_ROOT, "templates/quickstart_independent.config.json");

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

const createMockConfig = (cwd, options = {}) => {
  const config = JSON.parse(readFileSync(TEMPLATE_PATH, "utf8"));
  config.execution.k_max = options.kMax ?? 2;
  config.execution.k_min = options.kMin ?? 0;
  config.execution.batch_size = options.batchSize ?? 1;
  config.execution.workers = options.workers ?? 1;
  config.question.text = options.question ?? "TUI E2E test question";
  config.question.question_id = options.questionId ?? "tui_e2e_q1";
  writeFileSync(join(cwd, "arbiter.config.json"), `${JSON.stringify(config, null, 2)}\n`, "utf8");
};

const createPtySession = (input) => {
  const proc = pty.spawn("node", [CLI_ENTRY], {
    name: "xterm-256color",
    cols: 120,
    rows: 40,
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

  const waitForText = async (text, timeoutMs = 20000) =>
    withTimeout(
      new Promise((resolveText) => {
        const poll = () => {
          if (stripAnsi(output).includes(text)) {
            resolveText(true);
            return;
          }
          setTimeout(poll, 25);
        };
        poll();
      }),
      timeoutMs,
      `waitForText(${text})`
    );

  const writeLine = (line) => {
    proc.write(`${line}\r`);
  };

  const writeRaw = (chars) => {
    proc.write(chars);
  };

  const pressEnter = () => {
    proc.write("\r");
  };

  const writeCtrlC = () => {
    proc.write("\u0003");
  };

  const waitForExit = async (timeoutMs = 20000) => {
    const result = await withTimeout(exitPromise, timeoutMs, "waitForExit");
    return result;
  };

  const stop = async () => {
    try {
      proc.kill();
    } catch {
      // No-op: process may already be gone.
    }
    await withTimeout(exitPromise, 2000, "stopExit").catch(() => {});
  };

  return {
    writeLine,
    writeRaw,
    pressEnter,
    writeCtrlC,
    waitForText,
    waitForExit,
    stop,
    getOutput: () => stripAnsi(output)
  };
};

test("pty: /help then /quit exits cleanly", { concurrency: false }, async () => {
  const session = createPtySession({ cwd: REPO_ROOT });

  try {
    await session.waitForText("Welcome to Arbiter.", 20000);
    await session.waitForText("What question are you investigating?", 20000);
    session.writeLine("/help");
    await session.waitForText("commands:", 20000);
    session.writeLine("/quit");

    const exit = await session.waitForExit(20000);
    assert.equal(exit.exitCode, 0);
    assert.ok(session.getOutput().includes("/run [mock|live]"));
  } finally {
    await session.stop();
  }
});

test("pty: guided intake flow completes from question to receipt", { concurrency: false }, async () => {
  const cwd = mkdtempSync(join(tmpdir(), "arbiter-tui-e2e-guided-"));
  const session = createPtySession({ cwd });

  try {
    await session.waitForText("Welcome to Arbiter.", 20000);
    await session.waitForText("What question are you investigating?", 20000);

    session.writeLine("How do model ensembles affect novelty saturation in policy QA?");
    await session.waitForText("Select a profile", 20000);
    session.pressEnter();

    await session.waitForText("Select a run mode", 20000);
    session.pressEnter();

    await session.waitForText("Review study setup", 20000);
    session.pressEnter();

    await session.waitForText("Configuration saved to", 20000);
    await session.waitForText("Run complete:", 45000);
    await session.waitForText("Choose next action", 45000);

    const runDirs = readdirSync(join(cwd, "runs"), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
    assert.ok(runDirs.length >= 1);

    session.writeRaw("\u001b[B\u001b[B\u001b[B");
    session.pressEnter();
    const exit = await session.waitForExit(20000);
    assert.equal(exit.exitCode, 0);
  } finally {
    await session.stop();
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("pty: /run mock completes and writes artifacts", { concurrency: false }, async () => {
  const cwd = mkdtempSync(join(tmpdir(), "arbiter-tui-e2e-"));
  createMockConfig(cwd, { kMax: 2, kMin: 0, workers: 1, batchSize: 1, questionId: "e2e_mock" });

  const session = createPtySession({ cwd });

  try {
    await session.waitForText("Welcome to Arbiter.", 20000);
    await session.waitForText("Choose how to continue", 20000);
    session.pressEnter();

    await session.waitForText("Starting mock run.", 20000);
    await session.waitForText("Run complete:", 30000);
    await session.waitForText("Artifacts written to", 30000);
    await session.waitForText("Choose next action", 30000);

    const runDirs = readdirSync(join(cwd, "runs"), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
    assert.ok(runDirs.length >= 1);

    session.writeRaw("\u001b[B\u001b[B\u001b[B");
    session.pressEnter();
    const exit = await session.waitForExit(20000);
    assert.equal(exit.exitCode, 0);
  } finally {
    await session.stop();
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("pty: ctrl+c requests graceful stop during run", { concurrency: false }, async () => {
  const cwd = mkdtempSync(join(tmpdir(), "arbiter-tui-e2e-int-"));
  createMockConfig(cwd, {
    kMax: 12,
    kMin: 0,
    workers: 1,
    batchSize: 1,
    questionId: "e2e_interrupt"
  });

  const session = createPtySession({
    cwd,
    env: {
      ARBITER_MOCK_DELAY_MS: "120"
    }
  });

  try {
    await session.waitForText("Welcome to Arbiter.", 20000);
    await session.waitForText("Choose how to continue", 20000);
    session.pressEnter();
    await session.waitForText("Starting mock run.", 20000);

    session.writeCtrlC();
    await session.waitForText("Interrupt requested. Waiting for in-flight trials to finish.", 20000);
    await session.waitForText("Run complete:", 45000);
    await session.waitForText("Choose next action", 45000);

    session.writeRaw("\u001b[B\u001b[B\u001b[B");
    session.pressEnter();
    const exit = await session.waitForExit(20000);
    assert.equal(exit.exitCode, 0);
  } finally {
    await session.stop();
    rmSync(cwd, { recursive: true, force: true });
  }
});
