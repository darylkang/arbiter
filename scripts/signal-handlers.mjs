import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { EventBus } from "../dist/events/event-bus.js";
import { runMockService } from "../dist/run/run-service.js";
import { createEventWarningSink } from "../dist/utils/warnings.js";

const tempRoot = resolve(tmpdir(), `arbiter-signal-${Date.now()}`);
mkdirSync(tempRoot, { recursive: true });
const runsDir = resolve(tempRoot, "runs");
mkdirSync(runsDir, { recursive: true });

const catalog = JSON.parse(readFileSync(resolve("resources/catalog/models.json"), "utf8"));
const promptManifest = JSON.parse(readFileSync(resolve("resources/prompts/manifest.json"), "utf8"));
const persona = promptManifest.entries.find((entry) => entry.type === "participant_persona");
const protocol = promptManifest.entries.find((entry) => entry.type === "participant_protocol_template");
if (!catalog.models?.[0] || !persona || !protocol) {
  throw new Error("Missing catalog or prompt entries for signal handler test");
}

const config = {
  schema_version: "1.0.0",
  run: { run_id: "pending", seed: 42 },
  question: { text: "Signal handler test", question_id: "signal_test" },
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

const runOnce = async () => {
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
    warningSink,
    forwardWarningEvents: false
  });
};

const beforeSigint = process.listenerCount("SIGINT");
const beforeSigterm = process.listenerCount("SIGTERM");

try {
  await runOnce();
  await runOnce();

  const afterSigint = process.listenerCount("SIGINT");
  const afterSigterm = process.listenerCount("SIGTERM");

  if (beforeSigint !== afterSigint || beforeSigterm !== afterSigterm) {
    throw new Error(`Signal handlers leaked: SIGINT ${beforeSigint}->${afterSigint}, SIGTERM ${beforeSigterm}->${afterSigterm}`);
  }
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}

console.log("signal handlers cleanup: ok");
