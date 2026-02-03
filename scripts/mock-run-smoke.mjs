import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { tableFromIPC } from "apache-arrow";
import { validateManifest } from "../dist/config/schema-validation.js";

const tempRoot = resolve(tmpdir(), `arbiter-mock-run-${Date.now()}`);
const runsDir = resolve(tempRoot, "runs");
mkdirSync(runsDir, { recursive: true });

const catalog = JSON.parse(readFileSync(resolve("catalog/models.json"), "utf8"));
const promptManifest = JSON.parse(readFileSync(resolve("prompts/manifest.json"), "utf8"));

const personas = promptManifest.entries.filter(
  (entry) => entry.type === "participant_persona"
);
const protocols = promptManifest.entries.filter(
  (entry) => entry.type === "participant_protocol_template"
);

if (catalog.models.length < 1 || personas.length < 2 || protocols.length < 1) {
  throw new Error("Not enough catalog/prompt entries for mock-run smoke test");
}

const config = {
  schema_version: "1.0.0",
  run: { run_id: "pending", seed: 424242 },
  question: { text: "Smoke test prompt", question_id: "mock_q_1" },
  sampling: {
    models: [{ model: catalog.models[0].slug, weight: 1 }],
    personas: [
      { persona: personas[0].id, weight: 1 },
      { persona: personas[1].id, weight: 1 }
    ],
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
    k_max: 5,
    batch_size: 2,
    workers: 3,
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

execSync(
  `node dist/cli/index.js mock-run --config ${configPath} --out ${runsDir} --debug`,
  { stdio: "inherit" }
);

const runDirs = readdirSync(runsDir);
if (runDirs.length !== 1) {
  throw new Error(`Expected 1 run dir, got ${runDirs.length}`);
}

const runDir = resolve(runsDir, runDirs[0]);
const requiredPaths = [
  "config.resolved.json",
  "manifest.json",
  "trial_plan.jsonl",
  "trials.jsonl",
  "parsed.jsonl",
  "convergence_trace.jsonl",
  "embeddings.provenance.json",
  "embeddings.arrow",
  "aggregates.json",
  "receipt.txt",
  "debug/embeddings.jsonl"
];

for (const relPath of requiredPaths) {
  const fullPath = resolve(runDir, relPath);
  try {
    readFileSync(fullPath);
  } catch {
    throw new Error(`Missing required artifact: ${relPath}`);
  }
}

const manifestPath = resolve(runDir, "manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
if (!validateManifest(manifest)) {
  throw new Error("Manifest failed schema validation in mock-run smoke test");
}

const artifactPaths = manifest.artifacts?.entries?.map((entry) => entry.path) ?? [];
if (!artifactPaths.includes("receipt.txt")) {
  throw new Error("Manifest did not include receipt.txt artifact entry");
}

const planLines = readFileSync(resolve(runDir, "trial_plan.jsonl"), "utf8")
  .trim()
  .split("\n")
  .filter(Boolean)
  .map((line) => JSON.parse(line));
if (planLines.length !== manifest.k_planned) {
  throw new Error(
    `Expected ${manifest.k_planned} trial plan records, got ${planLines.length}`
  );
}
planLines.forEach((record, index) => {
  if (record.trial_id !== index) {
    throw new Error("Trial plan records are not ordered by trial_id");
  }
});

const convergenceLines = readFileSync(resolve(runDir, "convergence_trace.jsonl"), "utf8")
  .trim()
  .split("\n")
  .filter(Boolean)
  .map((line) => JSON.parse(line));
const lastConvergence = convergenceLines[convergenceLines.length - 1];
const aggregates = JSON.parse(readFileSync(resolve(runDir, "aggregates.json"), "utf8"));
if (aggregates.novelty_rate !== lastConvergence.novelty_rate) {
  throw new Error("Aggregates novelty_rate does not match final convergence record");
}
if (aggregates.mean_max_sim_to_prior !== lastConvergence.mean_max_sim_to_prior) {
  throw new Error("Aggregates mean_max_sim_to_prior does not match final convergence record");
}
if (aggregates.cluster_count !== null || aggregates.entropy !== null) {
  throw new Error("Aggregates should not include clustering metrics when clustering is disabled");
}

const arrowBuffer = readFileSync(resolve(runDir, "embeddings.arrow"));
const table = tableFromIPC(arrowBuffer);
if (table.numRows !== 5) {
  throw new Error(`Expected 5 embeddings rows, got ${table.numRows}`);
}

const embeddingLines = readFileSync(resolve(runDir, "debug/embeddings.jsonl"), "utf8")
  .trim()
  .split("\n")
  .filter(Boolean)
  .map((line) => JSON.parse(line));
const successRecords = embeddingLines.filter(
  (record) => record.embedding_status === "success"
);
if (successRecords.length === 0) {
  throw new Error("Expected at least one successful embedding record");
}
successRecords.forEach((record) => {
  if (!record.generation_id || typeof record.generation_id !== "string") {
    throw new Error("Expected generation_id on successful embedding records");
  }
});

rmSync(tempRoot, { recursive: true, force: true });
console.log("Mock-run smoke test OK");
