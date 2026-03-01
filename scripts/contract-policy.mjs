import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";

import { runMockService } from "../dist/run/run-service.js";
import { formatVerifyReport, verifyRunDir } from "../dist/tools/verify-run.js";

const tempRoot = resolve(tmpdir(), `arbiter-contract-policy-${Date.now()}`);
const runsWarnDir = resolve(tempRoot, "runs_warn");
const runsExcludeDir = resolve(tempRoot, "runs_exclude");
const runsFailDir = resolve(tempRoot, "runs_fail");
mkdirSync(runsWarnDir, { recursive: true });
mkdirSync(runsExcludeDir, { recursive: true });
mkdirSync(runsFailDir, { recursive: true });

const config = JSON.parse(readFileSync(resolve("resources/templates/default.config.json"), "utf8"));
config.execution.k_max = 4;
config.execution.batch_size = 2;
config.execution.workers = 1;
config.execution.k_min = 0;
config.execution.stop_mode = "advisor";
const configPath = resolve(tempRoot, "arbiter.config.json");
writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");

const getSingleRunDir = (runsDir) => {
  const entries = readdirSync(runsDir);
  if (entries.length !== 1) {
    throw new Error(`Expected exactly 1 run dir under ${runsDir}, got ${entries.length}`);
  }
  return resolve(runsDir, entries[0]);
};

const readManifest = (runDir) =>
  JSON.parse(readFileSync(resolve(runDir, "manifest.json"), "utf8"));

const readTrialRecords = (runDir) => {
  const raw = readFileSync(resolve(runDir, "trials.jsonl"), "utf8").trim();
  if (!raw) {
    return [];
  }
  return raw
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
};

const countParseStatus = (records, status) =>
  records.filter((record) => record?.parsed?.parse_status === status).length;

const runMock = async (policy, outDir) =>
  runMockService({
    configPath,
    assetRoot: resolve("."),
    runsDir: outDir,
    quiet: true,
    debug: false,
    warningSink: { warn: () => {} },
    policy: {
      contractFailurePolicy: policy
    }
  });

try {
  const warnResult = await runMock("warn", runsWarnDir);
  const warnRunDir = warnResult.runDir;
  const warnManifest = readManifest(warnRunDir);
  const warnTrials = readTrialRecords(warnRunDir);
  const warnFallbackCount = countParseStatus(warnTrials, "fallback");
  if (warnManifest.policy?.contract_failure_policy !== "warn") {
    throw new Error("Warn manifest policy snapshot mismatch");
  }
  if (warnFallbackCount === 0) {
    throw new Error("Expected fallback parse records in warn policy run");
  }
  if (warnManifest.k_eligible <= 0) {
    throw new Error("Warn policy should keep fallback records eligible");
  }
  const warnVerify = verifyRunDir(warnRunDir);
  if (!warnVerify.ok) {
    throw new Error(`verify should pass for warn policy run:\n${formatVerifyReport(warnVerify)}`);
  }

  const excludeResult = await runMock("exclude", runsExcludeDir);
  const excludeRunDir = excludeResult.runDir;
  const excludeManifest = readManifest(excludeRunDir);
  const excludeTrials = readTrialRecords(excludeRunDir);
  const excludeFallbackCount = countParseStatus(excludeTrials, "fallback");
  if (excludeManifest.policy?.contract_failure_policy !== "exclude") {
    throw new Error("Exclude manifest policy snapshot mismatch");
  }
  if (excludeFallbackCount === 0) {
    throw new Error("Expected fallback parse records in exclude policy run");
  }
  if (excludeManifest.k_eligible !== 0) {
    throw new Error(`Exclude policy should remove fallback records from eligibility, got ${excludeManifest.k_eligible}`);
  }
  const excludeVerify = verifyRunDir(excludeRunDir);
  if (!excludeVerify.ok) {
    throw new Error(`verify should pass for exclude policy run:\n${formatVerifyReport(excludeVerify)}`);
  }

  let failError = null;
  try {
    await runMock("fail", runsFailDir);
  } catch (error) {
    failError = error;
  }
  if (!(failError instanceof Error)) {
    throw new Error("Expected fail policy run to throw an error");
  }
  if (!/Contract parse failures/i.test(failError.message)) {
    throw new Error(`Unexpected fail policy error: ${failError.message}`);
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
  const failVerify = verifyRunDir(failRunDir);
  if (!failVerify.ok) {
    throw new Error(`verify should pass for fail policy run:\n${formatVerifyReport(failVerify)}`);
  }
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}

console.log("Contract failure policy smoke test OK");
