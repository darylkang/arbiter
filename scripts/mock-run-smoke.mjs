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
  execution: {
    k_max: 5,
    batch_size: 2,
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
      algorithm: "leader",
      threshold_tau: 0.9,
      centroid_update_rule: "fixed_leader"
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
  "trials.jsonl",
  "parsed.jsonl",
  "convergence_trace.jsonl",
  "embeddings.provenance.json",
  "embeddings.arrow",
  "aggregates.json",
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

const arrowBuffer = readFileSync(resolve(runDir, "embeddings.arrow"));
const table = tableFromIPC(arrowBuffer);
if (table.numRows !== 5) {
  throw new Error(`Expected 5 embeddings rows, got ${table.numRows}`);
}

rmSync(tempRoot, { recursive: true, force: true });
console.log("Mock-run smoke test OK");
