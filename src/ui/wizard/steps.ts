import type { ArbiterResolvedConfig } from "../../generated/config.types.js";
import { readJsonFile } from "../../cli/commands.js";
import { UI_COPY } from "../copy.js";
import { askMultilineQuestion, chooseConfigFile, selectMany, selectOne } from "./controls.js";
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
export type WizardStage = "entry" | "mode" | "configSelect" | EditableStepIndex;

export type WizardFlowState = {
  draft: WizardDraft;
  runMode: RunMode | null;
  entryPath: EntryPath | null;
  selectedConfigPath: string | null;
  revised: boolean;
  baseTemplate: ArbiterResolvedConfig;
  sourceConfig: ArbiterResolvedConfig | null;
};

type WizardStepContext = {
  assetRoot: string;
  version: string;
  apiKeyPresent: boolean;
  configFiles: string[];
  configCount: number;
  modelOptions: CatalogModel[];
  personaOptions: PersonaOption[];
  modelLabels: Map<string, string>;
  personaLabels: Map<string, string>;
  buildStepFrame: StepFrameBuilder;
  renderStepFrame: (frame: StepFrame) => void;
};

export type WizardStepResult =
  | { kind: "goto"; step: WizardStage; revised?: boolean }
  | { kind: "exit"; message: string }
  | { kind: "save"; config: ArbiterResolvedConfig; warnings: string[] }
  | { kind: "run"; config: ArbiterResolvedConfig; warnings: string[]; revised: boolean };

type WizardStepController = (state: WizardStepState) => Promise<WizardStepResult>;
type WizardController = (state: WizardFlowState) => Promise<WizardStepResult>;

type WizardStepState = WizardFlowState & {
  runMode: RunMode;
  entryPath: EntryPath;
};

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
    const modelFrame = context.buildStepFrame(3, 2, "Models");
    modelFrame.activeLines = ["Select one or more models for sampling.", ""];
    const tierOrder: CatalogModel["tier"][] = ["flagship", "mid", "budget", "free"];
    const modelChoices = tierOrder.flatMap((tier, tierIndex) => {
      const models = context.modelOptions.filter((model) => model.tier === tier);
      if (models.length === 0) {
        return [];
      }
      return [
        ...(tierIndex > 0
          ? [
              {
                kind: "spacer" as const,
                choice: {
                  id: `__spacer__${tier}`,
                  label: "",
                  kind: "spacer" as const,
                  disabled: true
                }
              }
            ]
          : []),
        {
          kind: "group" as const,
          choice: {
            id: `__group__${tier}`,
            label: `── ${context.modelOptions.find((model) => model.tier === tier)?.tierLabel ?? tier}`,
            kind: "group" as const,
            disabled: true
          }
        },
        ...models.map((model) => ({
          kind: "model" as const,
          model,
          choice: {
            id: model.slug,
            label: [model.display, model.providerLabel].join(" · "),
            activeSuffix: model.slug
          }
        }))
      ];
    });
    const selectedModels = await selectMany({
      prompt: "Models",
      choices: modelChoices.map((entry) => entry.choice),
      defaults: state.draft.modelSlugs,
      emptySelectionError: "Fix required: select at least one model.",
      frame: modelFrame,
      focusedLines: (index) => {
        const entry = modelChoices[index];
        if (!entry || entry.kind !== "model") {
          return ["", "", ""];
        }
        const model = entry.model;
        return [model.summaryLine, model.researchNote, model.riskNote ?? ""];
      },
      extraLines: (selected) =>
        context.modelOptions
          .filter((model) => selected.has(model.slug))
          .some((model) => model.tier === "free")
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
    const personaFrame = context.buildStepFrame(4, 3, "Personas");
    personaFrame.activeLines = ["Select one or more personas for sampling.", ""];
    const selectedPersonas = await selectMany({
      prompt: "Personas",
      choices: context.personaOptions.map((persona) => ({
        id: persona.id,
        label: `${persona.displayName} · ${persona.category}`
      })),
      defaults: state.draft.personaIds,
      emptySelectionError: "Fix required: select at least one persona.",
      frame: personaFrame,
      focusedLines: (index) => {
        const persona = context.personaOptions[index];
        if (!persona) {
          return ["", "", ""];
        }
        return [
          persona.subtitle,
          persona.whenToUse,
          persona.riskNote ?? ""
        ];
      },
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
      isExistingPath: state.entryPath === "existing",
      modelLabels: context.modelLabels,
      personaLabels: context.personaLabels
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

const assertEditableState = (state: WizardFlowState): WizardStepState => {
  if (!state.entryPath || !state.runMode) {
    throw new Error("Editable wizard steps require entryPath and runMode.");
  }
  return {
    ...state,
    entryPath: state.entryPath,
    runMode: state.runMode
  };
};

export const createWizardControllers = (context: WizardStepContext): Record<WizardStage, WizardController> => {
  const stepControllers = createWizardStepControllers(context);
  const defaultModelSlugs = context.modelOptions.filter((model) => model.isDefault).map((model) => model.slug);
  const defaultPersonaIds = context.personaOptions.filter((persona) => persona.isDefault).map((persona) => persona.id);

  return {
    entry: async (state) => {
      const entryChoice = await selectOne({
        prompt: "Choose how to start",
        choices: [
          {
            id: "existing",
            label:
              context.configFiles.length === 0
                ? "Run existing config (unavailable)"
                : "Run existing config",
            disabled: context.configFiles.length === 0,
            disabledReason: UI_COPY.runExistingUnavailable
          },
          {
            id: "new",
            label: "Create new study (guided wizard)"
          }
        ],
        defaultIndex: context.configFiles.length === 0 ? 1 : 0,
        frame: {
          version: context.version,
          currentRailIndex: 0,
          completedUntilRailIndex: -1,
          runMode: null,
          apiKeyPresent: context.apiKeyPresent,
          configCount: context.configCount,
          contextLabel: "onboarding",
          showRunMode: false,
          activeLabel: "Entry Path",
          activeLines: [],
          footerText: "↑/↓ move · Enter select · Esc back",
          stepSummaries: {}
        },
        renderStepFrame: context.renderStepFrame
      });
      if (entryChoice === SELECT_EXIT || entryChoice === SELECT_BACK) {
        return { kind: "exit", message: "Wizard exited." };
      }
      state.entryPath = entryChoice as EntryPath;
      state.runMode = null;
      state.selectedConfigPath = null;
      state.sourceConfig = null;
      state.revised = state.entryPath === "new";
      return { kind: "goto", step: "mode" };
    },

    mode: async (state) => {
      if (!state.entryPath) {
        return { kind: "goto", step: "entry" };
      }

      const entrySummary = state.entryPath === "existing" ? "Run existing config" : "Create new study";
      const runChoice = await selectOne({
        prompt: "Choose run mode",
        choices: [
          {
            id: "live",
            label: !context.apiKeyPresent ? "Live (OpenRouter) (unavailable)" : "Live (OpenRouter)",
            disabled: !context.apiKeyPresent,
            disabledReason: UI_COPY.liveModeUnavailable
          },
          { id: "mock", label: "Mock (no API calls)" }
        ],
        defaultIndex: context.apiKeyPresent ? 0 : 1,
        frame: {
          version: context.version,
          currentRailIndex: 1,
          completedUntilRailIndex: 0,
          runMode: null,
          apiKeyPresent: context.apiKeyPresent,
          configCount: context.configCount,
          contextLabel: "onboarding / mode",
          showRunMode: true,
          activeLabel: "Run Mode",
          activeLines: [],
          footerText: "↑/↓ move · Enter select · Esc back",
          stepSummaries: { 0: entrySummary }
        },
        renderStepFrame: context.renderStepFrame
      });
      if (runChoice === SELECT_EXIT) {
        return { kind: "exit", message: "Wizard exited." };
      }
      if (runChoice === SELECT_BACK) {
        state.entryPath = null;
        state.runMode = null;
        return { kind: "goto", step: "entry" };
      }

      state.runMode = runChoice as RunMode;
      return { kind: "goto", step: state.entryPath === "existing" ? "configSelect" : 1 };
    },

    configSelect: async (state) => {
      const selectedConfigPath = await chooseConfigFile({
        configs: context.configFiles,
        frame: {
          ...context.buildStepFrame(0, 0, "Run Mode", "Select a config file"),
          currentRailIndex: 1,
          completedUntilRailIndex: 1,
          contextLabel: "onboarding / mode",
          showRunMode: true,
          activeLabel: "Run Mode"
        },
        renderStepFrame: context.renderStepFrame
      });
      if (!selectedConfigPath) {
        return { kind: "exit", message: "Wizard exited." };
      }

      state.selectedConfigPath = selectedConfigPath;
      state.sourceConfig = readJsonFile<ArbiterResolvedConfig>(selectedConfigPath);
      state.draft = buildDraftFromConfig(state.sourceConfig, {
        modelSlugs:
          defaultModelSlugs.length > 0
            ? defaultModelSlugs
            : context.modelOptions.length > 0
              ? [context.modelOptions[0].slug]
              : [],
        personaIds: defaultPersonaIds
      });
      return { kind: "goto", step: 7 };
    },

    1: async (state) => stepControllers[1](assertEditableState(state)),
    2: async (state) => stepControllers[2](assertEditableState(state)),
    3: async (state) => stepControllers[3](assertEditableState(state)),
    4: async (state) => stepControllers[4](assertEditableState(state)),
    5: async (state) => stepControllers[5](assertEditableState(state)),
    6: async (state) => stepControllers[6](assertEditableState(state)),
    7: async (state) => stepControllers[7](assertEditableState(state))
  };
};
