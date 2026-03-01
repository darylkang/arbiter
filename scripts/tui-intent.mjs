import assert from "node:assert/strict";

import { resolveCliMode } from "../dist/cli/intent.js";

const modeInteractive = resolveCliMode([], true);
assert.equal(modeInteractive.shouldLaunchWizard, true);
assert.equal(modeInteractive.noCommand, true);

const modeHelp = resolveCliMode(["--help"], true);
assert.equal(modeHelp.shouldLaunchWizard, false);
assert.equal(modeHelp.noCommand, false);

const modeNonTty = resolveCliMode([], false);
assert.equal(modeNonTty.shouldLaunchWizard, false);
assert.equal(modeNonTty.noCommand, true);

const modeRun = resolveCliMode(["run", "--config", "arbiter.config.json"], true);
assert.equal(modeRun.shouldLaunchWizard, false);
assert.equal(modeRun.noCommand, false);

console.log("tui intent: ok");
