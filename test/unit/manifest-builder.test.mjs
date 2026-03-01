import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  applyContractFailurePolicy,
  buildArtifactEntries,
  buildInitialManifest,
  readPackageVersion
} from "../../dist/artifacts/manifest-builder.js";

test("readPackageVersion returns explicit version and falls back when missing", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "arbiter-manifest-builder-"));
  try {
    const withVersion = join(tempDir, "with-version.json");
    const withoutVersion = join(tempDir, "without-version.json");

    writeFileSync(withVersion, JSON.stringify({ name: "arbiter", version: "9.9.9" }), "utf8");
    writeFileSync(withoutVersion, JSON.stringify({ name: "arbiter" }), "utf8");

    assert.equal(readPackageVersion(withVersion), "9.9.9");
    assert.equal(readPackageVersion(withoutVersion), "0.0.0");
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("buildArtifactEntries respects provenance, debug mode, clustering, and extras", () => {
  const baseCounts = {
    trialPlan: 3,
    trials: 3,
    monitoring: 2,
    embeddings: 2,
    embeddingSuccess: 2,
    embeddingFailed: 0,
    embeddingSkipped: 1,
    groupAssignments: 2
  };

  const jsonlFallbackEntries = buildArtifactEntries({
    debugEnabled: false,
    clusteringEnabled: true,
    counts: baseCounts,
    embeddingsProvenance: { status: "jsonl_fallback" },
    extraArtifacts: [{ path: "custom.txt" }]
  });
  const jsonlFallbackPaths = jsonlFallbackEntries.map((entry) => entry.path);
  assert.equal(jsonlFallbackPaths.includes("embeddings.jsonl"), true);
  assert.equal(jsonlFallbackPaths.includes("embeddings.arrow"), false);
  assert.equal(jsonlFallbackPaths.includes("groups/assignments.jsonl"), true);
  assert.equal(jsonlFallbackPaths.includes("groups/state.json"), true);
  assert.equal(jsonlFallbackPaths.includes("receipt.txt"), true);
  assert.equal(jsonlFallbackPaths.includes("custom.txt"), true);

  const arrowEntries = buildArtifactEntries({
    debugEnabled: false,
    clusteringEnabled: false,
    counts: baseCounts,
    embeddingsProvenance: { status: "arrow_generated" },
    extraArtifacts: []
  });
  const arrowPaths = arrowEntries.map((entry) => entry.path);
  assert.equal(arrowPaths.includes("embeddings.arrow"), true);
  assert.equal(arrowPaths.includes("embeddings.jsonl"), false);
});

test("applyContractFailurePolicy marks manifest incomplete when fail policy sees parse failures", () => {
  const manifest = {
    stop_reason: "completed",
    incomplete: false,
    notes: "preexisting-note"
  };

  applyContractFailurePolicy({
    manifest,
    resolvedConfig: {
      protocol: {
        decision_contract: { schema: { type: "object" } }
      }
    },
    policy: {
      strict: true,
      allow_free: false,
      allow_aliased: false,
      contract_failure_policy: "fail"
    },
    contractParseCounts: {
      fallback: 2,
      failed: 1
    }
  });

  assert.equal(manifest.stop_reason, "error");
  assert.equal(manifest.incomplete, true);
  assert.match(manifest.notes, /preexisting-note/);
  assert.match(manifest.notes, /fallback=2, failed=1/);
});

test("buildInitialManifest includes policy snapshot and default stop policy", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "arbiter-manifest-initial-"));
  try {
    const packageJsonPath = join(tempDir, "package.json");
    writeFileSync(packageJsonPath, JSON.stringify({ version: "1.2.3" }), "utf8");

    const resolvedConfig = {
      execution: {
        stop_mode: "enforcer",
        k_min: 6,
        k_min_count_rule: "eligible_only"
      }
    };

    const manifest = buildInitialManifest({
      payload: {
        run_id: "run_abc",
        started_at: "2025-01-01T00:00:00.000Z",
        resolved_config: resolvedConfig,
        debug_enabled: false,
        plan_sha256: "f".repeat(64),
        k_planned: 12
      },
      resolvedConfig,
      catalogVersion: "catalog-v1",
      catalogSha256: "a".repeat(64),
      promptManifestSha256: "b".repeat(64),
      packageJsonPath,
      policy: {
        strict: false,
        allow_free: true,
        allow_aliased: false,
        contract_failure_policy: "warn"
      }
    });

    assert.equal(manifest.arbiter_version, "1.2.3");
    assert.equal(manifest.run_id, "run_abc");
    assert.equal(manifest.k_min, 6);
    assert.equal(manifest.stop_policy.k_min_eligible, 6);
    assert.equal(manifest.stop_policy.novelty_epsilon, 0.05);
    assert.equal(manifest.stop_policy.similarity_threshold, 0.95);
    assert.equal(manifest.stop_policy.patience, 2);
    assert.equal(manifest.policy.contract_failure_policy, "warn");
    assert.equal(manifest.plan_sha256, "f".repeat(64));
    assert.equal(manifest.k_planned, 12);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});
