import assert from "node:assert/strict";

import { executeCommandInput } from "../dist/ui/transcript/commands/registry.js";

const events = [];
const context = {
  state: {
    hasApiKey: false,
    phase: "idle"
  },
  appendSystem: (message) => events.push(["system", message]),
  appendError: (message) => events.push(["error", message]),
  appendStatus: (message) => events.push(["status", message]),
  requestRender: () => events.push(["render", ""]),
  exit: () => events.push(["exit", ""]),
  startRun: async (mode) => events.push(["run", mode]),
  startNewFlow: () => events.push(["new", ""]),
  showReport: (runDir) => events.push(["report", runDir ?? ""]),
  showVerify: (runDir) => events.push(["verify", runDir ?? ""]),
  showReceipt: (runDir) => events.push(["receipt", runDir ?? ""]),
  analyzeRun: (runDir) => events.push(["analyze", runDir ?? ""])
};

const handledRun = await executeCommandInput({ value: "/run mock", context });
assert.equal(handledRun, true);
assert.deepEqual(events.find((entry) => entry[0] === "run"), ["run", "mock"]);

const handledUnknown = await executeCommandInput({ value: "/does-not-exist", context });
assert.equal(handledUnknown, true);
assert.ok(events.some((entry) => entry[0] === "error" && String(entry[1]).includes("unknown command")));

const handledPlain = await executeCommandInput({ value: "plain text", context });
assert.equal(handledPlain, false);

console.log("tui command smoke: ok");
