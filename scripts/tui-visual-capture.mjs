import { mkdirSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import pty from "@homebridge/node-pty-prebuilt-multiarch";
import xtermHeadless from "@xterm/headless";

const { Terminal } = xtermHeadless;

const REPO_ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const CLI_ENTRY = resolve(REPO_ROOT, "dist/cli/index.js");
const DEFAULT_COLS = 120;
const DEFAULT_ROWS = 40;

const ANSI_CSI_REGEX = /\u001b\[[0-9;?]*[ -/]*[@-~]/g;
const ANSI_OSC_REGEX = /\u001b\][^\u0007]*\u0007/g;

const stripAnsi = (value) =>
  value
    .replace(ANSI_OSC_REGEX, "")
    .replace(ANSI_CSI_REGEX, "")
    .replace(/\r/g, "");

const delay = (ms) => new Promise((resolveDelay) => setTimeout(resolveDelay, ms));

const writeTerminal = async (term, data) =>
  new Promise((resolveWrite, rejectWrite) => {
    try {
      term.write(data, resolveWrite);
    } catch (error) {
      rejectWrite(error);
    }
  });

export const renderAnsiToText = async (
  ansiData,
  options = {}
) => {
  const cols = options.cols ?? DEFAULT_COLS;
  const rows = options.rows ?? DEFAULT_ROWS;
  const includeScrollback = options.includeScrollback ?? false;
  const term = new Terminal({
    allowProposedApi: true,
    cols,
    rows,
    convertEol: true
  });

  try {
    await writeTerminal(term, ansiData);
    const buffer = term.buffer.active;
    const startRow = includeScrollback ? 0 : buffer.viewportY;
    const endRow = includeScrollback ? buffer.length : Math.min(buffer.length, startRow + rows);
    const lines = [];
    for (let row = startRow; row < endRow; row += 1) {
      lines.push(buffer.getLine(row)?.translateToString(true) ?? "");
    }
    while (lines.length > 0 && lines.at(-1) === "") {
      lines.pop();
    }
    return lines.join("\n");
  } finally {
    term.dispose();
  }
};

const createDefaultOutputDir = () => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return resolve(REPO_ROOT, "output/playwright/tui-visual", timestamp);
};

const createPtySession = (options) => {
  const cols = options.cols ?? DEFAULT_COLS;
  const rows = options.rows ?? DEFAULT_ROWS;
  const session = pty.spawn("node", [CLI_ENTRY], {
    name: "xterm-256color",
    cols,
    rows,
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

  return {
    cols,
    rows,
    session,
    waitForText,
    getRawOutput: () => rawOutput,
    waitForExit: () => exitPromise
  };
};

export const captureVisualJourney = async (options = {}) => {
  const outputDir = options.outputDir ?? createDefaultOutputDir();
  const cols = options.cols ?? DEFAULT_COLS;
  const rows = options.rows ?? DEFAULT_ROWS;
  const quiet = options.quiet ?? false;
  mkdirSync(outputDir, { recursive: true });

  const { session, waitForText, getRawOutput, waitForExit } = createPtySession({ cols, rows });
  let checkpointIndex = 0;
  const checkpoints = [];

  const saveSnapshot = async (slug, snapshotOptions = {}) => {
    const { endBeforeText } = snapshotOptions;
    let snapshotAnsi = getRawOutput();
    if (typeof endBeforeText === "string" && endBeforeText.length > 0) {
      const endIndex = snapshotAnsi.indexOf(endBeforeText);
      if (endIndex >= 0) {
        snapshotAnsi = snapshotAnsi.slice(0, endIndex);
      }
    }

    checkpointIndex += 1;
    const prefix = `${String(checkpointIndex).padStart(2, "0")}-${slug}`;
    const ansiPath = resolve(outputDir, `${prefix}.ansi`);
    const textPath = resolve(outputDir, `${prefix}.txt`);
    writeFileSync(ansiPath, snapshotAnsi, "utf8");
    const renderedText = await renderAnsiToText(snapshotAnsi, { cols, rows });
    writeFileSync(textPath, renderedText.length > 0 ? `${renderedText}\n` : "", "utf8");
    checkpoints.push({
      slug,
      ansiPath,
      textPath
    });
  };

  const pressEnter = () => {
    session.write("\r");
  };

  const arrowDown = (count = 1) => {
    for (let index = 0; index < count; index += 1) {
      session.write("\u001b[B");
    }
  };

  try {
    await waitForText("A R B I T E R");
    await waitForText("Choose how to start");
    await saveSnapshot("step0-entry");
    arrowDown(1);
    pressEnter();

    await waitForText("Choose run mode");
    await saveSnapshot("step0-run-mode");
    arrowDown(1);
    pressEnter();

    await waitForText("◆  Research Question");
    await waitForText("Type your question and press Enter to continue");
    await saveSnapshot("step1-question");
    session.write("What are the tradeoffs of event sourcing?\r");

    await waitForText("◆  Protocol");
    await saveSnapshot("step2-protocol");
    pressEnter();

    await waitForText("◆  Models");
    await saveSnapshot("step3-models");
    pressEnter();

    await waitForText("◆  Personas");
    await saveSnapshot("step4-personas");
    pressEnter();

    await waitForText("◆  Decode Params");
    await waitForText("Temperature mode");
    await saveSnapshot("step5-decode-mode");
    pressEnter();

    await waitForText("Enter a value within [0.0, 2.0].");
    pressEnter();

    await waitForText("Seed mode");
    session.write("\u001b[A\r");

    await waitForText("◆  Advanced Settings");
    await saveSnapshot("step6-advanced");
    session.write("\u001b[A\r");

    await waitForText("◆  Review and Confirm");
    await saveSnapshot("step7-review");
    pressEnter();

    await waitForText("── PROGRESS");
    await saveSnapshot("stage2-run");

    await waitForText("── RECEIPT", 45000);
    await delay(200);
    await saveSnapshot("stage3-receipt");

    await waitForExit();

    const indexPath = resolve(outputDir, "index.txt");
    const indexLines = checkpoints.flatMap((checkpoint) => [
      `${basename(checkpoint.ansiPath)} | raw ANSI`,
      `${basename(checkpoint.textPath)} | rendered text`
    ]);
    writeFileSync(indexPath, `${indexLines.join("\n")}\n`, "utf8");

    if (!quiet) {
      console.log(`saved ${checkpoints.length} rendered checkpoints to ${outputDir}`);
      for (const checkpoint of checkpoints) {
        console.log(`- ${basename(checkpoint.ansiPath)}`);
        console.log(`- ${basename(checkpoint.textPath)}`);
      }
    }

    return {
      outputDir,
      checkpoints
    };
  } finally {
    try {
      session.kill();
    } catch {
      // ignore
    }
  }
};

const main = async () => {
  try {
    await captureVisualJourney();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
