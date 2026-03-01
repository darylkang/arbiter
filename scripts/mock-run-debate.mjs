import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { tableFromIPC } from "apache-arrow";
import { validateTrial } from "../dist/config/schema-validation.js";

const tempRoot = resolve(tmpdir(), `arbiter-mock-debate-${Date.now()}`);
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

if (catalog.models.length < 1 || personas.length < 2 || protocols.length < 1) {
  throw new Error("Not enough catalog/prompt entries for debate run test");
}

const config = {
  schema_version: "1.0.0",
  run: { run_id: "pending", seed: 424242 },
  question: { text: "Debate mock prompt", question_id: "mock_debate_q1" },
  sampling: {
    models: [{ model: catalog.models[0].slug, weight: 1 }],
    personas: [
      { persona: personas[0].id, weight: 1 },
      { persona: personas[1].id, weight: 1 }
    ],
    protocols: [{ protocol: protocols[0].id, weight: 1 }]
  },
  protocol: {
    type: "debate_v1",
    participants: 2,
    rounds: 1,
    timeouts: {
      per_call_timeout_ms: 90000,
      per_call_max_retries: 2,
      total_trial_timeout_ms: 300000
    }
  },
  execution: {
    k_max: 4,
    batch_size: 2,
    workers: 2,
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
  execSync(`node dist/cli/index.js run --config ${configPath} --out ${runsDir}`, {
    stdio: "inherit"
  });

  const runDirs = readdirSync(runsDir);
  if (runDirs.length !== 1) {
    throw new Error(`Expected 1 run dir, got ${runDirs.length}`);
  }

  const runDir = resolve(runsDir, runDirs[0]);
  const trialsLines = readFileSync(resolve(runDir, "trials.jsonl"), "utf8")
    .trim()
    .split("\n")
    .filter(Boolean);

  for (const line of trialsLines) {
    const record = JSON.parse(line);
    if (!validateTrial(record)) {
      throw new Error("Trial record failed schema validation");
    }
    if (record.protocol !== "debate_v1") {
      throw new Error("Expected debate_v1 protocol in trial record");
    }
    if (record.status === "success") {
      if (!Array.isArray(record.calls) || record.calls.length !== 3) {
        throw new Error("Expected 3 calls for successful debate trial");
      }
      if (!Array.isArray(record.transcript) || record.transcript.length !== 3) {
        throw new Error("Expected 3 transcript entries for successful debate trial");
      }
      if (!record.parsed || typeof record.parsed.parse_status !== "string") {
        throw new Error("Expected parsed summary in trial record");
      }
    }
    if (!record.parsed) {
      continue;
    }
    if (record.parsed.parse_status === "success") {
      if (record.parsed.embed_text_source !== "decision") {
        throw new Error("Expected embed_text_source decision for structured parse");
      }
      if (!["fenced", "unfenced"].includes(record.parsed.extraction_method)) {
        throw new Error("Expected fenced or unfenced extraction method");
      }
    }
    if (record.parsed.parse_status === "fallback") {
      if (record.parsed.embed_text_source !== "raw_content") {
        throw new Error("Expected embed_text_source raw_content for fallback");
      }
      if (record.parsed.extraction_method !== "raw") {
        throw new Error("Expected raw extraction method for fallback");
      }
    }
  }

  const arrowBuffer = readFileSync(resolve(runDir, "embeddings.arrow"));
  const table = tableFromIPC(arrowBuffer);
  if (table.numRows !== config.execution.k_max) {
    throw new Error(`Expected ${config.execution.k_max} embeddings rows, got ${table.numRows}`);
  }
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}

console.log("Mock-run debate test OK");
