import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import pty from "@homebridge/node-pty-prebuilt-multiarch";

const REPO_ROOT = resolve(new URL("..", import.meta.url).pathname);
const CLI_ENTRY = resolve(REPO_ROOT, "dist/cli/index.js");

const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const outputDir = resolve(REPO_ROOT, "output/playwright/tui-visual", timestamp);
mkdirSync(outputDir, { recursive: true });

const session = pty.spawn("node", [CLI_ENTRY], {
  name: "xterm-256color",
  cols: 120,
  rows: 40,
  cwd: REPO_ROOT,
  env: {
    ...process.env,
    TERM: "xterm-256color",
    COLORTERM: "truecolor",
    NO_COLOR: "",
    CLICOLOR_FORCE: "1"
  }
});

let rawOutput = "";
let checkpointIndex = 0;
const checkpoints = [];
const ANSI_CSI_REGEX = /\u001b\[[0-9;?]*[ -/]*[@-~]/g;
const ANSI_OSC_REGEX = /\u001b\][^\u0007]*\u0007/g;
const stripAnsi = (value) =>
  value
    .replace(ANSI_OSC_REGEX, "")
    .replace(ANSI_CSI_REGEX, "")
    .replace(/\r/g, "");
const exitPromise = new Promise((resolveExit) => {
  session.onExit(resolveExit);
});

session.onData((chunk) => {
  rawOutput += chunk;
});

const waitForText = (text, timeoutMs = 25000) =>
  new Promise((resolveWait, rejectWait) => {
    const deadline = Date.now() + timeoutMs;
    const poll = setInterval(() => {
      const current = stripAnsi(rawOutput);
      if (current.includes(text)) {
        clearInterval(poll);
        resolveWait(true);
        return;
      }
      if (Date.now() >= deadline) {
        clearInterval(poll);
        const tail = current.slice(-1200);
        rejectWait(
          new Error(
            `waitForText(${text}) timed out after ${timeoutMs}ms\n--- raw tail ---\n${tail}\n--- end tail ---`
          )
        );
      }
    }, 20);
  });

const delay = (ms) => new Promise((resolveDelay) => setTimeout(resolveDelay, ms));

const saveSnapshot = (slug, options = {}) => {
  const { endBeforeText } = options;
  let snapshotText = rawOutput;
  if (typeof endBeforeText === "string" && endBeforeText.length > 0) {
    const endIndex = rawOutput.indexOf(endBeforeText);
    if (endIndex >= 0) {
      snapshotText = rawOutput.slice(0, endIndex);
    }
  }
  checkpointIndex += 1;
  const filename = `${String(checkpointIndex).padStart(2, "0")}-${slug}.ansi`;
  const path = resolve(outputDir, filename);
  writeFileSync(path, snapshotText, "utf8");
  checkpoints.push(filename);
};

const pressEnter = () => {
  session.write("\r");
};

const arrowDown = (count = 1) => {
  for (let index = 0; index < count; index += 1) {
    session.write("\u001b[B");
  }
};

const run = async () => {
  await waitForText("A R B I T E R");
  await waitForText("Choose how to start");
  saveSnapshot("step0-entry");
  arrowDown(1);
  pressEnter();

  await waitForText("Choose run mode");
  saveSnapshot("step0-run-mode");
  arrowDown(1);
  pressEnter();

  await waitForText("◆  Research Question");
  await waitForText("Type your question and press Enter to continue");
  saveSnapshot("step1-question");
  session.write("What are the tradeoffs of event sourcing?\r");

  await waitForText("◆  Protocol");
  saveSnapshot("step2-protocol");
  pressEnter();

  await waitForText("◆  Models");
  saveSnapshot("step3-models");
  pressEnter();

  await waitForText("◆  Personas");
  saveSnapshot("step4-personas");
  pressEnter();

  await waitForText("◆  Decode Params");
  await waitForText("Temperature mode");
  saveSnapshot("step5-decode-mode");
  pressEnter();

  await waitForText("Temperature [0.7]:");
  pressEnter();

  await waitForText("Seed mode");
  session.write("\u001b[A\r"); // pick random seed

  await waitForText("◆  Advanced Settings");
  saveSnapshot("step6-advanced");
  // choose defaults
  session.write("\u001b[A\r");

  await waitForText("◆  Review and Confirm");
  saveSnapshot("step7-review");
  pressEnter(); // Run now

  await waitForText("── PROGRESS");
  saveSnapshot("stage2-run");

  await waitForText("── RECEIPT", 45000);
  await delay(200);
  saveSnapshot("stage3-receipt");

  await exitPromise;
};

const main = async () => {
  try {
    await run();
    const indexPath = resolve(outputDir, "index.txt");
    writeFileSync(indexPath, `${checkpoints.join("\n")}\n`, "utf8");
    console.log(`saved ${checkpoints.length} snapshots to ${outputDir}`);
    for (const name of checkpoints) {
      console.log(`- ${name}`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  } finally {
    try {
      session.kill();
    } catch {
      // ignore
    }
  }
};

main();
