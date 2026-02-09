import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import {
  validateClusterAssignment,
  validateClusterState,
  validateManifest
} from "../dist/config/schema-validation.js";

const tempRoot = resolve(tmpdir(), `arbiter-mock-interrupt-${Date.now()}`);
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
  throw new Error("Not enough catalog/prompt entries for interrupt smoke test");
}

const config = {
  schema_version: "1.0.0",
  run: { run_id: "pending", seed: 424242 },
  question: { text: "Interrupt smoke prompt", question_id: "mock_interrupt_q1" },
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
    k_max: 40,
    batch_size: 5,
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
      enabled: true,
      algorithm: "online_leader",
      tau: 0.75,
      centroid_update_rule: "fixed_leader",
      cluster_limit: 10,
      stop_mode: "advisory"
    }
  },
  output: { runs_dir: "runs" }
};

const configPath = resolve(tempRoot, "arbiter.config.json");
writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");

let child;
try {
  child = spawn(
    "node",
    ["dist/cli/index.js", "run", "--config", configPath, "--out", runsDir, "--debug"],
    {
      stdio: "inherit",
      env: { ...process.env, ARBITER_MOCK_DELAY_MS: "25" }
    }
  );

  setTimeout(() => {
    child.kill("SIGINT");
  }, 500);

  const exitCode = await new Promise((resolve) => {
    child.on("exit", (code) => resolve(code ?? 1));
  });

  if (exitCode !== 0) {
    throw new Error(`run interrupt smoke failed with code ${exitCode}`);
  }

  const runDirs = readdirSync(runsDir);
  if (runDirs.length !== 1) {
    throw new Error(`Expected 1 run dir, got ${runDirs.length}`);
  }

  const runDir = resolve(runsDir, runDirs[0]);
  const manifestPath = resolve(runDir, "manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (!validateManifest(manifest)) {
    throw new Error("Manifest failed schema validation after interrupt");
  }
  if (manifest.stop_reason !== "user_interrupt" || manifest.incomplete !== true) {
    throw new Error("Manifest did not record user_interrupt with incomplete=true");
  }

  const statePath = resolve(runDir, "clusters/online.state.json");
  const state = JSON.parse(readFileSync(statePath, "utf8"));
  if (!validateClusterState(state)) {
    throw new Error("Cluster state failed schema validation after interrupt");
  }

  const assignmentsPath = resolve(runDir, "clusters/online.assignments.jsonl");
  const assignmentLines = readFileSync(assignmentsPath, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean);
  for (const line of assignmentLines) {
    const record = JSON.parse(line);
    if (!validateClusterAssignment(record)) {
      throw new Error("Cluster assignment failed schema validation after interrupt");
    }
  }

  const convergencePath = resolve(runDir, "convergence_trace.jsonl");
  const convergenceLines = readFileSync(convergencePath, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean);
  let sawDistribution = false;
  for (const line of convergenceLines) {
    const record = JSON.parse(line);
    if (record.cluster_distribution !== undefined) {
      if (!Array.isArray(record.cluster_distribution)) {
        throw new Error("cluster_distribution is not an array");
      }
      if (record.cluster_count !== record.cluster_distribution.length) {
        throw new Error("cluster_distribution length does not match cluster_count");
      }
      const sum = record.cluster_distribution.reduce((acc, value) => acc + value, 0);
      if (sum !== record.k_eligible) {
        throw new Error("cluster_distribution sum does not match k_eligible");
      }
      if (!sawDistribution) {
        if (record.js_divergence !== null) {
          throw new Error("Expected js_divergence null for first distribution");
        }
        sawDistribution = true;
      } else if (typeof record.js_divergence !== "number") {
        throw new Error("Expected js_divergence to be a number after first batch");
      }
    }
  }
} finally {
  if (child && child.exitCode === null) {
    child.kill("SIGKILL");
  }
  rmSync(tempRoot, { recursive: true, force: true });
}

console.log("Mock-run interrupt smoke test OK");
