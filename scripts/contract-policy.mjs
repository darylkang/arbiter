import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";

const tempRoot = resolve(tmpdir(), `arbiter-contract-policy-${Date.now()}`);
const runsWarnDir = resolve(tempRoot, "runs_warn");
const runsExcludeDir = resolve(tempRoot, "runs_exclude");
const runsFailDir = resolve(tempRoot, "runs_fail");
mkdirSync(runsWarnDir, { recursive: true });
mkdirSync(runsExcludeDir, { recursive: true });
mkdirSync(runsFailDir, { recursive: true });

const config = JSON.parse(readFileSync(resolve("templates/default.config.json"), "utf8"));
config.execution.k_max = 4;
config.execution.batch_size = 2;
config.execution.workers = 1;
config.execution.k_min = 0;
config.execution.stop_mode = "advisor";
const configPath = resolve(tempRoot, "arbiter.config.json");
writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");

const runMock = (policy, outDir) =>
  spawnSync(
    "node",
    [
      "dist/cli/index.js",
      "mock-run",
      "--config",
      configPath,
      "--out",
      outDir,
      "--quiet",
      "--contract-failure",
      policy
    ],
    { encoding: "utf8" }
  );

const runVerify = (runDir) =>
  spawnSync("node", ["dist/cli/index.js", "verify", runDir], {
    encoding: "utf8"
  });

const getSingleRunDir = (runsDir) => {
  const entries = readdirSync(runsDir);
  if (entries.length !== 1) {
    throw new Error(`Expected exactly 1 run dir under ${runsDir}, got ${entries.length}`);
  }
  return resolve(runsDir, entries[0]);
};

const readManifest = (runDir) =>
  JSON.parse(readFileSync(resolve(runDir, "manifest.json"), "utf8"));

const readParsedRecords = (runDir) => {
  const raw = readFileSync(resolve(runDir, "parsed.jsonl"), "utf8").trim();
  if (!raw) {
    return [];
  }
  return raw
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
};

const countParseStatus = (records, status) =>
  records.filter((record) => record.parse_status === status).length;

const warnResult = runMock("warn", runsWarnDir);
if (warnResult.status !== 0) {
  throw new Error(`Expected warn policy to succeed, got exit ${warnResult.status}`);
}
const warnRunDir = getSingleRunDir(runsWarnDir);
const warnManifest = readManifest(warnRunDir);
const warnParsed = readParsedRecords(warnRunDir);
const warnFallbackCount = countParseStatus(warnParsed, "fallback");
if (warnManifest.policy?.contract_failure_policy !== "warn") {
  throw new Error("Warn manifest policy snapshot mismatch");
}
if (warnFallbackCount === 0) {
  throw new Error("Expected fallback parse records in warn policy run");
}
if (warnManifest.k_eligible <= 0) {
  throw new Error("Warn policy should keep fallback records eligible");
}
const warnVerify = runVerify(warnRunDir);
if (warnVerify.status !== 0) {
  throw new Error(`verify should pass for warn policy run. Output:\n${warnVerify.stdout}\n${warnVerify.stderr}`);
}

const excludeResult = runMock("exclude", runsExcludeDir);
if (excludeResult.status !== 0) {
  throw new Error(`Expected exclude policy to succeed, got exit ${excludeResult.status}`);
}
const excludeRunDir = getSingleRunDir(runsExcludeDir);
const excludeManifest = readManifest(excludeRunDir);
const excludeParsed = readParsedRecords(excludeRunDir);
const excludeFallbackCount = countParseStatus(excludeParsed, "fallback");
if (excludeManifest.policy?.contract_failure_policy !== "exclude") {
  throw new Error("Exclude manifest policy snapshot mismatch");
}
if (excludeFallbackCount === 0) {
  throw new Error("Expected fallback parse records in exclude policy run");
}
if (excludeManifest.k_eligible !== 0) {
  throw new Error(`Exclude policy should remove fallback records from eligibility, got ${excludeManifest.k_eligible}`);
}
const excludeVerify = runVerify(excludeRunDir);
if (excludeVerify.status !== 0) {
  throw new Error(`verify should pass for exclude policy run. Output:\n${excludeVerify.stdout}\n${excludeVerify.stderr}`);
}

const failResult = runMock("fail", runsFailDir);
if (failResult.status === 0) {
  throw new Error("Expected fail policy to exit non-zero");
}
const failRunDir = getSingleRunDir(runsFailDir);
const failManifest = readManifest(failRunDir);
if (failManifest.policy?.contract_failure_policy !== "fail") {
  throw new Error("Fail manifest policy snapshot mismatch");
}
if (failManifest.stop_reason !== "error") {
  throw new Error(`Fail policy should set stop_reason=error, got ${failManifest.stop_reason}`);
}
if (failManifest.incomplete !== true) {
  throw new Error("Fail policy should mark run incomplete");
}
if (typeof failManifest.notes !== "string" || !failManifest.notes.includes("Contract parse failures")) {
  throw new Error("Fail policy should record contract parse failure details in manifest notes");
}
const failVerify = runVerify(failRunDir);
if (failVerify.status !== 0) {
  throw new Error(`verify should pass for fail policy run. Output:\n${failVerify.stdout}\n${failVerify.stderr}`);
}

rmSync(tempRoot, { recursive: true, force: true });
console.log("Contract failure policy smoke test OK");
