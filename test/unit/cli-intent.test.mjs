import assert from "node:assert/strict";
import test from "node:test";

import { resolveCliMode } from "../../src/cli/intent.ts";

test("resolveCliMode launches wizard only for tty root invocation", () => {
  assert.deepEqual(resolveCliMode([], true), {
    filteredArgs: [],
    noCommand: true,
    shouldLaunchWizard: true
  });

  assert.deepEqual(resolveCliMode([], false), {
    filteredArgs: [],
    noCommand: true,
    shouldLaunchWizard: false
  });

  assert.deepEqual(resolveCliMode(["--help"], true), {
    filteredArgs: ["--help"],
    noCommand: false,
    shouldLaunchWizard: false
  });
});
