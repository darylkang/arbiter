import { resolve } from "node:path";

import { REPO_ROOT, readJson } from "./workspace.mjs";

const catalog = readJson(resolve(REPO_ROOT, "resources/models/catalog.json"));
const promptManifest = readJson(resolve(REPO_ROOT, "resources/prompts/manifest.json"));
const templateManifest = readJson(resolve(REPO_ROOT, "resources/templates/manifest.json"));

const personas = promptManifest.entries.filter((entry) => entry.type === "participant_persona");
const protocols = promptManifest.entries.filter(
  (entry) => entry.type === "participant_protocol_template"
);

const requireCatalogEntries = (requiredPersonas = 1) => {
  if (!catalog.models?.[0] || personas.length < requiredPersonas || protocols.length < 1) {
    throw new Error("Missing catalog or prompt entries for test scenario");
  }
};

export const loadTemplateConfig = (name) => {
  const entry = templateManifest.entries.find((candidate) => candidate.id === name);
  if (!entry) {
    throw new Error(`Unknown template id: ${name}`);
  }
  return readJson(resolve(REPO_ROOT, entry.path));
};

export const buildIndependentSmokeConfig = (options = {}) => {
  requireCatalogEntries(options.personaCount ?? 1);
  const requiredPersonas = options.personaCount ?? 1;
  const selectedPersonas = personas.slice(0, requiredPersonas).map((entry) => ({
    persona: entry.id,
    weight: 1
  }));

  return {
    schema_version: "1.0.0",
    run: { run_id: "pending", seed: options.seed ?? 424242 },
    question: {
      text: options.questionText ?? "Smoke test prompt",
      question_id: options.questionId ?? "smoke_q_1"
    },
    sampling: {
      models: [{ model: catalog.models[0].slug, weight: 1 }],
      personas: selectedPersonas,
      protocols: [{ protocol: protocols[0].id, weight: 1 }],
      ...(options.decode ? { decode: options.decode } : {})
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
      k_max: options.kMax ?? 4,
      batch_size: options.batchSize ?? 2,
      workers: options.workers ?? 2,
      retry_policy: { max_retries: 0, backoff_ms: 0 },
      stop_mode: options.stopMode ?? "advisor",
      ...(options.stopPolicy ? { stop_policy: options.stopPolicy } : {}),
      k_min: options.kMin ?? 0,
      k_min_count_rule: options.kMinCountRule ?? "k_eligible"
    },
    measurement: {
      embedding_model: options.embeddingModel ?? "mock-embedding",
      embed_text_strategy: options.embedTextStrategy ?? "outcome_only",
      novelty_threshold: options.noveltyThreshold ?? 0.85,
      clustering: {
        enabled: false,
        algorithm: "online_leader",
        tau: 0.9,
        centroid_update_rule: "fixed_leader",
        cluster_limit: 500,
        stop_mode: "disabled",
        ...(options.clustering ?? {})
      }
    },
    output: { runs_dir: options.runsDir ?? "runs" }
  };
};

export const buildDebateSmokeConfig = (options = {}) => {
  requireCatalogEntries(2);
  const config = buildIndependentSmokeConfig({
    ...options,
    personaCount: 2,
    questionText: options.questionText ?? "Debate smoke prompt",
    questionId: options.questionId ?? "debate_q_1",
    kMax: options.kMax ?? 2,
    batchSize: options.batchSize ?? 1,
    workers: options.workers ?? 1
  });

  config.protocol = {
    type: "debate_v1",
    participants: options.participants ?? 2,
    rounds: options.rounds ?? 1,
    timeouts: config.protocol.timeouts
  };

  return config;
};
