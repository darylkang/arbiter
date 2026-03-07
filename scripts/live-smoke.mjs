import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

const ENABLE_ENV = "ARBITER_ENABLE_LIVE_SMOKE";
const FREE_EMBEDDING_MODEL = "nvidia/llama-nemotron-embed-vl-1b-v2:free";

if (!process.env.OPENROUTER_API_KEY) {
  console.log("OPENROUTER_API_KEY not set; skipping live smoke test.");
  process.exit(0);
}

if (process.env[ENABLE_ENV] !== "1") {
  console.log(`${ENABLE_ENV}=1 not set; skipping live smoke test.`);
  process.exit(0);
}

const tempRoot = mkdtempSync(resolve(tmpdir(), "arbiter-live-smoke-"));
const runsDir = resolve(tempRoot, "runs");
const configPath = resolve(tempRoot, "arbiter.config.json");

const template = JSON.parse(
  readFileSync(resolve("resources/templates/free_quickstart.config.json"), "utf8")
);

const models = template?.sampling?.models ?? [];
if (
  !Array.isArray(models) ||
  models.length === 0 ||
  models.some((entry) => typeof entry?.model !== "string" || !entry.model.includes(":free"))
) {
  throw new Error(
    "Live smoke must use free-tier generation models only. Update resources/templates/free_quickstart.config.json if this changes."
  );
}

template.question = {
  text: "Live smoke prompt",
  question_id: "live_smoke_q1"
};
template.measurement = {
  ...template.measurement,
  embedding_model: FREE_EMBEDDING_MODEL
};
if (
  typeof template?.measurement?.embedding_model !== "string" ||
  !template.measurement.embedding_model.includes(":free")
) {
  throw new Error("Live smoke must use a free-tier embedding model.");
}
template.output = { runs_dir: "runs" };
writeFileSync(configPath, `${JSON.stringify(template, null, 2)}\n`, "utf8");

try {
  console.log("Running live smoke test (free-tier baseline)...");
  execFileSync(
    "node",
    [
      "dist/cli/index.js",
      "run",
      "--config",
      configPath,
      "--out",
      runsDir,
      "--mode",
      "live",
      "--max-trials",
      "1",
      "--batch-size",
      "1",
      "--workers",
      "1"
    ],
    { encoding: "utf8", stdio: "pipe" }
  );

  const runDirs = readdirSync(runsDir);
  if (runDirs.length !== 1) {
    throw new Error(`Expected 1 live run directory, got ${runDirs.length}`);
  }
  console.log("Live smoke test OK");
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
