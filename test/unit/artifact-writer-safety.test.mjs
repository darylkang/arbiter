import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { EventBus } from "../../dist/events/event-bus.js";
import { ArtifactWriter } from "../../dist/artifacts/artifact-writer.js";

test("ArtifactWriter emits warning instead of throwing when a handler fails", async () => {
  const runDir = mkdtempSync(join(tmpdir(), "arbiter-artifacts-test-"));
  const bus = new EventBus();
  const warnings = [];
  const unsubscribeWarning = bus.subscribe("warning.raised", (payload) => {
    warnings.push(payload);
  });

  const writer = new ArtifactWriter({
    runDir,
    runId: "run_test",
    resolvedConfig: {
      protocol: {
        decision_contract: null
      },
      measurement: {
        clustering: {
          enabled: false,
          stop_mode: "disabled"
        }
      }
    },
    debugEnabled: false,
    catalogVersion: "dev",
    catalogSha256: "test",
    promptManifestSha256: "test"
  });

  writer.attach(bus);

  assert.doesNotThrow(() => {
    bus.emit({
      type: "embedding.recorded",
      payload: {
        embedding_record: {
          trial_id: 1,
          embedding_status: "success"
        }
      }
    });
  });

  assert.equal(warnings.length, 1);
  assert.match(warnings[0].message, /ArtifactWriter handler failed/);
  assert.equal(warnings[0].source, "artifacts");

  writer.detach();
  unsubscribeWarning();
  await writer.close();
  rmSync(runDir, { recursive: true, force: true });
});
