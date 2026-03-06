import type { ArbiterResolvedConfig } from "../../generated/config.types.js";
import { askMultilineQuestion, selectMany, selectOne } from "./controls.js";
import {
  buildConfigFromDraft,
  buildDraftFromConfig,
  buildReviewLines
} from "./draft.js";
import {
  configureAdvancedSettings,
  configureDebateProtocol,
  configureDecodeParams,
  runPreflight
} from "./flows.js";
import type {
  CatalogModel,
  EntryPath,
  PersonaOption,
  ReviewAction,
  ProtocolType,
  RunMode,
  StepFrame,
  StepIndex,
  WizardDraft
} from "./types.js";
import { SELECT_BACK, SELECT_EXIT } from "./types.js";

type StepFrameBuilder = (
  currentStepIndex: StepIndex,
  completedUntilIndex: number,
  title: string,
  hint?: string
) => StepFrame;

type EditableStepIndex = 1 | 2 | 3 | 4 | 5 | 6 | 7;

type WizardStepState = {
  draft: WizardDraft;
  runMode: RunMode;
  entryPath: EntryPath;
  selectedConfigPath: string | null;
  revised: boolean;
  baseTemplate: ArbiterResolvedConfig;
  sourceConfig: ArbiterResolvedConfig | null;
};

type WizardStepContext = {
  assetRoot: string;
  modelOptions: CatalogModel[];
  personaOptions: PersonaOption[];
  buildStepFrame: StepFrameBuilder;
  renderStepFrame: (frame: StepFrame) => void;
};

export type WizardStepResult =
  | { kind: "goto"; step: EditableStepIndex; revised?: boolean }
  | { kind: "exit"; message: string }
  | { kind: "save"; config: ArbiterResolvedConfig; warnings: string[] }
  | { kind: "run"; config: ArbiterResolvedConfig; warnings: string[]; revised: boolean };

type WizardStepController = (state: WizardStepState) => Promise<WizardStepResult>;

export const createWizardStepControllers = (context: WizardStepContext): Record<EditableStepIndex, WizardStepController> => ({
  1: async (state) => {
    const questionInput = await askMultilineQuestion({
      initial: state.draft.question,
      frame: context.buildStepFrame(1, 0, "Research Question"),
      renderStepFrame: context.renderStepFrame
    });
    if (questionInput === SELECT_EXIT) {
      return { kind: "exit", message: "Wizard exited." };
    }
    if (questionInput === SELECT_BACK) {
      return { kind: "goto", step: 1 };
    }
    state.draft.question = questionInput;
    return { kind: "goto", step: 2 };
  },

  2: async (state) => {
    const protocolSelection = await selectOne({
      prompt: "Protocol",
      choices: [
        { id: "independent", label: "Independent" },
        { id: "debate_v1", label: "Debate" }
      ],
      defaultIndex: state.draft.protocolType === "debate_v1" ? 1 : 0,
      frame: context.buildStepFrame(2, 1, "Protocol", "Select how each trial is structured."),
      renderStepFrame: context.renderStepFrame
    });
    if (protocolSelection === SELECT_EXIT) {
      return { kind: "exit", message: "Wizard exited." };
    }
    if (protocolSelection === SELECT_BACK) {
      return { kind: "goto", step: 1 };
    }
    state.draft.protocolType = protocolSelection as ProtocolType;
    if (state.draft.protocolType === "debate_v1") {
      const debateConfigResult = await configureDebateProtocol({
        draft: state.draft,
        buildStepFrame: context.buildStepFrame,
        renderStepFrame: context.renderStepFrame
      });
      if (debateConfigResult === SELECT_EXIT) {
        return { kind: "exit", message: "Wizard exited." };
      }
      if (debateConfigResult === SELECT_BACK) {
        return { kind: "goto", step: 2 };
      }
    }
    return { kind: "goto", step: 3 };
  },

  3: async (state) => {
    const selectedModels = await selectMany({
      prompt: "Models",
      choices: context.modelOptions.map((model) => ({
        id: model.slug,
        label: `${model.slug} ${model.slug.endsWith(":free") ? "[free]" : "[paid]"}${
          model.slug.includes("mini") || model.slug.includes("flash")
            ? " [fast]"
            : !model.slug.endsWith(":free")
              ? " [stable]"
              : ""
        }`
      })),
      defaults: state.draft.modelSlugs,
      emptySelectionError: "Fix required: select at least one model.",
      frame: context.buildStepFrame(3, 2, "Models", "Select one or more models for sampling."),
      extraLines: (selected) =>
        Array.from(selected).some((slug) => slug.endsWith(":free"))
          ? [
              "Warning: free-tier models selected. Availability may be limited. Use paid models for publishable research."
            ]
          : [],
      renderStepFrame: context.renderStepFrame
    });
    if (selectedModels === SELECT_EXIT) {
      return { kind: "exit", message: "Wizard exited." };
    }
    if (selectedModels === SELECT_BACK) {
      return { kind: "goto", step: 2 };
    }
    state.draft.modelSlugs = selectedModels;
    return { kind: "goto", step: 4 };
  },

  4: async (state) => {
    const selectedPersonas = await selectMany({
      prompt: "Personas",
      choices: context.personaOptions.map((persona) => ({ id: persona.id, label: `${persona.id} - ${persona.description}` })),
      defaults: state.draft.personaIds,
      emptySelectionError: "Fix required: select at least one persona.",
      frame: context.buildStepFrame(4, 3, "Personas", "Select one or more personas for sampling."),
      renderStepFrame: context.renderStepFrame
    });
    if (selectedPersonas === SELECT_EXIT) {
      return { kind: "exit", message: "Wizard exited." };
    }
    if (selectedPersonas === SELECT_BACK) {
      return { kind: "goto", step: 3 };
    }
    state.draft.personaIds = selectedPersonas;
    return { kind: "goto", step: 5 };
  },

  5: async (state) => {
    const decodeResult = await configureDecodeParams({
      draft: state.draft,
      buildStepFrame: context.buildStepFrame,
      renderStepFrame: context.renderStepFrame
    });
    if (decodeResult === SELECT_EXIT) {
      return { kind: "exit", message: "Wizard exited." };
    }
    if (decodeResult === SELECT_BACK) {
      return { kind: "goto", step: 4 };
    }
    return { kind: "goto", step: 6 };
  },

  6: async (state) => {
    const defaults = buildDraftFromConfig(state.baseTemplate, {
      modelSlugs: state.draft.modelSlugs,
      personaIds: state.draft.personaIds
    });
    const advancedResult = await configureAdvancedSettings({
      draft: state.draft,
      defaults,
      buildStepFrame: context.buildStepFrame,
      renderStepFrame: context.renderStepFrame
    });
    if (advancedResult === SELECT_EXIT) {
      return { kind: "exit", message: "Wizard exited." };
    }
    if (advancedResult === SELECT_BACK) {
      return { kind: "goto", step: 5 };
    }
    return { kind: "goto", step: 7 };
  },

  7: async (state) => {
    const baseConfig = state.sourceConfig ?? state.baseTemplate;
    const configForReview = buildConfigFromDraft({ baseConfig, draft: state.draft });
    const reviewLines = buildReviewLines({
      draft: state.draft,
      runMode: state.runMode,
      selectedConfigPath: state.selectedConfigPath,
      isExistingPath: state.entryPath === "existing"
    });

    const actionSelection = await selectOne({
      prompt: "Review action",
      choices: [
        { id: "run", label: "Run now" },
        { id: "save", label: "Save config and exit" },
        { id: "revise", label: "Revise" },
        { id: "quit", label: "Quit without saving" }
      ],
      defaultIndex: 0,
      frame: {
        ...context.buildStepFrame(7, 6, "Review and Confirm"),
        activeLines: reviewLines
      },
      renderStepFrame: context.renderStepFrame
    });

    if (actionSelection === SELECT_EXIT) {
      return { kind: "exit", message: "Wizard exited." };
    }
    if (actionSelection === SELECT_BACK) {
      return { kind: "goto", step: 6, revised: true };
    }
    if (actionSelection === "quit") {
      return { kind: "exit", message: "Wizard exited without saving." };
    }
    if (actionSelection === "revise") {
      return { kind: "goto", step: 1, revised: true };
    }

    const action = actionSelection as Extract<ReviewAction, "run" | "save">;
    const warnings = await runPreflight({
      config: configForReview,
      assetRoot: context.assetRoot,
      runMode: state.runMode,
      action
    });

    if (action === "save") {
      return { kind: "save", config: configForReview, warnings };
    }

    return {
      kind: "run",
      config: configForReview,
      warnings,
      revised: state.revised
    };
  }
});
