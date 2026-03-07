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

const filterAllowedMatches = (matches, allowedFiles) =>
  matches
    .split("\n")
    .filter(Boolean)
    .filter((line) => {
      const file = line.split(":", 1)[0];
      return !allowedFiles.has(file);
    })
    .join("\n");

const assertNoDisallowedMatches = (name, pattern, paths, allowedFiles, extraArgs = []) => {
  const matches = runRipgrep(pattern, paths, extraArgs);
  const disallowed = filterAllowedMatches(matches, allowedFiles);
  assert.equal(disallowed, "", `${name}:\n${disallowed}`);
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

const APPROVED_UI_WRITE_SEAMS = new Set([
  "src/ui/wizard/frame-manager.ts",
  "src/ui/run-lifecycle-hooks.ts"
]);

const APPROVED_UI_ANSI_SEAMS = new Set([
  "src/ui/fmt.ts",
  "src/ui/wizard/frame-manager.ts",
  "src/ui/run-lifecycle-hooks.ts"
]);

assertNoDisallowedMatches(
  "Direct stdout writes must stay inside approved TUI runtime seams",
  "(?:process\\.(?:stdout|stderr)|output)\\.write\\s*\\(",
  ["src/ui"],
  APPROVED_UI_WRITE_SEAMS
);

assertNoDisallowedMatches(
  "Raw ANSI escapes must stay inside approved TUI runtime seams",
  "\\\\x1b\\[|\\\\u001b\\[",
  ["src/ui"],
  APPROVED_UI_ANSI_SEAMS
);

assertNoMatches(
  "Alternate-screen control sequences are forbidden in the TUI runtime",
  "\\?1049[hl]",
  ["src/ui"]
);

console.log("architecture guard: ok");
