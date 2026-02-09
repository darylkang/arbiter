import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";

const tempRoot = mkdtempSync(resolve(tmpdir(), "arbiter-report-"));
const runsDir = resolve(tempRoot, "runs");
mkdirSync(runsDir, { recursive: true });

const cliPath = resolve("dist/cli/index.js");
try {
  const catalog = JSON.parse(readFileSync(resolve("resources/catalog/models.json"), "utf8"));
  const promptManifest = JSON.parse(readFileSync(resolve("resources/prompts/manifest.json"), "utf8"));
  const personas = promptManifest.entries.filter((entry) => entry.type === "participant_persona");
  const protocols = promptManifest.entries.filter(
    (entry) => entry.type === "participant_protocol_template"
  );

  if (catalog.models.length < 1 || personas.length < 1 || protocols.length < 1) {
    throw new Error("Not enough catalog/prompt entries for report smoke test");
  }

  const config = {
    schema_version: "1.0.0",
    run: { run_id: "pending", seed: 424242 },
    question: { text: "Report smoke question", question_id: "report_q1" },
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

  execFileSync("node", [cliPath, "run", "--config", configPath, "--out", runsDir], {
    stdio: "inherit"
  });

  const runDirs = readdirSync(runsDir);
  if (runDirs.length !== 1) {
    throw new Error(`Expected 1 run dir, got ${runDirs.length}`);
  }
  const runDir = resolve(runsDir, runDirs[0]);

  const output = execFileSync("node", [cliPath, "report", runDir], { encoding: "utf8" });
  if (!output.includes("Arbiter Report")) {
    throw new Error("Report output missing header");
  }
  if (!output.includes("Counts:")) {
    throw new Error("Report output missing counts summary");
  }
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}

console.log("Report smoke test OK");
