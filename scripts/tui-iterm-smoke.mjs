import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const CLI_ENTRY = resolve(REPO_ROOT, "dist/cli/index.js");
const IS_DARWIN = process.platform === "darwin";

const delay = (ms) => new Promise((resolveDelay) => setTimeout(resolveDelay, ms));

const runAppleScript = (lines) => {
  const result = spawnSync("osascript", lines.flatMap((line) => ["-e", line]), {
    encoding: "utf8"
  });
  if (result.status !== 0) {
    throw new Error(result.stderr?.trim() || result.stdout?.trim() || "osascript failed");
  }
  return result.stdout ?? "";
};

const ensureITerm = () => runAppleScript(['tell application "iTerm" to version']).trim();

const createMockConfig = (cwd, overrides = {}) => {
  const initResult = spawnSync("node", [CLI_ENTRY, "init"], {
    cwd,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env }
  });
  assert.equal(initResult.status, 0, `arbiter init failed: ${initResult.stderr?.toString("utf8") ?? ""}`);

  const configPath = join(cwd, "arbiter.config.json");
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  config.execution.k_max = 3;
  config.execution.k_min = 0;
  config.execution.batch_size = 1;
  config.execution.workers = 1;
  config.question.text = "iTerm smoke question";
  config.question.question_id = "iterm_smoke_q1";
  config.measurement.clustering.enabled = false;
  Object.assign(config.execution, overrides.execution ?? {});
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  return configPath;
};

const openITermWindow = (command) => {
  runAppleScript([
    'tell application "iTerm"',
    'activate',
    'set newWindow to (create window with default profile)',
    'tell current session of newWindow',
    `write text ${JSON.stringify(command)}`,
    'end tell',
    'end tell'
  ]);
};

const closeITermWindow = () => {
  runAppleScript([
    'tell application "iTerm"',
    'if (count of windows) > 0 then close current window',
    'end tell'
  ]);
};

const currentSessionContents = () =>
  runAppleScript([
    'tell application "iTerm"',
    'if (count of windows) = 0 then return ""',
    'set sessionText to contents of current session of current window',
    'end tell',
    'return sessionText'
  ]);

const sendKeyCode = (code) => {
  runAppleScript([
    'tell application "iTerm" to activate',
    'tell application "System Events"',
    `key code ${code}`,
    'end tell'
  ]);
};

const waitForSessionText = async (needle, timeoutMs = 20000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const contents = currentSessionContents();
    if (contents.includes(needle)) {
      return contents;
    }
    await delay(250);
  }
  throw new Error(`Timed out waiting for iTerm contents to include: ${needle}`);
};

const countMatches = (text, pattern) => (text.match(pattern) || []).length;

const runDashboardSmoke = async () => {
  const cwd = mkdtempSync(join(tmpdir(), "arbiter-iterm-dashboard-"));
  try {
    const configPath = createMockConfig(cwd);
    openITermWindow(`cd ${JSON.stringify(REPO_ROOT)} && ARBITER_MOCK_DELAY_MS=120 node ${JSON.stringify(CLI_ENTRY)} run --config ${JSON.stringify(configPath)} --dashboard`);
    const contents = await waitForSessionText("Run complete.", 30000);
    const result = {
      path: "dashboard",
      progress: countMatches(contents, /── PROGRESS/g),
      monitoring: countMatches(contents, /run \/ monitoring/g),
      receipt: countMatches(contents, /── RECEIPT/g)
    };
    assert.equal(result.progress, 1, `expected one dashboard snapshot, saw ${result.progress}`);
    assert.equal(result.monitoring, 1, `expected one monitoring strip, saw ${result.monitoring}`);
    assert.equal(result.receipt, 1, `expected one receipt, saw ${result.receipt}`);
    return result;
  } finally {
    closeITermWindow();
    rmSync(cwd, { recursive: true, force: true });
  }
};

const runWizardSmoke = async () => {
  const cwd = mkdtempSync(join(tmpdir(), "arbiter-iterm-wizard-"));
  try {
    createMockConfig(cwd);
    openITermWindow(`cd ${JSON.stringify(cwd)} && node ${JSON.stringify(CLI_ENTRY)}`);
    await waitForSessionText("Choose how to start", 20000);
    sendKeyCode(36); // enter: run existing config
    await delay(500);
    sendKeyCode(125); // down arrow: mock mode
    await delay(250);
    sendKeyCode(36); // enter
    await waitForSessionText("Review and Confirm", 20000);
    sendKeyCode(36); // run now
    const contents = await waitForSessionText("Run complete.", 30000);
    const result = {
      path: "wizard",
      status: countMatches(contents, /› arbiter  setup \/ review/g),
      brand: countMatches(contents, /A R B I T E R/g),
      entry: countMatches(contents, /✔  Entry Path/g),
      progress: countMatches(contents, /── PROGRESS/g),
      monitoring: countMatches(contents, /run \/ monitoring/g),
      receipt: countMatches(contents, /── RECEIPT/g)
    };
    assert.equal(result.status, 1, `expected one persisted Stage 0 status strip, saw ${result.status}`);
    assert.equal(result.brand, 1, `expected one persisted header, saw ${result.brand}`);
    assert.equal(result.entry, 1, `expected one frozen wizard summary, saw ${result.entry}`);
    assert.equal(result.progress, 1, `expected one dashboard snapshot, saw ${result.progress}`);
    assert.equal(result.monitoring, 1, `expected one monitoring strip, saw ${result.monitoring}`);
    assert.equal(result.receipt, 1, `expected one receipt, saw ${result.receipt}`);
    return result;
  } finally {
    closeITermWindow();
    rmSync(cwd, { recursive: true, force: true });
  }
};

const main = async () => {
  if (!IS_DARWIN) {
    console.log(JSON.stringify({ skipped: true, reason: "macOS only" }, null, 2));
    return;
  }

  const version = ensureITerm();
  const dashboard = await runDashboardSmoke();
  const wizard = await runWizardSmoke();
  console.log(JSON.stringify({ iTermVersion: version, dashboard, wizard }, null, 2));
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
