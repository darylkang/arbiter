import assert from "node:assert/strict";

import { resolveCliMode } from "../dist/cli/intent.js";
import { listCommands, parseCommandInput } from "../dist/ui/transcript/commands/registry.js";

const modeInteractive = resolveCliMode([], true);
assert.equal(modeInteractive.shouldLaunchTUI, true);
assert.equal(modeInteractive.noCommand, true);

const modeHeadless = resolveCliMode(["--headless"], true);
assert.equal(modeHeadless.shouldLaunchTUI, false);
assert.equal(modeHeadless.noCommand, true);

const modeHelp = resolveCliMode(["--headless", "--help"], true);
assert.equal(modeHelp.shouldLaunchTUI, false);
assert.equal(modeHelp.filteredArgs.includes("--help"), true);

const modeNonTty = resolveCliMode([], false);
assert.equal(modeNonTty.shouldLaunchTUI, false);

const parsedRun = parseCommandInput("/run mock");
assert.deepEqual(parsedRun, { name: "run", args: ["mock"], raw: "/run mock" });

const parsedQuoted = parseCommandInput('/analyze "runs/sample id"');
assert.deepEqual(parsedQuoted, {
  name: "analyze",
  args: ["runs/sample id"],
  raw: '/analyze "runs/sample id"'
});

const commandNames = listCommands().map((command) => command.name).sort();
assert.deepEqual(commandNames, ["analyze", "help", "new", "quit", "receipt", "report", "run", "verify"]);

console.log("tui intent + registry: ok");
