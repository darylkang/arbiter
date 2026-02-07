import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";

const runRipgrep = (pattern, paths, extraArgs = []) => {
  const existingPaths = paths.filter((path) => existsSync(path));
  if (existingPaths.length === 0) {
    return "";
  }

  try {
    return execFileSync("rg", ["-n", ...extraArgs, pattern, ...existingPaths], {
      encoding: "utf8"
    }).trim();
  } catch (error) {
    if (typeof error === "object" && error !== null && "status" in error) {
      const status = error.status;
      if (status === 1) {
        return "";
      }
    }
    throw error;
  }
};

const assertNoMatches = (name, pattern, paths, extraArgs = []) => {
  const matches = runRipgrep(pattern, paths, extraArgs);
  assert.equal(matches, "", `${name}:\n${matches}`);
};

assertNoMatches(
  "Math.random is forbidden in deterministic modules",
  "Math\\.random",
  ["src/core", "src/engine", "src/clustering", "src/planning"]
);

assertNoMatches(
  "Engine and run layers must not import UI modules",
  "from\\s+[\"'][^\"']*ui/",
  ["src/engine", "src/run"]
);

assertNoMatches(
  "Dead manifest.updated event must not be emitted",
  "type:\\s*[\"']manifest\\.updated[\"']",
  ["src/engine", "src/clustering", "src/run", "src/artifacts"]
);

console.log("architecture guard: ok");
