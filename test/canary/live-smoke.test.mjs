import assert from "node:assert/strict";
import test from "node:test";

import { runNodeScript } from "../helpers/workspace.mjs";

test("live smoke stays green or skips cleanly when credentials are absent", { concurrency: false }, () => {
  const result = runNodeScript("scripts/live-smoke.mjs");
  assert.equal(result.status, 0, `live smoke failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
});
