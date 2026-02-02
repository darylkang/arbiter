import assert from "node:assert/strict";
import { resolveCliMode } from "../dist/cli/intent.js";
import { resolveWelcomeAction } from "../dist/ui/premium/routing.js";

const modeWizard = resolveCliMode([], true);
assert.equal(modeWizard.shouldLaunchWizard, true);
assert.equal(modeWizard.noCommand, true);

const modeHeadless = resolveCliMode(["--headless"], true);
assert.equal(modeHeadless.shouldLaunchWizard, false);
assert.equal(modeHeadless.noCommand, true);

const modeHelp = resolveCliMode(["--headless", "--help"], true);
assert.equal(modeHelp.shouldLaunchWizard, false);
assert.equal(modeHelp.filteredArgs.includes("--help"), true);

const modeForceWizard = resolveCliMode(["--wizard"], false);
assert.equal(modeForceWizard.shouldLaunchWizard, true);

const outcomeNew = resolveWelcomeAction("new");
assert.equal(outcomeNew.kind, "screen");
if (outcomeNew.kind === "screen") {
  assert.equal(outcomeNew.screen, "question");
  assert.equal(outcomeNew.runMode, "live");
}

const outcomeLearn = resolveWelcomeAction("learn");
assert.equal(outcomeLearn.kind, "screen");
if (outcomeLearn.kind === "screen") {
  assert.equal(outcomeLearn.runMode, "mock");
}

const outcomeHelp = resolveWelcomeAction("help");
assert.equal(outcomeHelp.kind, "help");

console.log("ui routing: ok");
