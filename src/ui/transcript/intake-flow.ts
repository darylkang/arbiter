import {
  createProfileItems,
  findProfileById,
  isProfileId,
  type ProfileDefinition
} from "./profiles.js";
import type { ProfileId } from "./profiles.js";
import type { AppState, RunMode, RunModeSelection } from "./state.js";
import { formatError } from "./error-format.js";

type ReviewAction =
  | "start-run"
  | "edit-question"
  | "change-profile"
  | "change-mode"
  | "cancel-setup";

const MIN_QUESTION_LENGTH = 8;
const MAX_QUESTION_LENGTH = 500;

const isRunModeSelection = (value: string): value is RunModeSelection =>
  value === "mock" || value === "live" || value === "save-only";

const isReviewAction = (value: string): value is ReviewAction =>
  value === "start-run" ||
  value === "edit-question" ||
  value === "change-profile" ||
  value === "change-mode" ||
  value === "cancel-setup";

const validateQuestion = (question: string): string | null => {
  if (question.length === 0) {
    return "Question is required.";
  }
  if (question.length < MIN_QUESTION_LENGTH) {
    return `Question must be at least ${MIN_QUESTION_LENGTH} characters.`;
  }
  if (question.length > MAX_QUESTION_LENGTH) {
    return `Question must be ${MAX_QUESTION_LENGTH} characters or fewer.`;
  }
  return null;
};

export type IntakeFlowController = {
  startNewFlow: () => void;
  handlePlainInput: (value: string) => void;
  handleEscape: () => boolean;
};

export const createIntakeFlowController = (input: {
  state: AppState;
  requestRender: () => void;
  appendSystem: (message: string) => void;
  appendStatus: (message: string) => void;
  appendError: (message: string) => void;
  appendWarning: (message: string) => void;
  writeTemplateConfig: (profile: ProfileDefinition, question: string) => void;
  startRun: (mode: RunMode) => Promise<void>;
  setInputText: (value: string) => void;
}): IntakeFlowController => {
  const cancelFlow = (message = "Setup cancelled."): void => {
    input.state.overlay = null;
    input.state.newFlow = null;
    input.state.phase = "idle";
    input.setInputText("");
    input.appendStatus(message);
    input.requestRender();
  };

  const startQuestionStep = (message?: string): void => {
    const flow = input.state.newFlow;
    if (!flow) {
      return;
    }

    flow.stage = "question";
    input.state.phase = "intake";
    input.state.overlay = null;

    if (message) {
      input.appendStatus(message);
    }

    input.setInputText(flow.question);
    input.requestRender();
  };

  const buildReviewBody = (question: string, profileLabel: string, mode: RunModeSelection): string => {
    return [
      `Question: ${question}`,
      `Profile: ${profileLabel}`,
      `Run mode: ${mode}`
    ].join("\n");
  };

  const finalizeIntake = (profileId: ProfileId, runMode: RunModeSelection): void => {
    const flow = input.state.newFlow;
    const question = flow?.question?.trim() ?? "";

    const questionError = validateQuestion(question);
    if (questionError) {
      input.appendError(questionError);
      startQuestionStep("Please update your question and continue.");
      return;
    }

    const profile = findProfileById(profileId);
    if (!profile) {
      input.appendError(`Unknown profile id: ${profileId}`);
      cancelFlow();
      return;
    }

    try {
      input.writeTemplateConfig(profile, question);
      input.state.hasConfig = true;
      input.state.question = question;
      input.state.profileId = profile.id;
      input.state.newFlow = null;
      input.state.overlay = null;
      input.state.phase = "idle";

      input.setInputText("");
      input.appendStatus(`Configuration saved to ${input.state.configPath}.`);
      input.appendStatus(`Selected profile: ${profile.label}.`);
      if (profile.warning) {
        input.appendWarning(profile.warning);
      }

      input.requestRender();

      if (runMode === "save-only") {
        input.appendStatus("Setup complete. Choose the next action when you are ready.");
        input.requestRender();
        return;
      }

      if (runMode === "live" && !input.state.hasApiKey) {
        input.appendError("OpenRouter API key not found. Live runs require OPENROUTER_API_KEY.");
        input.requestRender();
        return;
      }

      void input.startRun(runMode);
    } catch (error) {
      input.appendError(`Failed to write configuration: ${formatError(error)}`);
      cancelFlow();
    }
  };

  const openProfileOverlay = (): void => {
    const flow = input.state.newFlow;
    if (!flow) {
      return;
    }

    flow.stage = "profile";

    const items = createProfileItems();
    const selectedIndex = Math.max(
      0,
      items.findIndex((item) => item.id === flow.profileId)
    );

    input.state.overlay = {
      kind: "select",
      title: "Select a profile",
      items,
      selectedIndex,
      onSelect: (item) => {
        if (!isProfileId(item.id)) {
          input.appendError(`Invalid profile selection: ${item.id}`);
          input.requestRender();
          return;
        }

        flow.profileId = item.id;
        input.state.profileId = item.id;
        openModeOverlay();
      },
      onCancel: () => {
        startQuestionStep("Edit your question, then press Enter to continue.");
      }
    };

    input.requestRender();
  };

  const openModeOverlay = (): void => {
    const flow = input.state.newFlow;
    if (!flow?.profileId) {
      input.appendError("Missing profile selection in setup flow.");
      cancelFlow();
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
    ] as const;

    const selectedIndex = Math.max(
      0,
      items.findIndex((item) => item.id === flow.mode)
    );

    input.state.overlay = {
      kind: "select",
      title: "Select a run mode",
      items: [...items],
      selectedIndex,
      onSelect: (item) => {
        if (item.disabled) {
          input.appendStatus("Live mode is unavailable without OPENROUTER_API_KEY.");
          input.requestRender();
          return;
        }

        if (!isRunModeSelection(item.id)) {
          input.appendError(`Invalid run mode selection: ${item.id}`);
          input.requestRender();
          return;
        }

        flow.mode = item.id;
        openReviewOverlay();
      },
      onCancel: () => {
        openProfileOverlay();
      }
    };

    input.requestRender();
  };

  const openReviewOverlay = (): void => {
    const flow = input.state.newFlow;
    if (!flow?.profileId || !flow.mode) {
      input.appendError("Incomplete setup state. Returning to profile selection.");
      openProfileOverlay();
      return;
    }

    const profile = findProfileById(flow.profileId);
    if (!profile) {
      input.appendError(`Unknown profile id: ${flow.profileId}`);
      cancelFlow();
      return;
    }

    flow.stage = "review";

    input.state.overlay = {
      kind: "select",
      title: "Review study setup",
      body: buildReviewBody(flow.question, profile.label, flow.mode),
      items: [
        { id: "start-run", label: "Start run", description: "Create config and begin execution" },
        { id: "edit-question", label: "Edit question" },
        { id: "change-profile", label: "Change profile" },
        { id: "change-mode", label: "Change run mode" },
        { id: "cancel-setup", label: "Cancel setup" }
      ],
      selectedIndex: 0,
      onSelect: (item) => {
        if (!isReviewAction(item.id)) {
          input.appendError(`Invalid review action: ${item.id}`);
          input.requestRender();
          return;
        }

        switch (item.id) {
          case "start-run":
            if (!flow.profileId || !flow.mode) {
              input.appendError("Incomplete setup state. Please review your selections.");
              input.requestRender();
              return;
            }
            finalizeIntake(flow.profileId, flow.mode);
            return;
          case "edit-question":
            startQuestionStep("Edit your question, then press Enter to continue.");
            return;
          case "change-profile":
            openProfileOverlay();
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

  const startNewFlow = (): void => {
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
          input.state.newFlow = {
            stage: "question",
            question: ""
          };
          input.appendSystem("Set up a new study.");
          input.appendStatus("What question are you investigating?");
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
    input.state.newFlow = {
      stage: "question",
      question: ""
    };
    input.appendSystem("Set up a new study.");
    input.appendStatus("What question are you investigating?");
    input.setInputText("");
    input.requestRender();
  };

  const handlePlainInput = (value: string): void => {
    const flow = input.state.newFlow;

    if (!flow || flow.stage !== "question") {
      input.appendStatus("Use the guided controls to continue setup.");
      input.requestRender();
      return;
    }

    const question = value.trim();
    const validationError = validateQuestion(question);
    if (validationError) {
      input.appendError(validationError);
      input.setInputText(value);
      input.requestRender();
      return;
    }

    flow.question = question;
    input.state.question = question;
    openProfileOverlay();
  };

  const handleEscape = (): boolean => {
    const flow = input.state.newFlow;
    if (!flow) {
      return false;
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
