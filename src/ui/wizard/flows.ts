import { accessSync, constants, existsSync, mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";

import type { ArbiterResolvedConfig } from "../../generated/config.types.js";
import { resolveConfig } from "../../config/resolve-config.js";
import { writeJsonFile } from "../../cli/commands.js";
import {
  askFloatInput,
  askIntegerInput,
  askTextInput,
  selectOne
} from "./controls.js";
import type {
  NavigationSignal,
  ReviewAction,
  RunMode,
  StepFrame,
  StepIndex,
  TemperatureMode,
  SeedMode,
  WizardDraft
} from "./types.js";
import { SELECT_BACK, SELECT_EXIT } from "./types.js";

type StepFrameBuilder = (
  currentStepIndex: StepIndex,
  completedUntilIndex: number,
  title: string,
  hint?: string
) => StepFrame;

const assertOutputDirWritable = (runsDir: string): void => {
  const absolute = resolve(process.cwd(), runsDir);
  if (existsSync(absolute)) {
    const stat = statSync(absolute);
    if (!stat.isDirectory()) {
      throw new Error(`Output path exists and is not a directory: ${runsDir}`);
    }
    accessSync(absolute, constants.W_OK | constants.X_OK);
    return;
  }

  let candidate = dirname(absolute);
  while (!existsSync(candidate)) {
    const parent = dirname(candidate);
    if (parent === candidate) {
      throw new Error(`Unable to validate output path: ${runsDir}`);
    }
    candidate = parent;
  }

  const parentStat = statSync(candidate);
  if (!parentStat.isDirectory()) {
    throw new Error(`Output parent exists and is not a directory: ${candidate}`);
  }
  accessSync(candidate, constants.W_OK | constants.X_OK);
};

const validateConfigResolvable = (input: {
  config: ArbiterResolvedConfig;
  assetRoot: string;
}): void => {
  const tempRoot = mkdtempSync(resolve(tmpdir(), "arbiter-wizard-preflight-"));
  const tempConfigPath = resolve(tempRoot, "arbiter.config.json");
  try {
    writeJsonFile(tempConfigPath, input.config);
    resolveConfig({
      configPath: tempConfigPath,
      configRoot: tempRoot,
      assetRoot: input.assetRoot
    });
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
};

export const runPreflight = async (input: {
  config: ArbiterResolvedConfig;
  assetRoot: string;
  runMode: RunMode;
  action: ReviewAction;
}): Promise<string[]> => {
  const warnings: string[] = [];

  validateConfigResolvable({
    config: input.config,
    assetRoot: input.assetRoot
  });

  assertOutputDirWritable(input.config.output.runs_dir);

  const selectedModels = input.config.sampling.models.map((model) => model.model);
  if (selectedModels.some((model) => model.endsWith(":free"))) {
    warnings.push(
      "Warning: free-tier models selected. Availability may be limited. Use paid models for publishable research."
    );
  }

  if (input.action === "run" && input.runMode === "live") {
    if (!process.env.OPENROUTER_API_KEY) {
      throw new Error("Live mode requires OPENROUTER_API_KEY.");
    }
  }

  if (input.action === "save" && input.runMode === "live" && !process.env.OPENROUTER_API_KEY) {
    warnings.push("Live mode requires OPENROUTER_API_KEY to run; config saved but not executed.");
  }

  return warnings;
};

export const configureDebateProtocol = async (input: {
  draft: WizardDraft;
  buildStepFrame: StepFrameBuilder;
  renderStepFrame: (frame: StepFrame) => void;
}): Promise<"done" | NavigationSignal> => {
  while (true) {
    const participants = await askIntegerInput({
      frame: input.buildStepFrame(
        2,
        1,
        "Protocol",
        "Each round: all participants speak in order; after R rounds, participant A gives the final response."
      ),
      title: "Participants (P)",
      helperLines: ["Enter the number of participants in the debate."],
      defaultValue: input.draft.participants,
      min: 2,
      renderStepFrame: input.renderStepFrame
    });
    if (participants === SELECT_BACK || participants === SELECT_EXIT) {
      return participants;
    }
    input.draft.participants = participants;

    const rounds = await askIntegerInput({
      frame: input.buildStepFrame(
        2,
        1,
        "Protocol",
        "Each round: all participants speak in order; after R rounds, participant A gives the final response."
      ),
      title: "Rounds (R)",
      helperLines: ["Enter the number of debate rounds."],
      defaultValue: input.draft.rounds,
      min: 1,
      renderStepFrame: input.renderStepFrame
    });
    if (rounds === SELECT_EXIT) {
      return rounds;
    }
    if (rounds === SELECT_BACK) {
      continue;
    }
    input.draft.rounds = rounds;
    return "done";
  }
};

export const configureDecodeParams = async (input: {
  draft: WizardDraft;
  buildStepFrame: StepFrameBuilder;
  renderStepFrame: (frame: StepFrame) => void;
}): Promise<"done" | NavigationSignal> => {
  while (true) {
    const temperatureModeSelection = await selectOne({
      prompt: "Temperature mode",
      choices: [
        { id: "single", label: "Single value" },
        { id: "range", label: "Range (uniform)" }
      ],
      defaultIndex: input.draft.temperatureMode === "range" ? 1 : 0,
      frame: input.buildStepFrame(5, 4, "Decode Params", "Set temperature and seed behavior for trial sampling."),
      renderStepFrame: input.renderStepFrame
    });
    if (temperatureModeSelection === SELECT_EXIT || temperatureModeSelection === SELECT_BACK) {
      return temperatureModeSelection;
    }

    input.draft.temperatureMode = temperatureModeSelection as TemperatureMode;
    if (input.draft.temperatureMode === "single") {
      const temperature = await askFloatInput({
        frame: input.buildStepFrame(5, 4, "Decode Params", "Set numeric decode values."),
        title: "Temperature",
        helperLines: ["Enter a value within [0.0, 2.0]."],
        defaultValue: input.draft.temperatureSingle,
        min: 0,
        max: 2,
        onInvalid: () => "Fix required: temperature must be within [0.0, 2.0].",
        renderStepFrame: input.renderStepFrame
      });
      if (temperature === "__EXIT__") {
        return temperature;
      }
      if (temperature === SELECT_BACK) {
        continue;
      }
      input.draft.temperatureSingle = temperature;
    } else {
      while (true) {
        const minimum = await askFloatInput({
          frame: input.buildStepFrame(5, 4, "Decode Params", "Set numeric decode values."),
          title: "Temperature min",
          helperLines: ["Enter the lower bound within [0.0, 2.0]."],
          defaultValue: input.draft.temperatureMin,
          min: 0,
          max: 2,
          onInvalid: () => "Fix required: temperature must be within [0.0, 2.0].",
          renderStepFrame: input.renderStepFrame
        });
        if (minimum === SELECT_EXIT) {
          return minimum;
        }
        if (minimum === SELECT_BACK) {
          break;
        }
        input.draft.temperatureMin = minimum;

        const maximum = await askFloatInput({
          frame: input.buildStepFrame(5, 4, "Decode Params", "Set numeric decode values."),
          title: "Temperature max",
          helperLines: ["Enter the upper bound within [0.0, 2.0]."],
          defaultValue: input.draft.temperatureMax,
          min: 0,
          max: 2,
          onInvalid: () => "Fix required: temperature must be within [0.0, 2.0].",
          renderStepFrame: input.renderStepFrame
        });
        if (maximum === SELECT_EXIT) {
          return maximum;
        }
        if (maximum === SELECT_BACK) {
          continue;
        }
        input.draft.temperatureMax = maximum;
        if (input.draft.temperatureMin > input.draft.temperatureMax) {
          input.renderStepFrame({
            ...input.buildStepFrame(5, 4, "Decode Params", "Set numeric decode values."),
            activeLines: [
              "Temperature max",
              "Enter the upper bound within [0.0, 2.0].",
              "",
              `▸ ${input.draft.temperatureMax}`,
              "",
              "Fix required: range min must be less than or equal to max."
            ],
            footerText: "Enter confirm · Esc back"
          });
          continue;
        }
        break;
      }
      if (input.draft.temperatureMin > input.draft.temperatureMax) {
        continue;
      }
    }

    while (true) {
      const seedModeSelection = await selectOne({
        prompt: "Seed mode",
        choices: [
          { id: "random", label: "Random" },
          { id: "fixed", label: "Fixed seed" }
        ],
        defaultIndex: input.draft.seedMode === "fixed" ? 1 : 0,
        frame: input.buildStepFrame(5, 4, "Decode Params", "Set temperature and seed behavior for trial sampling."),
        renderStepFrame: input.renderStepFrame
      });
      if (seedModeSelection === SELECT_EXIT) {
        return seedModeSelection;
      }
      if (seedModeSelection === SELECT_BACK) {
        break;
      }
      input.draft.seedMode = seedModeSelection as SeedMode;
      if (input.draft.seedMode === "fixed") {
        const seed = await askIntegerInput({
          frame: input.buildStepFrame(5, 4, "Decode Params", "Set fixed seed."),
          title: "Fixed seed",
          helperLines: ["Enter a non-negative integer."],
          defaultValue: input.draft.fixedSeed,
          min: 0,
          onInvalid: () => "Fix required: seed must be a non-negative integer.",
          renderStepFrame: input.renderStepFrame
        });
        if (seed === SELECT_EXIT) {
          return seed;
        }
        if (seed === SELECT_BACK) {
          continue;
        }
        input.draft.fixedSeed = seed;
      }
      return "done";
    }
  }
};

export const configureAdvancedSettings = async (input: {
  draft: WizardDraft;
  defaults: WizardDraft;
  buildStepFrame: StepFrameBuilder;
  renderStepFrame: (frame: StepFrame) => void;
}): Promise<"done" | NavigationSignal> => {
  const advancedSelection = await selectOne({
    prompt: "Advanced Settings",
    choices: [
      { id: "defaults", label: "Use defaults (recommended)" },
      { id: "custom", label: "Customize" }
    ],
    defaultIndex: input.draft.useAdvancedDefaults ? 0 : 1,
    frame: input.buildStepFrame(
      6,
      5,
      "Advanced Settings",
      "Use defaults or customize execution and stopping settings."
    ),
    renderStepFrame: input.renderStepFrame
  });
  if (advancedSelection === SELECT_EXIT || advancedSelection === SELECT_BACK) {
    return advancedSelection;
  }

  input.draft.useAdvancedDefaults = advancedSelection === "defaults";
  if (input.draft.useAdvancedDefaults) {
    input.draft.workers = input.defaults.workers;
    input.draft.batchSize = input.defaults.batchSize;
    input.draft.kMax = input.defaults.kMax;
    input.draft.maxTokens = input.defaults.maxTokens;
    input.draft.noveltyThreshold = input.defaults.noveltyThreshold;
    input.draft.noveltyPatience = input.defaults.noveltyPatience;
    input.draft.kMin = input.defaults.kMin;
    input.draft.similarityAdvisoryThreshold = input.defaults.similarityAdvisoryThreshold;
    input.draft.outputDir = input.defaults.outputDir;
    return "done";
  }

  const fields = [
    {
      ask: () =>
        askIntegerInput({
          frame: input.buildStepFrame(6, 5, "Advanced Settings", "Customize execution and stopping settings."),
          title: "Workers",
          helperLines: ["Set concurrent worker count."],
          defaultValue: input.draft.workers,
          min: 1,
          renderStepFrame: input.renderStepFrame
        }),
      apply: (value: number) => {
        input.draft.workers = value;
      }
    },
    {
      ask: () =>
        askIntegerInput({
          frame: input.buildStepFrame(6, 5, "Advanced Settings", "Customize execution and stopping settings."),
          title: "Batch size",
          helperLines: ["Set trials per monitoring batch."],
          defaultValue: input.draft.batchSize,
          min: 1,
          renderStepFrame: input.renderStepFrame
        }),
      apply: (value: number) => {
        input.draft.batchSize = value;
      }
    },
    {
      ask: () =>
        askIntegerInput({
          frame: input.buildStepFrame(6, 5, "Advanced Settings", "Customize execution and stopping settings."),
          title: "K_max",
          helperLines: ["Set the maximum planned trials."],
          defaultValue: input.draft.kMax,
          min: 1,
          renderStepFrame: input.renderStepFrame
        }),
      apply: (value: number) => {
        input.draft.kMax = value;
      }
    },
    {
      ask: () =>
        askIntegerInput({
          frame: input.buildStepFrame(6, 5, "Advanced Settings", "Customize execution and stopping settings."),
          title: "Max tokens per call",
          helperLines: ["Set the generation cap per call."],
          defaultValue: input.draft.maxTokens,
          min: 1,
          renderStepFrame: input.renderStepFrame
        }),
      apply: (value: number) => {
        input.draft.maxTokens = value;
      }
    },
    {
      ask: () =>
        askFloatInput({
          frame: input.buildStepFrame(6, 5, "Advanced Settings", "Customize execution and stopping settings."),
          title: "Novelty threshold",
          helperLines: ["Enter a value within [0.0, 1.0]."],
          defaultValue: input.draft.noveltyThreshold,
          min: 0,
          max: 1,
          renderStepFrame: input.renderStepFrame
        }),
      apply: (value: number) => {
        input.draft.noveltyThreshold = value;
      }
    },
    {
      ask: () =>
        askIntegerInput({
          frame: input.buildStepFrame(6, 5, "Advanced Settings", "Customize execution and stopping settings."),
          title: "Patience",
          helperLines: ["Set consecutive low-novelty batches before stopping."],
          defaultValue: input.draft.noveltyPatience,
          min: 1,
          renderStepFrame: input.renderStepFrame
        }),
      apply: (value: number) => {
        input.draft.noveltyPatience = value;
      }
    },
    {
      ask: () =>
        askIntegerInput({
          frame: input.buildStepFrame(6, 5, "Advanced Settings", "Customize execution and stopping settings."),
          title: "K_min eligible trials",
          helperLines: ["Set the minimum eligible trials before stop checks activate."],
          defaultValue: input.draft.kMin,
          min: 0,
          renderStepFrame: input.renderStepFrame
        }),
      apply: (value: number) => {
        input.draft.kMin = value;
      }
    },
    {
      ask: () =>
        askFloatInput({
          frame: input.buildStepFrame(6, 5, "Advanced Settings", "Customize execution and stopping settings."),
          title: "Similarity advisory threshold",
          helperLines: ["Enter a value within [0.0, 1.0]."],
          defaultValue: input.draft.similarityAdvisoryThreshold,
          min: 0,
          max: 1,
          renderStepFrame: input.renderStepFrame
        }),
      apply: (value: number) => {
        input.draft.similarityAdvisoryThreshold = value;
      }
    },
    {
      ask: () =>
        askTextInput({
          frame: input.buildStepFrame(6, 5, "Advanced Settings", "Customize execution and stopping settings."),
          title: "Output dir",
          helperLines: ["Enter the runs directory path."],
          defaultValue: input.draft.outputDir,
          renderStepFrame: input.renderStepFrame
        }),
      apply: (value: string) => {
        input.draft.outputDir = value;
      }
    }
  ] as const;

  let fieldIndex = 0;
  while (fieldIndex < fields.length) {
    const field = fields[fieldIndex];
    const result = await field.ask();
    if (result === SELECT_EXIT) {
      return result;
    }
    if (result === SELECT_BACK) {
      if (fieldIndex === 0) {
        return SELECT_BACK;
      }
      fieldIndex -= 1;
      continue;
    }
    field.apply(result as never);
    fieldIndex += 1;
  }

  return "done";
};
