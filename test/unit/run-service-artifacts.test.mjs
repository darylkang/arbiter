import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { runMockService, runResolveService } from "../../dist/run/run-service.js";
import { createUiRunLifecycleHooks } from "../../dist/ui/run-lifecycle-hooks.js";

const REPO_ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const QUICKSTART_TEMPLATE_PATH = resolve(
  REPO_ROOT,
  "resources/templates/quickstart_independent.config.json"
);
const PACKAGE_VERSION = JSON.parse(
  readFileSync(resolve(REPO_ROOT, "package.json"), "utf8")
).version;

const noopWarningSink = {
  warn() {}
};

const normalizePath = (value) => value.replace(/^\/private/, "");

const listFilesRecursive = (root, dir = root) => {
  const results = [];
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...listFilesRecursive(root, fullPath));
      continue;
    }
    results.push(relative(root, fullPath).replace(/\\/g, "/"));
  }
  return results.sort();
};

const countJsonlLines = (filePath) => {
  const text = readFileSync(filePath, "utf8").trim();
  if (!text) {
    return 0;
  }
  return text.split("\n").length;
};

const withTempWorkspace = async (fn) => {
  const cwd = mkdtempSync(join(tmpdir(), "arbiter-run-service-test-"));
  const previousCwd = process.cwd();
  process.chdir(cwd);
  try {
    await fn(cwd);
  } finally {
    process.chdir(previousCwd);
    rmSync(cwd, { recursive: true, force: true });
  }
};

test("runResolveService writes resolve-only artifacts using asset-root package metadata", { concurrency: false }, async () => {
  await withTempWorkspace(async (cwd) => {
    const template = JSON.parse(readFileSync(QUICKSTART_TEMPLATE_PATH, "utf8"));
    writeFileSync(
      join(cwd, "arbiter.config.json"),
      `${JSON.stringify(template, null, 2)}\n`,
      "utf8"
    );

    const result = runResolveService({
      configPath: "arbiter.config.json",
      assetRoot: REPO_ROOT,
      runsDir: "runs",
      warningSink: noopWarningSink
    });

    assert.equal(existsSync(join(result.runDir, "config.resolved.json")), true);
    assert.equal(existsSync(join(result.runDir, "manifest.json")), true);
    assert.deepEqual(listFilesRecursive(result.runDir), [
      "config.resolved.json",
      "manifest.json"
    ]);

    const manifest = JSON.parse(
      readFileSync(join(result.runDir, "manifest.json"), "utf8")
    );
    assert.equal(manifest.arbiter_version, PACKAGE_VERSION);
    assert.equal(manifest.stopping_mode, "resolve_only");
  });
});

test("runMockService writes complete artifact set with manifest/count consistency", { concurrency: false }, async () => {
  await withTempWorkspace(async (cwd) => {
    const template = JSON.parse(readFileSync(QUICKSTART_TEMPLATE_PATH, "utf8"));
    template.execution.k_max = 4;
    template.execution.k_min = 0;
    template.execution.batch_size = 2;
    template.execution.workers = 2;
    template.question.question_id = "qa_artifact_contract";
    writeFileSync(
      join(cwd, "arbiter.config.json"),
      `${JSON.stringify(template, null, 2)}\n`,
      "utf8"
    );

    const result = await runMockService({
      configPath: "arbiter.config.json",
      assetRoot: REPO_ROOT,
      runsDir: "runs",
      quiet: true,
      debug: false,
      hooks: createUiRunLifecycleHooks(),
      receiptMode: "writeOnly",
      warningSink: noopWarningSink
    });

    const runDir = result.runDir;
    const files = listFilesRecursive(runDir);

    const requiredFiles = [
      "aggregates.json",
      "config.resolved.json",
      "convergence_trace.jsonl",
      "embeddings.arrow",
      "embeddings.provenance.json",
      "manifest.json",
      "parsed.jsonl",
      "receipt.txt",
      "trial_plan.jsonl",
      "trials.jsonl"
    ];
    for (const required of requiredFiles) {
      assert.equal(
        files.includes(required),
        true,
        `expected artifact ${required} in ${files.join(", ")}`
      );
    }

    assert.equal(files.some((path) => path.endsWith(".tmp")), false);

    const manifest = JSON.parse(readFileSync(join(runDir, "manifest.json"), "utf8"));
    const resolvedConfig = JSON.parse(readFileSync(join(runDir, "config.resolved.json"), "utf8"));

    assert.equal(normalizePath(runDir).startsWith(normalizePath(resolve(cwd, "runs"))), true);
    assert.equal(manifest.run_id, result.runId);
    assert.equal(manifest.k_planned, resolvedConfig.execution.k_max);
    assert.equal(manifest.k_attempted, result.kAttempted);
    assert.equal(manifest.k_eligible, result.kEligible);
    assert.equal(typeof manifest.plan_sha256, "string");
    assert.equal(manifest.plan_sha256.length, 64);

    const trialPlanCount = countJsonlLines(join(runDir, "trial_plan.jsonl"));
    const trialCount = countJsonlLines(join(runDir, "trials.jsonl"));
    const parsedCount = countJsonlLines(join(runDir, "parsed.jsonl"));

    assert.equal(trialPlanCount, resolvedConfig.execution.k_max);
    assert.equal(trialCount, result.kAttempted);
    assert.equal(parsedCount, result.kAttempted);

    const artifactPaths = manifest.artifacts.entries.map((entry) => entry.path).sort();
    assert.equal(artifactPaths.includes("receipt.txt"), true);
    assert.equal(artifactPaths.includes("embeddings.arrow"), true);
    assert.equal(artifactPaths.includes("embeddings.provenance.json"), true);
  });
});

test("runMockService rejects when contract_failure_policy is fail and parse failures occur", { concurrency: false }, async () => {
  await withTempWorkspace(async (cwd) => {
    const template = JSON.parse(readFileSync(QUICKSTART_TEMPLATE_PATH, "utf8"));
    template.execution.k_max = 2;
    template.execution.k_min = 0;
    template.execution.batch_size = 1;
    template.execution.workers = 1;
    template.question.question_id = "qa_contract_fail_policy";
    writeFileSync(
      join(cwd, "arbiter.config.json"),
      `${JSON.stringify(template, null, 2)}\n`,
      "utf8"
    );

    await assert.rejects(
      () =>
        runMockService({
          configPath: "arbiter.config.json",
          assetRoot: REPO_ROOT,
          runsDir: "runs",
          quiet: true,
          debug: false,
          warningSink: noopWarningSink,
          policy: {
            contractFailurePolicy: "fail"
          }
        }),
      /Contract parse failures:/i
    );
  });
});

test("runMockService with contract_failure_policy=exclude completes with zero eligible embeddings", { concurrency: false }, async () => {
  await withTempWorkspace(async (cwd) => {
    const template = JSON.parse(readFileSync(QUICKSTART_TEMPLATE_PATH, "utf8"));
    template.execution.k_max = 3;
    template.execution.k_min = 0;
    template.execution.batch_size = 1;
    template.execution.workers = 1;
    template.question.question_id = "qa_contract_exclude_policy";
    writeFileSync(
      join(cwd, "arbiter.config.json"),
      `${JSON.stringify(template, null, 2)}\n`,
      "utf8"
    );

    const result = await runMockService({
      configPath: "arbiter.config.json",
      assetRoot: REPO_ROOT,
      runsDir: "runs",
      quiet: true,
      debug: false,
      warningSink: noopWarningSink,
      policy: {
        contractFailurePolicy: "exclude"
      }
    });

    assert.equal(result.kAttempted, 3);
    assert.equal(result.kEligible, 0);
    assert.equal(result.embeddingsProvenance.status, "not_generated");
    assert.equal(
      result.embeddingsProvenance.reason,
      "no_successful_embeddings"
    );

    const embeddingsProvenance = JSON.parse(
      readFileSync(join(result.runDir, "embeddings.provenance.json"), "utf8")
    );
    assert.equal(embeddingsProvenance.status, "not_generated");
  });
});
