import type { AppState, GuidedSetupState, RunMode, RunModeSelection } from "./state.js";
import { formatError } from "./error-format.js";
import {
  DEFAULT_WIZARD_OPTIONS,
  createDefaultGuidedSetup,
  getAdvancedPreset,
  getDecodePreset,
  type AdvancedPreset,
  type DecodePreset,
  type WizardOptions
} from "./wizard-options.js";

type ProtocolSelection = "independent" | "debate-standard" | "debate-adversarial";

type ReviewAction =
  | "start"
  | "edit-question"
  | "change-labels"
  | "change-personas"
  | "change-models"
  | "change-protocol"
  | "change-advanced"
  | "change-mode"
  | "cancel-setup";

const MIN_QUESTION_LENGTH = 1;
const MAX_QUESTION_LENGTH = 500;
const MIN_LABEL_COUNT = 2;

const isRunModeSelection = (value: string): value is RunModeSelection => {
  return value === "mock" || value === "live" || value === "save-only";
};

const isProtocolSelection = (value: string): value is ProtocolSelection => {
  return value === "independent" || value === "debate-standard" || value === "debate-adversarial";
};

const isReviewAction = (value: string): value is ReviewAction => {
  return (
    value === "start" ||
    value === "edit-question" ||
    value === "change-labels" ||
    value === "change-personas" ||
    value === "change-models" ||
    value === "change-protocol" ||
    value === "change-advanced" ||
    value === "change-mode" ||
    value === "cancel-setup"
  );
};

const normalizeLineEndings = (value: string): string => value.replace(/\r\n?/g, "\n");

const validateQuestion = (question: string): string | null => {
  const normalized = normalizeLineEndings(question);
  const trimmed = normalized.trim();

  if (trimmed.length === 0) {
    return "Question is required. Enter at least one non-space character.";
  }
  if (trimmed.length < MIN_QUESTION_LENGTH) {
    return `Question must be at least ${MIN_QUESTION_LENGTH} characters.`;
  }
  if (normalized.length > MAX_QUESTION_LENGTH) {
    return `Question is too long (max ${MAX_QUESTION_LENGTH} characters). Shorten and try again.`;
  }
  return null;
};

const parseLabels = (value: string): string[] => {
  const unique = new Map<string, string>();
  for (const token of value.split(",")) {
    const label = token.trim();
    if (!label) {
      continue;
    }
    const key = label.toLowerCase();
    if (!unique.has(key)) {
      unique.set(key, label);
    }
  }
  return Array.from(unique.values());
};

const validateLabels = (labels: string[]): string | null => {
  if (labels.length < MIN_LABEL_COUNT) {
    return "At least two unique labels are required when labels are enabled.";
  }
  return null;
};

const buildChecklistSelection = (items: string[], selected: string[]): Array<{ id: string; selected: boolean }> => {
  const selectedSet = new Set(selected);
  return items.map((id) => ({
    id,
    selected: selectedSet.has(id)
  }));
};

const formatReviewBody = (input: {
  flow: GuidedSetupState;
  options: WizardOptions;
}): string => {
  const personaLabels = new Map(input.options.personas.map((persona) => [persona.id, persona.label]));
  const modelLabels = new Map(input.options.models.map((model) => [model.slug, model.label]));

  const personas = input.flow.personaIds
    .map((id) => personaLabels.get(id) ?? id)
    .join(", ");

  const models = input.flow.modelSlugs
    .map((slug) => modelLabels.get(slug) ?? slug)
    .join(", ");

  const protocol =
    input.flow.protocol === "debate_v1"
      ? `debate (${input.flow.debateVariant})`
      : "independent";

  const labels =
    input.flow.labelMode === "custom"
      ? input.flow.labels.join(", ")
      : "free-form";

  return [
    `Question: ${input.flow.question}`,
    `Labels: ${labels}`,
    `Decode: temp ${input.flow.temperature.toFixed(2)}, top_p ${input.flow.topP.toFixed(2)}, max_tokens ${input.flow.maxTokens}, seed ${input.flow.seed}`,
    `Personas: ${personas}`,
    `Models: ${models}`,
    `Protocol: ${protocol}`,
    `Execution: k_max ${input.flow.kMax}, workers ${input.flow.workers}, batch_size ${input.flow.batchSize}`,
    `Run mode: ${input.flow.runMode}`
  ].join("\n");
};

const flowStageLabel = (flow: GuidedSetupState): string => {
  switch (flow.stage) {
    case "question":
      return "Step 1/9";
    case "labels":
      return "Step 2/9";
    case "decode":
      return "Step 3/9";
    case "personas":
      return "Step 4/9";
    case "models":
      return "Step 5/9";
    case "protocol":
      return "Step 6/9";
    case "advanced":
      return "Step 7/9";
    case "mode":
      return "Step 8/9";
    case "review":
      return "Step 9/9";
    default:
      return "Step";
  }
};

export type IntakeFlowController = {
  startNewFlow: (runMode?: RunModeSelection) => void;
  handlePlainInput: (value: string) => void;
  handleEscape: () => boolean;
};

export const createIntakeFlowController = (input: {
  state: AppState;
  wizardOptions?: WizardOptions;
  requestRender: () => void;
  appendSystem: (message: string) => void;
  appendStatus: (message: string) => void;
  appendError: (message: string) => void;
  appendSummary: (message: string) => void;
  writeGuidedConfig: (flow: GuidedSetupState) => void;
  startRun: (mode: RunMode) => Promise<void>;
  setInputText: (value: string) => void;
}): IntakeFlowController => {
  const wizardOptions = input.wizardOptions ?? DEFAULT_WIZARD_OPTIONS;

  const cancelFlow = (message = "Setup cancelled."): void => {
    input.state.overlay = null;
    input.state.newFlow = null;
    input.state.phase = "idle";
    input.setInputText("");
    input.appendStatus(message);
    input.requestRender();
  };

  const syncQuestionEditor = (): void => {
    const flow = input.state.newFlow;
    if (!flow) {
      return;
    }
    flow.stage = "question";
    input.state.phase = "intake";
    input.state.overlay = null;
    input.setInputText(flow.question);
    input.requestRender();
  };

  const openReviewOverlay = (): void => {
    const flow = input.state.newFlow;
    if (!flow) {
      return;
    }

    flow.stage = "review";
    input.state.overlay = {
      kind: "select",
      title: `${flowStageLabel(flow)} · Review setup`,
      body: formatReviewBody({ flow, options: wizardOptions }),
      items: [
        {
          id: "start",
          label: "Start",
          description:
            flow.runMode === "save-only"
              ? "Write configuration and return"
              : `Write configuration and start ${flow.runMode} run`
        },
        { id: "edit-question", label: "Edit question" },
        { id: "change-labels", label: "Change labels" },
        { id: "change-personas", label: "Change personas" },
        { id: "change-models", label: "Change models" },
        { id: "change-protocol", label: "Change protocol" },
        { id: "change-advanced", label: "Change advanced settings" },
        { id: "change-mode", label: "Change run mode" },
        { id: "cancel-setup", label: "Cancel setup" }
      ],
      selectedIndex: 0,
      onSelect: (item) => {
        if (!isReviewAction(item.id)) {
          input.appendError(`Invalid review action: ${item.id}.`);
          input.requestRender();
          return;
        }

        switch (item.id) {
          case "start":
            void finalizeFlow();
            return;
          case "edit-question":
            syncQuestionEditor();
            input.appendStatus("Edit your question, then press Enter to continue.");
            return;
          case "change-labels":
            openLabelsOverlay();
            return;
          case "change-personas":
            openPersonaOverlay();
            return;
          case "change-models":
            openModelOverlay();
            return;
          case "change-protocol":
            openProtocolOverlay();
            return;
          case "change-advanced":
            openAdvancedOverlay();
            return;
          case "change-mode":
            openModeOverlay();
            return;
          case "cancel-setup":
            cancelFlow();
            return;
          default:
            return;
        }
      },
      onCancel: () => {
        openModeOverlay();
      }
    };

    input.requestRender();
  };

  const openModeOverlay = (): void => {
    const flow = input.state.newFlow;
    if (!flow) {
      return;
    }

    flow.stage = "mode";

    const items = [
      {
        id: "mock",
        label: "Run mock now",
        description: "No external API calls"
      },
      {
        id: "live",
        label: "Run live now",
        description: input.state.hasApiKey
          ? "Uses OPENROUTER_API_KEY and real model calls"
          : "Requires OPENROUTER_API_KEY",
        disabled: !input.state.hasApiKey
      },
      {
        id: "save-only",
        label: "Save only",
        description: "Write configuration and return"
      }
    ];

    const selectedIndex = Math.max(
      0,
      items.findIndex((item) => item.id === flow.runMode)
    );

    input.state.overlay = {
      kind: "select",
      title: `${flowStageLabel(flow)} · Run mode`,
      items,
      selectedIndex,
      onSelect: (item) => {
        if (item.disabled) {
          return;
        }

        if (!isRunModeSelection(item.id)) {
          input.appendError(`Invalid run mode selection: ${item.id}.`);
          input.requestRender();
          return;
        }

        flow.runMode = item.id;
        openReviewOverlay();
      },
      onCancel: () => {
        openAdvancedOverlay();
      }
    };

    input.requestRender();
  };

  const applyAdvancedPreset = (flow: GuidedSetupState, preset: AdvancedPreset): void => {
    flow.advancedPreset = preset.id;
    flow.kMax = preset.kMax;
    flow.workers = preset.workers;
    flow.batchSize = preset.batchSize;
  };

  const openAdvancedOverlay = (): void => {
    const flow = input.state.newFlow;
    if (!flow) {
      return;
    }

    flow.stage = "advanced";

    const items = wizardOptions.advancedPresets.map((preset) => ({
      id: preset.id,
      label: preset.label,
      description: `${preset.description} • k_max ${preset.kMax}, workers ${preset.workers}, batch ${preset.batchSize}`
    }));

    const selectedIndex = Math.max(
      0,
      items.findIndex((item) => item.id === flow.advancedPreset)
    );

    input.state.overlay = {
      kind: "select",
      title: `${flowStageLabel(flow)} · Execution depth`,
      items,
      selectedIndex,
      onSelect: (item) => {
        const preset = getAdvancedPreset(item.id as GuidedSetupState["advancedPreset"]);
        applyAdvancedPreset(flow, preset);
        openModeOverlay();
      },
      onCancel: () => {
        openProtocolOverlay();
      }
    };

    input.requestRender();
  };

  const openProtocolOverlay = (): void => {
    const flow = input.state.newFlow;
    if (!flow) {
      return;
    }

    flow.stage = "protocol";

    const items = [
      {
        id: "independent",
        label: "Independent",
        description: "Single-pass responses"
      },
      {
        id: "debate-standard",
        label: "Debate (standard)",
        description: "Proposer-critic with balanced critique"
      },
      {
        id: "debate-adversarial",
        label: "Debate (adversarial)",
        description: "Sharper critique and wider disagreement pressure"
      }
    ];

    const selectedId: ProtocolSelection =
      flow.protocol === "debate_v1"
        ? flow.debateVariant === "adversarial"
          ? "debate-adversarial"
          : "debate-standard"
        : "independent";

    const selectedIndex = Math.max(
      0,
      items.findIndex((item) => item.id === selectedId)
    );

    input.state.overlay = {
      kind: "select",
      title: `${flowStageLabel(flow)} · Protocol`,
      items,
      selectedIndex,
      onSelect: (item) => {
        if (!isProtocolSelection(item.id)) {
          input.appendError(`Invalid protocol selection: ${item.id}.`);
          input.requestRender();
          return;
        }

        if (item.id === "independent") {
          flow.protocol = "independent";
          flow.debateVariant = "standard";
        } else {
          flow.protocol = "debate_v1";
          flow.debateVariant = item.id === "debate-adversarial" ? "adversarial" : "standard";
        }

        openAdvancedOverlay();
      },
      onCancel: () => {
        openModelOverlay();
      }
    };

    input.requestRender();
  };

  const openModelOverlay = (): void => {
    const flow = input.state.newFlow;
    if (!flow) {
      return;
    }

    flow.stage = "models";

    const items = wizardOptions.models.map((model) => ({
      id: model.slug,
      label: model.label,
      description: model.description,
      selected: flow.modelSlugs.includes(model.slug)
    }));

    input.state.overlay = {
      kind: "checklist",
      title: `${flowStageLabel(flow)} · Models`,
      items,
      selectedIndex: 0,
      onConfirm: (selectedIds) => {
        if (selectedIds.length === 0) {
          input.appendError("Select at least one model.");
          input.requestRender();
          return;
        }

        flow.modelSlugs = selectedIds;
        openProtocolOverlay();
      },
      onCancel: () => {
        openPersonaOverlay();
      }
    };

    input.requestRender();
  };

  const openPersonaOverlay = (): void => {
    const flow = input.state.newFlow;
    if (!flow) {
      return;
    }

    flow.stage = "personas";

    const selectedEntries = buildChecklistSelection(
      wizardOptions.personas.map((persona) => persona.id),
      flow.personaIds
    );

    input.state.overlay = {
      kind: "checklist",
      title: `${flowStageLabel(flow)} · Personas`,
      items: wizardOptions.personas.map((persona) => {
        const selected = selectedEntries.find((entry) => entry.id === persona.id);
        return {
          id: persona.id,
          label: persona.label,
          description: persona.description,
          selected: selected?.selected ?? false
        };
      }),
      selectedIndex: 0,
      onConfirm: (selectedIds) => {
        if (selectedIds.length === 0) {
          input.appendError("Select at least one persona.");
          input.requestRender();
          return;
        }
        flow.personaIds = selectedIds;
        openModelOverlay();
      },
      onCancel: () => {
        openDecodeOverlay();
      }
    };

    input.requestRender();
  };

  const applyDecodePreset = (flow: GuidedSetupState, preset: DecodePreset): void => {
    flow.decodePreset = preset.id;
    flow.temperature = preset.temperature;
    flow.topP = preset.topP;
    flow.maxTokens = preset.maxTokens;
    flow.seed = preset.seed;
  };

  const openLabelsOverlay = (): void => {
    const flow = input.state.newFlow;
    if (!flow) {
      return;
    }

    flow.stage = "labels";
    const customSelected = flow.labelMode === "custom";

    input.state.overlay = {
      kind: "select",
      title: `${flowStageLabel(flow)} · Decision labels`,
      items: [
        {
          id: "free-form",
          label: "Free-form responses",
          description: "Do not constrain decisions to a fixed label set"
        },
        {
          id: "custom",
          label: "Define labels",
          description: "Enter comma-separated labels in the next step"
        }
      ],
      selectedIndex: customSelected ? 1 : 0,
      onSelect: (item) => {
        if (item.id === "free-form") {
          flow.labelMode = "free-form";
          flow.labels = [];
          input.setInputText("");
          input.appendStatus("Labels set to free-form responses.");
          openDecodeOverlay();
          return;
        }

        if (item.id === "custom") {
          flow.labelMode = "custom";
          input.state.overlay = null;
          input.setInputText(flow.labels.join(", "));
          input.appendStatus("Step 2/9. Enter comma-separated labels, then press Enter.");
          input.requestRender();
          return;
        }

        input.appendError(`Invalid labels selection: ${item.id}.`);
        input.requestRender();
      },
      onCancel: () => {
        syncQuestionEditor();
      }
    };

    input.requestRender();
  };

  const openDecodeOverlay = (): void => {
    const flow = input.state.newFlow;
    if (!flow) {
      return;
    }

    flow.stage = "decode";

    const items = wizardOptions.decodePresets.map((preset) => ({
      id: preset.id,
      label: preset.label,
      description: `${preset.description} • temp ${preset.temperature.toFixed(2)}, top_p ${preset.topP.toFixed(2)}, max_tokens ${preset.maxTokens}`
    }));

    const selectedIndex = Math.max(
      0,
      items.findIndex((item) => item.id === flow.decodePreset)
    );

    input.state.overlay = {
      kind: "select",
      title: `${flowStageLabel(flow)} · Decode settings`,
      items,
      selectedIndex,
      onSelect: (item) => {
        const preset = getDecodePreset(item.id as GuidedSetupState["decodePreset"]);
        applyDecodePreset(flow, preset);
        openPersonaOverlay();
      },
      onCancel: () => {
        openLabelsOverlay();
      }
    };

    input.requestRender();
  };

  const finalizeFlow = async (): Promise<void> => {
    const flow = input.state.newFlow;
    if (!flow) {
      return;
    }

    const question = normalizeLineEndings(flow.question).trim();
    const validationError = validateQuestion(question);
    if (validationError) {
      input.appendError(validationError);
      syncQuestionEditor();
      return;
    }

    flow.question = question;

    try {
      input.writeGuidedConfig(flow);
    } catch (error) {
      input.appendError(`Failed to write configuration: ${formatError(error)}`);
      cancelFlow();
      return;
    }

    input.state.hasConfig = true;
    input.state.question = question;
    input.state.newFlow = null;
    input.state.overlay = null;
    input.state.phase = "idle";
    input.setInputText("");

    input.appendStatus(`Configuration saved to ${input.state.configPath}.`);
    input.appendSummary(formatReviewBody({ flow, options: wizardOptions }));

    input.requestRender();

    if (flow.runMode === "save-only") {
      input.appendStatus("Setup complete. Choose the next action when you are ready.");
      input.requestRender();
      return;
    }

    if (flow.runMode === "live" && !input.state.hasApiKey) {
      input.appendError("OpenRouter API key not found. Live runs require OPENROUTER_API_KEY.");
      input.requestRender();
      return;
    }

    await input.startRun(flow.runMode);
  };

  const startNewFlow = (runMode: RunModeSelection = "mock"): void => {
    if (input.state.phase === "running") {
      input.appendStatus("Run in progress. Wait for completion before starting a new setup.");
      input.requestRender();
      return;
    }

    if (input.state.newFlow) {
      input.state.overlay = {
        kind: "confirm",
        title: "Discard current setup?",
        body: "You have setup inputs in progress.",
        confirmLabel: "Discard and restart",
        cancelLabel: "Keep current setup",
        selectedIndex: 1,
        onConfirm: () => {
          input.state.overlay = null;
          input.state.phase = "intake";
          input.state.configPath = input.state.defaultConfigPath;
          input.state.newFlow = createDefaultGuidedSetup(wizardOptions, runMode);
          input.appendSystem("Set up a new study.");
          input.appendStatus("Step 1/9. What question are you investigating?");
          input.setInputText("");
          input.requestRender();
        },
        onCancel: () => {
          input.state.overlay = null;
          input.appendStatus("Resuming current setup.");
          input.requestRender();
        }
      };
      input.requestRender();
      return;
    }

    input.state.phase = "intake";
    input.state.configPath = input.state.defaultConfigPath;
    input.state.newFlow = createDefaultGuidedSetup(wizardOptions, runMode);
    input.appendSystem("Set up a new study.");
    input.appendStatus("Step 1/9. What question are you investigating?");
    input.setInputText("");
    input.requestRender();
  };

  const handlePlainInput = (value: string): void => {
    const flow = input.state.newFlow;

    if (!flow) {
      input.appendStatus("Use the guided controls to continue setup.");
      input.requestRender();
      return;
    }

    if (flow.stage === "question") {
      const normalized = normalizeLineEndings(value);
      const validationError = validateQuestion(normalized);
      if (validationError) {
        input.appendError(validationError);
        input.requestRender();
        return;
      }

      flow.question = normalized.trim();
      input.appendStatus("Question recorded.");
      openLabelsOverlay();
      return;
    }

    if (flow.stage === "labels" && flow.labelMode === "custom" && !input.state.overlay) {
      const labels = parseLabels(value);
      const validationError = validateLabels(labels);
      if (validationError) {
        input.appendError(validationError);
        input.requestRender();
        return;
      }

      flow.labels = labels;
      input.setInputText(labels.join(", "));
      input.appendStatus(`Labels recorded: ${labels.join(", ")}.`);
      openDecodeOverlay();
      return;
    }

    input.appendStatus("Use the guided controls to continue setup.");
    input.requestRender();
  };

  const handleEscape = (): boolean => {
    const flow = input.state.newFlow;
    if (!flow) {
      return false;
    }

    if (flow.stage === "labels" && flow.labelMode === "custom" && !input.state.overlay) {
      openLabelsOverlay();
      return true;
    }

    if (flow.stage === "question") {
      cancelFlow();
      return true;
    }

    return false;
  };

  return {
    startNewFlow,
    handlePlainInput,
    handleEscape
  };
};
