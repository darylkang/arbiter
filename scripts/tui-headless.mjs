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
assert.match(noArgs.stdout, /Commands:/);
assert.match(noArgs.stdout, /arbiter run/);
assert.doesNotMatch(noArgs.stdout, /--headless/);

const rootHelp = run(["--help"]);
assert.equal(rootHelp.status, 0);
assert.match(rootHelp.stdout, /Global flags:/);

console.log("tui headless smoke: ok");
