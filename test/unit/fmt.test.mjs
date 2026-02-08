import assert from "node:assert/strict";
import test from "node:test";

import { createFormatter } from "../../dist/ui/fmt.js";

const ANSI_REGEX = /\u001b\[[0-9;]*m/g;

const stripAnsi = (value) => value.replace(ANSI_REGEX, "");

const ttyStream = (columns = 80) => ({ isTTY: true, columns });
const pipeStream = (columns = 80) => ({ isTTY: false, columns });

test("formatter emits plain output in non-tty mode", () => {
  const fmt = createFormatter({
    stream: pipeStream(),
    env: { TERM: "xterm-256color" }
  });

  assert.equal(fmt.isTTY, false);
  assert.equal(fmt.isColorEnabled, false);
  assert.equal(fmt.header("Arbiter"), "Arbiter");
  assert.equal(fmt.kv("Run ID", "abc"), "Run ID: abc");
  assert.equal(fmt.warnBlock("problem"), "warn: problem");
  assert.equal(fmt.errorBlock("failed"), "error: failed");
  assert.equal(fmt.tip("arbiter run"), "Next: arbiter run");
});

test("formatter honors NO_COLOR for tty streams", () => {
  const fmt = createFormatter({
    stream: ttyStream(),
    env: { TERM: "xterm-256color", NO_COLOR: "1" }
  });

  assert.equal(fmt.isTTY, true);
  assert.equal(fmt.isColorEnabled, false);

  const output = [
    fmt.header("Arbiter"),
    fmt.statusChip("run complete", "success", "done"),
    fmt.warnBlock("warning"),
    fmt.errorBlock("error")
  ].join("\n");

  assert.equal(output.includes("\u001b["), false);
});

test("formatter emits ANSI color in tty mode when enabled", () => {
  const fmt = createFormatter({
    stream: ttyStream(120),
    env: { TERM: "xterm-256color" }
  });

  assert.equal(fmt.isTTY, true);
  assert.equal(fmt.isColorEnabled, true);

  const header = fmt.header("Arbiter");
  assert.equal(header.includes("\u001b["), true);
  assert.equal(stripAnsi(header).includes("Arbiter"), true);

  const chip = fmt.statusChip("batch", "info", "1 complete");
  assert.equal(chip.includes("\u001b["), true);
  assert.equal(stripAnsi(chip).includes("batch"), true);

  const divider = stripAnsi(fmt.divider(20));
  assert.equal(divider.length, 24);
});

test("formatter supports CLICOLOR_FORCE for non-tty streams", () => {
  const fmt = createFormatter({
    stream: pipeStream(),
    env: { TERM: "xterm-256color", CLICOLOR_FORCE: "1" }
  });

  assert.equal(fmt.isColorEnabled, true);
  assert.equal(fmt.warn("hello").includes("\u001b["), true);
});

test("formatter treats NO_COLOR=0 as disabled color", () => {
  const fmt = createFormatter({
    stream: ttyStream(),
    env: { TERM: "xterm-256color", NO_COLOR: "0" }
  });

  assert.equal(fmt.isColorEnabled, false);
  assert.equal(fmt.success("ok").includes("\u001b["), false);
});
