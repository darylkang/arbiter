import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { EventBus } from "../dist/events/event-bus.js";
import { runMockService } from "../dist/run/run-service.js";
import { createEventWarningSink } from "../dist/utils/warnings.js";

const tempRoot = resolve(tmpdir(), `arbiter-ui-warn-${Date.now()}`);
mkdirSync(tempRoot, { recursive: true });
const runsDir = resolve(tempRoot, "runs");
mkdirSync(runsDir, { recursive: true });

const catalog = JSON.parse(readFileSync(resolve("catalog/models.json"), "utf8"));
const promptManifest = JSON.parse(readFileSync(resolve("prompts/manifest.json"), "utf8"));
const persona = promptManifest.entries.find((entry) => entry.type === "participant_persona");
const protocol = promptManifest.entries.find((entry) => entry.type === "participant_protocol_template");
if (!catalog.models?.[0] || !persona || !protocol) {
  throw new Error("Missing catalog or prompt entries for UI warning sink test");
}

const config = {
  schema_version: "1.0.0",
  run: { run_id: "pending", seed: 7 },
  question: { text: "UI warning sink test", question_id: "ui_warn" },
  sampling: {
    models: [{ model: catalog.models[0].slug, weight: 1 }],
    personas: [{ persona: persona.id, weight: 1 }],
    protocols: [{ protocol: protocol.id, weight: 1 }]
  },
  protocol: {
    type: "independent",
    timeouts: {
      per_call_timeout_ms: 90000,
      per_call_max_retries: 2,
      total_trial_timeout_ms: 300000
    }
  },
  execution: {
    k_max: 1,
    batch_size: 1,
    workers: 1,
    retry_policy: { max_retries: 0, backoff_ms: 0 },
    stop_mode: "advisor",
    k_min: 0,
    k_min_count_rule: "k_eligible"
  },
  measurement: {
    embedding_model: "mock-embedding",
    embed_text_strategy: "outcome_only",
    novelty_threshold: 0.85,
    clustering: {
      enabled: false,
      algorithm: "online_leader",
      tau: 0.9,
      centroid_update_rule: "fixed_leader",
      cluster_limit: 500,
      stop_mode: "disabled"
    }
  },
  output: { runs_dir: "runs" }
};

const configPath = resolve(tempRoot, "arbiter.config.json");
writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");

let stdoutWrites = 0;
let stderrWrites = 0;
const originalStdout = process.stdout.write.bind(process.stdout);
const originalStderr = process.stderr.write.bind(process.stderr);
const originalWarn = console.warn;
const originalError = console.error;

process.stdout.write = (chunk, encoding, cb) => {
  stdoutWrites += 1;
  return originalStdout(chunk, encoding, cb);
};
process.stderr.write = (chunk, encoding, cb) => {
  stderrWrites += 1;
  return originalStderr(chunk, encoding, cb);
};
console.warn = () => {
  throw new Error("console.warn called during UI-style run");
};
console.error = () => {
  throw new Error("console.error called during UI-style run");
};

try {
  const bus = new EventBus();
  const warningSink = createEventWarningSink(bus);
  await runMockService({
    configPath,
    assetRoot: resolve(process.cwd()),
    runsDir,
    debug: false,
    quiet: true,
    bus,
    receiptMode: "skip",
    forceInk: true,
    warningSink,
    forwardWarningEvents: false
  });
} finally {
  process.stdout.write = originalStdout;
  process.stderr.write = originalStderr;
  console.warn = originalWarn;
  console.error = originalError;
}

if (stdoutWrites > 0 || stderrWrites > 0) {
  throw new Error(`Unexpected stdout/stderr writes: stdout=${stdoutWrites}, stderr=${stderrWrites}`);
}

rmSync(tempRoot, { recursive: true, force: true });
console.log("ui warning sink: ok");
