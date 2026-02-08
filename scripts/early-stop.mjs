import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";

const buildConfig = (options) => ({
  schema_version: "1.0.0",
  run: { run_id: "pending", seed: 424242 },
  question: { text: "Early stop prompt", question_id: "early_stop_q1" },
  sampling: options.sampling,
  protocol: {
    type: "independent",
    timeouts: {
      per_call_timeout_ms: 90000,
      per_call_max_retries: 2,
      total_trial_timeout_ms: 300000
    }
  },
  execution: {
    k_max: options.k_max,
    batch_size: options.batch_size,
    workers: 1,
    retry_policy: { max_retries: 0, backoff_ms: 0 },
    stop_mode: options.stop_mode,
    stop_policy: {
      novelty_epsilon: 1,
      similarity_threshold: 0,
      patience: 1
    },
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
});

const runScenario = (stopMode) => {
  const tempRoot = resolve(tmpdir(), `arbiter-early-stop-${stopMode}-${Date.now()}`);
  const runsDir = resolve(tempRoot, "runs");
  mkdirSync(runsDir, { recursive: true });

  const catalog = JSON.parse(readFileSync(resolve("catalog/models.json"), "utf8"));
  const promptManifest = JSON.parse(readFileSync(resolve("prompts/manifest.json"), "utf8"));
  const personas = promptManifest.entries.filter((entry) => entry.type === "participant_persona");
  const protocols = promptManifest.entries.filter(
    (entry) => entry.type === "participant_protocol_template"
  );

  if (catalog.models.length < 1 || personas.length < 1 || protocols.length < 1) {
    throw new Error("Not enough catalog/prompt entries for early stop test");
  }

  const config = buildConfig({
    k_max: 6,
    batch_size: 2,
    stop_mode: stopMode,
    sampling: {
      models: [{ model: catalog.models[0].slug, weight: 1 }],
      personas: [{ persona: personas[0].id, weight: 1 }],
      protocols: [{ protocol: protocols[0].id, weight: 1 }]
    }
  });

  const configPath = resolve(tempRoot, "arbiter.config.json");
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");

  execSync(`node dist/cli/index.js run --config ${configPath} --out ${runsDir}`, {
    stdio: "ignore"
  });

  const runDirs = readdirSync(runsDir);
  if (runDirs.length !== 1) {
    throw new Error(`Expected 1 run dir, got ${runDirs.length}`);
  }
  const runDir = resolve(runsDir, runDirs[0]);
  const manifest = JSON.parse(readFileSync(resolve(runDir, "manifest.json"), "utf8"));
  const convergenceLines = readFileSync(resolve(runDir, "convergence_trace.jsonl"), "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));

  rmSync(tempRoot, { recursive: true, force: true });
  return { manifest, convergenceLines };
};

const enforced = runScenario("enforcer");
if (enforced.manifest.stop_reason !== "converged") {
  throw new Error("Expected stop_reason=converged for enforced early stop");
}
if (enforced.manifest.k_attempted >= 6) {
  throw new Error("Expected enforced run to stop before k_max");
}
const enforcedWouldStop = enforced.convergenceLines.some(
  (record) => record.stop?.would_stop === true
);
if (!enforcedWouldStop) {
  throw new Error("Expected convergence_trace to log would_stop=true for enforced run");
}

const advisory = runScenario("advisor");
if (advisory.manifest.stop_reason !== "k_max_reached") {
  throw new Error("Expected advisor run to complete to k_max");
}
const advisorWouldStop = advisory.convergenceLines.some(
  (record) => record.stop?.would_stop === true
);
const advisorShouldStop = advisory.convergenceLines.some(
  (record) => record.stop?.should_stop === true
);
if (!advisorWouldStop) {
  throw new Error("Expected advisor run to log would_stop=true");
}
if (advisorShouldStop) {
  throw new Error("Expected advisor run to keep should_stop=false");
}

console.log("Early stop test OK");
