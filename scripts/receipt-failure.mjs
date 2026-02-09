import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { validateManifest } from "../dist/config/schema-validation.js";

const tempRoot = resolve(tmpdir(), `arbiter-receipt-fail-${Date.now()}`);
const runsDir = resolve(tempRoot, "runs");
mkdirSync(runsDir, { recursive: true });

const catalog = JSON.parse(readFileSync(resolve("resources/catalog/models.json"), "utf8"));
const promptManifest = JSON.parse(readFileSync(resolve("resources/prompts/manifest.json"), "utf8"));

const personas = promptManifest.entries.filter(
  (entry) => entry.type === "participant_persona"
);
const protocols = promptManifest.entries.filter(
  (entry) => entry.type === "participant_protocol_template"
);

if (catalog.models.length < 1 || personas.length < 1 || protocols.length < 1) {
  throw new Error("Not enough catalog/prompt entries for receipt failure test");
}

const config = {
  schema_version: "1.0.0",
  run: { run_id: "pending", seed: 424242 },
  question: { text: "Receipt failure prompt", question_id: "receipt_fail_q1" },
  sampling: {
    models: [{ model: catalog.models[0].slug, weight: 1 }],
    personas: [{ persona: personas[0].id, weight: 1 }],
    protocols: [{ protocol: protocols[0].id, weight: 1 }]
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
    k_max: 2,
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

try {
  execSync(`node dist/cli/index.js run --config ${configPath} --out ${runsDir} --debug`, {
    stdio: "ignore",
    env: { ...process.env, ARBITER_RECEIPT_FAIL: "1" }
  });

  const runDirs = readdirSync(runsDir);
  if (runDirs.length !== 1) {
    throw new Error(`Expected 1 run dir, got ${runDirs.length}`);
  }

  const runDir = resolve(runsDir, runDirs[0]);
  const manifestPath = resolve(runDir, "manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (!validateManifest(manifest)) {
    throw new Error("Manifest failed schema validation in receipt failure test");
  }

  if (existsSync(resolve(runDir, "receipt.txt"))) {
    throw new Error("receipt.txt should not exist when write fails");
  }

  const artifactPaths = manifest.artifacts?.entries?.map((entry) => entry.path) ?? [];
  if (artifactPaths.includes("receipt.txt")) {
    throw new Error("Manifest incorrectly includes receipt.txt after failure");
  }
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}

console.log("Receipt failure test OK");
