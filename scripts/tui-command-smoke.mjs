import assert from "node:assert/strict";

import { executeCommandInput } from "../dist/ui/transcript/commands/registry.js";

const events = [];
const context = {
  state: {
    hasApiKey: false,
    phase: "idle",
    hasConfig: false
  },
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

const handledRun = await executeCommandInput({ value: "/run mock", context });
assert.equal(handledRun, true);
assert.deepEqual(events.find((entry) => entry[0] === "run"), ["run", "mock"]);

events.length = 0;
const handledDefaultRun = await executeCommandInput({ value: "/run", context });
assert.equal(handledDefaultRun, true);
assert.deepEqual(events.find((entry) => entry[0] === "run"), ["run", "mock"]);

events.length = 0;
assert.equal(await executeCommandInput({ value: "/new", context }), true);
assert.ok(events.some((entry) => entry[0] === "new"));

events.length = 0;
assert.equal(await executeCommandInput({ value: "/analyze runs/sample", context }), true);
assert.deepEqual(events.find((entry) => entry[0] === "analyze"), ["analyze", "runs/sample"]);

events.length = 0;
assert.equal(await executeCommandInput({ value: "/report runs/sample", context }), true);
assert.deepEqual(events.find((entry) => entry[0] === "report"), ["report", "runs/sample"]);

events.length = 0;
assert.equal(await executeCommandInput({ value: "/verify runs/sample", context }), true);
assert.deepEqual(events.find((entry) => entry[0] === "verify"), ["verify", "runs/sample"]);

events.length = 0;
assert.equal(await executeCommandInput({ value: "/receipt runs/sample", context }), true);
assert.deepEqual(events.find((entry) => entry[0] === "receipt"), ["receipt", "runs/sample"]);

events.length = 0;
const handledWarnings = await executeCommandInput({ value: "/warnings", context });
assert.equal(handledWarnings, true);
assert.ok(events.some((entry) => entry[0] === "warnings"));

events.length = 0;
assert.equal(await executeCommandInput({ value: "/help", context }), true);
assert.ok(events.some((entry) => entry[0] === "system" && String(entry[1]).includes("commands:")));
assert.equal(await executeCommandInput({ value: "/h", context }), true);
assert.equal(await executeCommandInput({ value: "/warn", context }), true);

events.length = 0;
assert.equal(await executeCommandInput({ value: "/quit", context }), true);
assert.ok(events.some((entry) => entry[0] === "exit"));

events.length = 0;
context.state.phase = "running";
assert.equal(await executeCommandInput({ value: "/quit", context }), true);
assert.equal(events.some((entry) => entry[0] === "exit"), false);
assert.ok(events.some((entry) => entry[0] === "system" && String(entry[1]).includes("Run in progress")));

events.length = 0;
const handledUnknown = await executeCommandInput({ value: "/does-not-exist", context });
assert.equal(handledUnknown, true);
assert.ok(events.some((entry) => entry[0] === "error" && String(entry[1]).includes("Unknown command")));

const handledPlain = await executeCommandInput({ value: "plain text", context });
assert.equal(handledPlain, false);

console.log("tui command smoke: ok");
