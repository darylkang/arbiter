import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  captureVisualJourney,
  renderFinalNormalScreenText
} from "../../scripts/tui-visual-capture.mjs";

const getCheckpoint = (checkpoints, slug) => {
  const checkpoint = checkpoints.find((item) => item.slug === slug);
  assert.ok(checkpoint, `expected checkpoint ${slug}`);
  return checkpoint;
};

const assertRenderedSnapshotIncludes = (checkpoint, snippets) => {
  assert.equal(existsSync(checkpoint.ansiPath), true, `expected raw snapshot ${checkpoint.ansiPath}`);
  assert.equal(existsSync(checkpoint.textPath), true, `expected rendered snapshot ${checkpoint.textPath}`);
  const rendered = readFileSync(checkpoint.textPath, "utf8");
  for (const snippet of snippets) {
    assert.equal(rendered.includes(snippet), true, `expected ${checkpoint.slug} to include ${snippet}`);
  }
};

test("pty capture emits rendered snapshots for key journey checkpoints", { concurrency: false }, async () => {
  const outputDir = mkdtempSync(join(tmpdir(), "arbiter-tui-rendered-"));

  try {
    const { checkpoints } = await captureVisualJourney({
      outputDir,
      quiet: true
    });

    assert.equal(existsSync(join(outputDir, "index.txt")), true, "expected capture index");
    assert.equal(existsSync(join(outputDir, "index.json")), true, "expected capture json index");

    assertRenderedSnapshotIncludes(getCheckpoint(checkpoints, "step0-entry"), [
      "ARBITER",
      "▍ SETUP",
      "Choose how to start"
    ]);
    assertRenderedSnapshotIncludes(getCheckpoint(checkpoints, "step1-question"), [
      "Research Question",
      "Include all relevant context. Arbiter samples responses to characterize distributional behavior.",
      "Start typing…"
    ]);
    assertRenderedSnapshotIncludes(getCheckpoint(checkpoints, "step3-models"), [
      "GPT-5.4 Mini",
      "Start here, then compare upward to flagships on harder tasks.",
      "── Mid",
      "■ GPT-5.4 Mini · OpenAI · 400K ctx · $0.75/$4.5",
      "Claude Sonnet 4.6 · Anthropic",
      "Kimi K2.5 · MoonshotAI",
      "Mistral Small 4 · Mistral"
    ]);
    assertRenderedSnapshotIncludes(getCheckpoint(checkpoints, "step4-personas"), [
      "Baseline",
      "Unframed default reasoning stance",
      "Use as the reference condition for study comparisons.",
      "■ Baseline · baseline",
      "Skeptical"
    ]);
    assertRenderedSnapshotIncludes(getCheckpoint(checkpoints, "step7-review"), [
      "Review and Confirm",
      "Run now"
    ]);
    assertRenderedSnapshotIncludes(getCheckpoint(checkpoints, "stage2-run"), [
      "▍ RUN",
      "── PROGRESS",
      "Trials:"
    ]);
    assertRenderedSnapshotIncludes(getCheckpoint(checkpoints, "stage3-receipt"), [
      "▍ RECEIPT",
      "→ Run complete."
    ]);

    const reviewRendered = readFileSync(getCheckpoint(checkpoints, "step7-review").textPath, "utf8");
    assert.equal(reviewRendered.includes("event sourcing?What are"), false);

    const receiptAnsi = readFileSync(getCheckpoint(checkpoints, "stage3-receipt").ansiPath, "utf8");
    const finalTranscript = await renderFinalNormalScreenText(receiptAnsi);
    assert.equal(finalTranscript.includes("▍ RECEIPT"), true);
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});

test("pty capture preserves the Stage 2 status strip on a 24-row terminal", { concurrency: false }, async () => {
  const outputDir = mkdtempSync(join(tmpdir(), "arbiter-tui-rendered-24rows-"));

  try {
    const { checkpoints } = await captureVisualJourney({
      outputDir,
      cols: 120,
      rows: 24,
      quiet: true
    });

    const runRendered = readFileSync(getCheckpoint(checkpoints, "stage2-run").textPath, "utf8");
    assert.equal(runRendered.includes("▍ RUN"), true);

    const receiptAnsi = readFileSync(getCheckpoint(checkpoints, "stage3-receipt").ansiPath, "utf8");
    const finalTranscript = await renderFinalNormalScreenText(receiptAnsi, { cols: 120, rows: 24 });
    assert.equal((finalTranscript.match(/▍ RUN/g) || []).length, 1);
    assert.equal((finalTranscript.match(/── PROGRESS/g) || []).length, 1);
    assert.equal((finalTranscript.match(/▍ RECEIPT/g) || []).length, 1);
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});

test("pty capture preserves the Stage 2 status strip on a 60x24 terminal", { concurrency: false }, async () => {
  const outputDir = mkdtempSync(join(tmpdir(), "arbiter-tui-rendered-60x24-"));

  try {
    const { checkpoints } = await captureVisualJourney({
      outputDir,
      cols: 60,
      rows: 24,
      quiet: true
    });

    const runRendered = readFileSync(getCheckpoint(checkpoints, "stage2-run").textPath, "utf8");
    assert.equal(runRendered.includes("▍ RUN"), true);

    const receiptAnsi = readFileSync(getCheckpoint(checkpoints, "stage3-receipt").ansiPath, "utf8");
    const finalTranscript = await renderFinalNormalScreenText(receiptAnsi, { cols: 60, rows: 24 });
    assert.equal((finalTranscript.match(/▍ RUN/g) || []).length, 1);
    assert.equal((finalTranscript.match(/── PROGRESS/g) || []).length, 1);
    assert.equal((finalTranscript.match(/▍ RECEIPT/g) || []).length, 1);
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});

test("pty capture completes at the minimum supported 60x18 size", { concurrency: false }, async () => {
  const outputDir = mkdtempSync(join(tmpdir(), "arbiter-tui-rendered-60x18-"));

  try {
    const { checkpoints } = await captureVisualJourney({
      outputDir,
      cols: 60,
      rows: 18,
      quiet: true
    });

    assertRenderedSnapshotIncludes(getCheckpoint(checkpoints, "step0-entry"), [
      "ARBITER",
      "Choose how to start"
    ]);
    assertRenderedSnapshotIncludes(getCheckpoint(checkpoints, "stage2-run"), [
      "▍ RUN",
      "── PROGRESS",
      "Trials:"
    ]);
    const receiptAnsi = readFileSync(getCheckpoint(checkpoints, "stage3-receipt").ansiPath, "utf8");
    const finalTranscript = await renderFinalNormalScreenText(receiptAnsi, { cols: 60, rows: 18 });
    assert.equal(finalTranscript.includes("▍ RECEIPT"), true);
    assert.equal(finalTranscript.includes("→ Run complete."), true);
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});
