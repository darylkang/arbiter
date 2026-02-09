import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import type { ArbiterResolvedConfig } from "../../generated/config.types.js";
import type { GuidedSetupState } from "./state.js";

const templatePathForProtocol = (
  assetRoot: string,
  protocol: GuidedSetupState["protocol"]
): string => {
  if (protocol === "debate_v1") {
    return resolve(assetRoot, "resources/templates/debate_v1.config.json");
  }
  return resolve(assetRoot, "resources/templates/default.config.json");
};

const slugifyQuestion = (question: string): string => {
  const slug = question
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
  return slug.length > 0 ? slug : "guided";
};

const ensureMinK = (kMax: number): number => {
  if (kMax <= 1) {
    return 0;
  }
  return Math.max(1, Math.floor(kMax * 0.5));
};

export const buildGuidedConfig = (input: {
  assetRoot: string;
  flow: GuidedSetupState;
}): ArbiterResolvedConfig => {
  const templatePath = templatePathForProtocol(input.assetRoot, input.flow.protocol);
  const raw = readFileSync(templatePath, "utf8");
  const config = JSON.parse(raw) as ArbiterResolvedConfig;

  config.template_id = "guided_wizard";
  config.display_name = "Guided study configuration";
  config.description = "Generated from the guided setup flow.";

  config.run.run_id = "pending";
  config.run.seed = input.flow.seed;

  const questionText = input.flow.question.trim();
  config.question.text = questionText;
  config.question.question_id = `guided_${slugifyQuestion(questionText)}`;
  if (input.flow.labelMode === "custom" && input.flow.labels.length > 0) {
    config.question.source = `guided_labels:${input.flow.labels.join("|")}`;
  } else {
    config.question.source = "guided_free_form";
  }

  config.sampling.models = input.flow.modelSlugs.map((model) => ({
    model,
    weight: 1
  })) as ArbiterResolvedConfig["sampling"]["models"];

  config.sampling.personas = input.flow.personaIds.map((persona) => ({
    persona,
    weight: 1
  })) as ArbiterResolvedConfig["sampling"]["personas"];

  config.sampling.decode = {
    ...(config.sampling.decode ?? {}),
    temperature: input.flow.temperature,
    top_p: input.flow.topP,
    max_tokens: input.flow.maxTokens
  };

  config.protocol.type = input.flow.protocol;

  config.execution.k_max = input.flow.kMax;
  config.execution.workers = input.flow.workers;
  config.execution.batch_size = input.flow.batchSize;
  config.execution.k_min = ensureMinK(input.flow.kMax);

  return config;
};

export const writeGuidedConfig = (input: {
  outputPath: string;
  assetRoot: string;
  flow: GuidedSetupState;
}): ArbiterResolvedConfig => {
  const config = buildGuidedConfig({
    assetRoot: input.assetRoot,
    flow: input.flow
  });
  writeFileSync(input.outputPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  return config;
};
