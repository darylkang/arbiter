import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import { tableFromIPC } from "apache-arrow";

import { validateTrial } from "../../src/config/schema-validation.ts";
import { runMockService } from "../../src/run/run-service.ts";
import { buildDebateSmokeConfig } from "../helpers/scenarios.mjs";
import { REPO_ROOT, readJsonl, withTempWorkspace, writeJson } from "../helpers/workspace.mjs";

const noopWarningSink = { warn() {} };

test("debate mock runs produce debate trials, transcripts, and embedding rows", { concurrency: false }, async () => {
  await withTempWorkspace("arbiter-debate-run-", async (cwd) => {
    const configPath = resolve(cwd, "arbiter.config.json");
    writeJson(
      configPath,
      buildDebateSmokeConfig({
        questionText: "Debate mock prompt",
        questionId: "mock_debate_q1",
        kMax: 4,
        batchSize: 2,
        workers: 2,
        participants: 2,
        rounds: 1
      })
    );

    const result = await runMockService({
      configPath,
      assetRoot: REPO_ROOT,
      runsDir: resolve(cwd, "runs"),
      quiet: true,
      debug: false,
      warningSink: noopWarningSink
    });

    const trials = readJsonl(resolve(result.runDir, "trials.jsonl"));
    for (const record of trials) {
      assert.equal(validateTrial(record), true);
      assert.equal(record.protocol, "debate");
      if (record.status === "success") {
        assert.equal(Array.isArray(record.calls), true);
        assert.equal(record.calls.length, 3);
        assert.equal(Array.isArray(record.transcript), true);
        assert.equal(record.transcript.length, 3);
        assert.equal(typeof record.transcript_hash, "string");
        assert.equal(typeof record.role_assignments?.A?.role_kind, "string");
        assert.equal(record.role_assignments?.A?.role_kind, "lead");
        assert.equal(record.role_assignments?.B?.role_kind, "challenger");
        assert.equal(record.transcript[0]?.slot, "A");
        assert.equal(record.transcript[0]?.role_kind, "lead");
        assert.equal(record.transcript[1]?.slot, "B");
        assert.equal(record.transcript[1]?.role_kind, "challenger");
        assert.equal(typeof record.parsed?.parse_status, "string");
      }
      if (!record.parsed) {
        continue;
      }
      if (record.parsed.parse_status === "success") {
        assert.equal(record.parsed.embed_text_source, "decision");
        assert.equal(["fenced", "unfenced"].includes(record.parsed.extraction_method), true);
      }
      if (record.parsed.parse_status === "fallback") {
        assert.equal(record.parsed.embed_text_source, "raw_content");
        assert.equal(record.parsed.extraction_method, "raw");
      }
    }

    const table = tableFromIPC(readFileSync(resolve(result.runDir, "embeddings.arrow")));
    assert.equal(table.numRows, 4);
  });
});

test("debate mock runs assign the full role taxonomy at P=4", { concurrency: false }, async () => {
  await withTempWorkspace("arbiter-debate-run-p4-", async (cwd) => {
    const configPath = resolve(cwd, "arbiter.config.json");
    writeJson(
      configPath,
      buildDebateSmokeConfig({
        questionText: "Debate mock prompt P4",
        questionId: "mock_debate_q2",
        kMax: 2,
        batchSize: 1,
        workers: 1,
        participants: 4,
        rounds: 1
      })
    );

    const result = await runMockService({
      configPath,
      assetRoot: REPO_ROOT,
      runsDir: resolve(cwd, "runs"),
      quiet: true,
      debug: false,
      warningSink: noopWarningSink
    });

    const trials = readJsonl(resolve(result.runDir, "trials.jsonl"));
    for (const record of trials) {
      assert.equal(record.protocol, "debate");
      assert.equal(record.role_assignments?.A?.role_kind, "lead");
      assert.equal(record.role_assignments?.B?.role_kind, "challenger");
      assert.equal(record.role_assignments?.C?.role_kind, "counter");
      assert.equal(record.role_assignments?.D?.role_kind, "auditor");
      assert.equal(record.transcript[0]?.role_kind, "lead");
      assert.equal(record.transcript[1]?.role_kind, "challenger");
      assert.equal(record.transcript[2]?.role_kind, "counter");
      assert.equal(record.transcript[3]?.role_kind, "auditor");
      assert.equal(record.calls?.length, 5);
      assert.equal(record.transcript?.length, 5);
    }
  });
});

test("debate mock runs preserve multi-round sequencing at P=2 R=2", { concurrency: false }, async () => {
  await withTempWorkspace("arbiter-debate-run-r2-", async (cwd) => {
    const configPath = resolve(cwd, "arbiter.config.json");
    writeJson(
      configPath,
      buildDebateSmokeConfig({
        questionText: "Debate mock prompt R2",
        questionId: "mock_debate_q3",
        kMax: 2,
        batchSize: 1,
        workers: 1,
        participants: 2,
        rounds: 2
      })
    );

    const result = await runMockService({
      configPath,
      assetRoot: REPO_ROOT,
      runsDir: resolve(cwd, "runs"),
      quiet: true,
      debug: false,
      warningSink: noopWarningSink
    });

    const trials = readJsonl(resolve(result.runDir, "trials.jsonl"));
    for (const record of trials) {
      assert.equal(record.protocol, "debate");
      assert.equal(record.calls?.length, 5);
      assert.equal(record.transcript?.length, 5);
      assert.deepEqual(
        record.transcript?.map((entry) => ({
          slot: entry.slot,
          role_kind: entry.role_kind,
          round: entry.round
        })),
        [
          { slot: "A", role_kind: "lead", round: 1 },
          { slot: "B", role_kind: "challenger", round: 1 },
          { slot: "A", role_kind: "lead", round: 2 },
          { slot: "B", role_kind: "challenger", round: 2 },
          { slot: "A", role_kind: "lead", round: 2 }
        ]
      );
    }
  });
});
