import { mkdirSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import pty from "@homebridge/node-pty-prebuilt-multiarch";
import xtermHeadless from "@xterm/headless";

const { Terminal } = xtermHeadless;

const REPO_ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const CLI_ENTRY = resolve(REPO_ROOT, "dist/cli/index.js");
const DEFAULT_COLS = 120;
const DEFAULT_ROWS = 40;
const ALT_SCREEN_DISABLE = "\u001b[?1049l";

const ANSI_CSI_REGEX = /\u001b\[[0-9;?]*[ -/]*[@-~]/g;
const ANSI_OSC_REGEX = /\u001b\][^\u0007]*\u0007/g;

const stripAnsi = (value) =>
  value
    .replace(ANSI_OSC_REGEX, "")
    .replace(ANSI_CSI_REGEX, "")
    .replace(/\r/g, "");

export const extractFinalNormalScreenAnsi = (ansiData) => {
  const lastDisableIndex = ansiData.lastIndexOf(ALT_SCREEN_DISABLE);
  if (lastDisableIndex < 0) {
    return ansiData;
  }
  return ansiData.slice(lastDisableIndex + ALT_SCREEN_DISABLE.length);
};

export const renderFinalNormalScreenText = async (ansiData, options = {}) =>
  extractDurableTranscriptText(
    await renderAnsiToText(extractFinalNormalScreenAnsi(ansiData), {
      cols: options.cols ?? DEFAULT_COLS,
      rows: options.rows ?? DEFAULT_ROWS,
      includeScrollback: true
    })
  );

const previousLineStart = (value, lineStart) => {
  if (lineStart <= 0) {
    return 0;
  }
  return value.lastIndexOf("\n", lineStart - 2) + 1;
};

const anchorLineStart = (value, anchorIndex) => {
  let start = value.lastIndexOf("\n", anchorIndex - 1) + 1;
  let probeStart = start;
  for (let index = 0; index < 4 && probeStart > 0; index += 1) {
    const priorStart = previousLineStart(value, probeStart);
    const priorLine = value.slice(priorStart, Math.max(priorStart, probeStart - 1)).trimEnd();
    if (priorLine.startsWith("▍ ")) {
      start = priorStart;
      break;
    }
    probeStart = priorStart;
  }
  return start;
};

const extractDurableTranscriptText = (renderedText) => {
  const receiptIndex = renderedText.lastIndexOf("▍ RECEIPT");
  if (receiptIndex < 0) {
    return renderedText.trim();
  }

  const runIndex = renderedText.lastIndexOf("▍ RUN", receiptIndex);
  const setupIndex = renderedText.lastIndexOf("▍ SETUP", receiptIndex);
  const brandIndex =
    setupIndex >= 0
      ? renderedText.lastIndexOf("ARBITER", setupIndex)
      : runIndex >= 0
        ? renderedText.lastIndexOf("ARBITER", runIndex)
        : renderedText.lastIndexOf("ARBITER", receiptIndex);
  const entryIndex = renderedText.lastIndexOf("◆  Entry Path", receiptIndex);

  let anchorIndex = receiptIndex;
  if (brandIndex >= 0 && entryIndex > brandIndex) {
    anchorIndex = brandIndex;
  } else if (runIndex >= 0) {
    anchorIndex = runIndex;
  }

  return renderedText.slice(anchorLineStart(renderedText, anchorIndex)).trim();
};

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

const usage = () => `Usage: node scripts/tui-visual-capture.mjs [options]

Options:
  --cols <number>   Terminal width to emulate (default: ${DEFAULT_COLS})
  --rows <number>   Terminal height to emulate (default: ${DEFAULT_ROWS})
  --out <path>      Output directory for capture artifacts
  --quiet           Suppress checkpoint listing
  --help            Show this message
`;

const parsePositiveInteger = (value, name) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer, got: ${value}`);
  }
  return parsed;
};

const parseCliOptions = (argv = process.argv.slice(2)) => {
  const { values } = parseArgs({
    args: argv,
    allowPositionals: false,
    options: {
      cols: { type: "string" },
      rows: { type: "string" },
      out: { type: "string" },
      quiet: { type: "boolean", default: false },
      help: { type: "boolean", default: false }
    }
  });

  if (values.help) {
    return { help: true };
  }

  return {
    cols: values.cols ? parsePositiveInteger(values.cols, "--cols") : undefined,
    rows: values.rows ? parsePositiveInteger(values.rows, "--rows") : undefined,
    outputDir: values.out ? resolve(REPO_ROOT, values.out) : undefined,
    quiet: values.quiet
  };
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
    const renderedText = await renderAnsiToText(snapshotAnsi, {
      cols,
      rows,
      includeScrollback: slug.startsWith("stage")
    });
    writeFileSync(textPath, renderedText.length > 0 ? `${renderedText}\n` : "", "utf8");
    const transcriptPath =
      slug === "stage3-receipt" ? resolve(outputDir, `${prefix}.transcript.txt`) : undefined;
    if (transcriptPath) {
      const transcriptText = await renderFinalNormalScreenText(snapshotAnsi, { cols, rows });
      writeFileSync(transcriptPath, transcriptText.length > 0 ? `${transcriptText}\n` : "", "utf8");
    }
    checkpoints.push({
      slug,
      ansiPath,
      textPath,
      transcriptPath
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
    await waitForText("ARBITER");
    await waitForText("Choose how to start");
    await saveSnapshot("step0-entry");
    arrowDown(1);
    pressEnter();

    await waitForText("Choose run mode");
    await saveSnapshot("step0-run-mode");
    arrowDown(1);
    pressEnter();

    await waitForText("▸  Research Question");
    await waitForText("Enter continue · Esc back");
    await saveSnapshot("step1-question");
    session.write("What are the tradeoffs of event sourcing?\r");

    await waitForText("▸  Protocol");
    await saveSnapshot("step2-protocol");
    arrowDown(1);
    pressEnter();

    await waitForText("Debate (2P, 1R, 3 turns)");
    await waitForText("2 participants");
    await waitForText("1 round");
    await saveSnapshot("step2-debate-config");
    pressEnter();

    await waitForText("▸  Models");
    await saveSnapshot("step3-models");
    pressEnter();

    await waitForText("▸  Personas");
    await saveSnapshot("step4-personas");
    pressEnter();

    await waitForText("▸  Decode Params");
    await waitForText("Temperature mode");
    await saveSnapshot("step5-decode-mode");
    pressEnter();

    await waitForText("Enter a value within [0.0, 2.0].");
    pressEnter();

    await waitForText("Seed mode");
    session.write("\u001b[A\r");

    await waitForText("▸  Advanced Settings");
    await saveSnapshot("step6-advanced");
    session.write("\u001b[A\r");

    await waitForText("▸  Review and Confirm");
    await saveSnapshot("step7-review");
    pressEnter();

    await waitForText("▍ RUN");
    await waitForText("── PROGRESS");
    await delay(200);
    await saveSnapshot("stage2-run", { endBeforeText: "▍ RECEIPT" });

    await waitForText("▍ RECEIPT", 45000);
    await delay(200);
    await saveSnapshot("stage3-receipt");

    await waitForExit();

    const indexPath = resolve(outputDir, "index.txt");
    const indexJsonPath = resolve(outputDir, "index.json");
    const indexLines = checkpoints.flatMap((checkpoint) => [
      `${basename(checkpoint.ansiPath)} | raw ANSI`,
      `${basename(checkpoint.textPath)} | rendered text`,
      ...(checkpoint.transcriptPath ? [`${basename(checkpoint.transcriptPath)} | normal-screen transcript`] : [])
    ]);
    writeFileSync(indexPath, `${indexLines.join("\n")}\n`, "utf8");
    writeFileSync(
      indexJsonPath,
      `${JSON.stringify(
        {
          outputDir,
          cols,
          rows,
          checkpointCount: checkpoints.length,
          checkpoints: checkpoints.map((checkpoint, index) => ({
            index: index + 1,
            slug: checkpoint.slug,
            ansiFile: basename(checkpoint.ansiPath),
            textFile: basename(checkpoint.textPath),
            ...(checkpoint.transcriptPath ? { transcriptFile: basename(checkpoint.transcriptPath) } : {})
          }))
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    if (!quiet) {
      console.log(`saved ${checkpoints.length} rendered checkpoints to ${outputDir}`);
      for (const checkpoint of checkpoints) {
        console.log(`- ${basename(checkpoint.ansiPath)}`);
        console.log(`- ${basename(checkpoint.textPath)}`);
      }
    }

    return {
      outputDir,
      checkpoints,
      indexPath,
      indexJsonPath
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
    const options = parseCliOptions();
    if (options.help) {
      console.log(usage());
      return;
    }
    await captureVisualJourney(options);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
