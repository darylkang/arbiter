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

const help = run(["--help"]);
assert.equal(help.status, 0);
assert.equal(help.stdout.includes("/run"), false);
assert.equal(help.stdout.includes("/quit"), false);
assert.equal(help.stdout.includes("slash"), false);

console.log("tui command smoke: ok");
