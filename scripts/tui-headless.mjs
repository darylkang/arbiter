import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const run = (args) => {
  const result = spawnSync("node", ["dist/cli/index.js", ...args], {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env }
  });
  return {
    status: result.status ?? 0,
    stdout: result.stdout?.toString("utf8") ?? "",
    stderr: result.stderr?.toString("utf8") ?? ""
  };
};

const noArgs = run([]);
assert.equal(noArgs.status, 0);
assert.match(noArgs.stdout, /Workflow:/);
assert.doesNotMatch(noArgs.stdout, /wizard/i);
assert.doesNotMatch(noArgs.stdout, /quickstart/);
assert.doesNotMatch(noArgs.stdout, /mock-run/);

const headlessOnly = run(["--headless"]);
assert.equal(headlessOnly.status, 0);
assert.match(headlessOnly.stdout, /Workflow:/);

console.log("tui headless smoke: ok");
