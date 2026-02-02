import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const run = (args) => {
  const result = spawnSync("node", ["dist/cli/index.js", ...args], {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env }
  });
  const stdout = result.stdout?.toString("utf8") ?? "";
  const stderr = result.stderr?.toString("utf8") ?? "";
  return { status: result.status ?? 0, stdout, stderr };
};

const noArgs = run([]);
assert.equal(noArgs.status, 0);
assert.match(noArgs.stdout, /Usage:/);

const headlessOnly = run(["--headless"]);
assert.equal(headlessOnly.status, 0);
assert.match(headlessOnly.stdout, /Usage:/);

console.log("ui headless smoke: ok");
