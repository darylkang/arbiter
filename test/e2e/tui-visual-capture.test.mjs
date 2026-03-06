import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { captureVisualJourney, renderAnsiToText } from "../../scripts/tui-visual-capture.mjs";

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

    assertRenderedSnapshotIncludes(getCheckpoint(checkpoints, "step0-entry"), [
      "A R B I T E R",
      "Choose how to start"
    ]);
    assertRenderedSnapshotIncludes(getCheckpoint(checkpoints, "step1-question"), [
      "Research Question",
      "(start typing)"
    ]);
    assertRenderedSnapshotIncludes(getCheckpoint(checkpoints, "step7-review"), [
      "Review and Confirm",
      "Run now"
    ]);
    assertRenderedSnapshotIncludes(getCheckpoint(checkpoints, "stage2-run"), [
      "── PROGRESS",
      "Trials:"
    ]);
    assertRenderedSnapshotIncludes(getCheckpoint(checkpoints, "stage3-receipt"), [
      "── RECEIPT",
      "Run complete."
    ]);

    const reviewRendered = readFileSync(getCheckpoint(checkpoints, "step7-review").textPath, "utf8");
    assert.equal(reviewRendered.includes("event sourcing?What are"), false);

    const receiptAnsi = readFileSync(getCheckpoint(checkpoints, "stage3-receipt").ansiPath, "utf8");
    const fullScrollback = await renderAnsiToText(receiptAnsi, {
      includeScrollback: true
    });
    assert.equal((fullScrollback.match(/── PROGRESS/g) || []).length, 1);
    assert.equal((fullScrollback.match(/run \/ monitoring/g) || []).length, 1);
    assert.equal((fullScrollback.match(/── RECEIPT/g) || []).length, 1);
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
    assert.equal(runRendered.includes("run / monitoring"), true);

    const receiptAnsi = readFileSync(getCheckpoint(checkpoints, "stage3-receipt").ansiPath, "utf8");
    const fullScrollback = await renderAnsiToText(receiptAnsi, {
      cols: 120,
      rows: 24,
      includeScrollback: true
    });
    assert.equal((fullScrollback.match(/── PROGRESS/g) || []).length, 1);
    assert.equal((fullScrollback.match(/run \/ monitoring/g) || []).length, 1);
    assert.equal((fullScrollback.match(/── RECEIPT/g) || []).length, 1);
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});
