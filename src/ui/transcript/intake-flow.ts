import { createProfileItems, findProfileById, isProfileId, type ProfileDefinition } from "./profiles.js";
import type { ProfileId } from "./profiles.js";
import type { AppState, RunMode } from "./state.js";
import { formatError } from "./error-format.js";

type RunModeSelection = RunMode | "none";

const isRunModeSelection = (value: string): value is RunModeSelection =>
  value === "mock" || value === "live" || value === "none";

export type IntakeFlowController = {
  startNewFlow: () => void;
  handlePlainInput: (value: string) => void;
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
}): IntakeFlowController => {
  const finalizeIntake = (inputProfileId: ProfileId, runMode: RunModeSelection): void => {
    const flow = input.state.newFlow;
    const question = flow?.question?.trim();
    if (!question) {
      input.appendError("missing question text in intake flow");
      input.state.newFlow = null;
      input.state.phase = "idle";
      input.requestRender();
      return;
    }

    const profile = findProfileById(inputProfileId);
    if (!profile) {
      input.appendError(`unknown profile id: ${inputProfileId}`);
      input.state.newFlow = null;
      input.state.phase = "idle";
      input.requestRender();
      return;
    }

    try {
      input.writeTemplateConfig(profile, question);
      input.state.hasConfig = true;
      input.state.question = question;
      input.state.profileId = profile.id;
      input.state.newFlow = null;
      input.state.phase = "idle";
      input.appendStatus(`config written: ${input.state.configPath}`);
      input.appendStatus(`profile: ${profile.label} | question: ${question}`);
      if (profile.warning) {
        input.appendWarning(profile.warning);
      }
      input.requestRender();

      if (runMode === "live" && !input.state.hasApiKey) {
        input.appendError("OPENROUTER_API_KEY is missing; run /run mock or set the key");
        input.requestRender();
        return;
      }

      if (runMode === "mock" || runMode === "live") {
        void input.startRun(runMode);
      }
    } catch (error) {
      input.appendError(`failed to write config: ${formatError(error)}`);
      input.state.newFlow = null;
      input.state.phase = "idle";
      input.requestRender();
    }
  };

  const openModeOverlay = (profileId: ProfileId): void => {
    input.state.overlay = {
      kind: "select",
      title: "select run mode",
      items: [
        { id: "mock", label: "run mock now", description: "no external api calls" },
        {
          id: "live",
          label: "run live now",
          description: "uses OPENROUTER_API_KEY and real model calls"
        },
        { id: "none", label: "save only", description: "write config and return to transcript" }
      ],
      selectedIndex: 0,
      onSelect: (item) => {
        input.state.overlay = null;
        if (!isRunModeSelection(item.id)) {
          input.state.newFlow = null;
          input.state.phase = "idle";
          input.appendError(`invalid run mode selection: ${item.id}`);
          input.requestRender();
          return;
        }
        finalizeIntake(profileId, item.id);
      },
      onCancel: () => {
        input.state.overlay = null;
        input.state.newFlow = null;
        input.state.phase = "idle";
        input.appendStatus("intake cancelled");
        input.requestRender();
      }
    };
    input.requestRender();
  };

  const openProfileOverlay = (): void => {
    input.state.overlay = {
      kind: "select",
      title: "select profile",
      items: createProfileItems(),
      selectedIndex: 0,
      onSelect: (item) => {
        input.state.overlay = null;
        if (!isProfileId(item.id)) {
          input.state.newFlow = null;
          input.state.phase = "idle";
          input.appendError(`invalid profile selection: ${item.id}`);
          input.requestRender();
          return;
        }
        const profileId = item.id;
        input.state.profileId = profileId;
        if (input.state.newFlow) {
          input.state.newFlow.profileId = profileId;
          input.state.newFlow.stage = "select_mode";
        }
        openModeOverlay(profileId);
      },
      onCancel: () => {
        input.state.overlay = null;
        input.state.newFlow = null;
        input.state.phase = "idle";
        input.appendStatus("intake cancelled");
        input.requestRender();
      }
    };
    input.requestRender();
  };

  const startNewFlow = (): void => {
    if (input.state.phase === "running") {
      input.appendStatus("run in progress. wait for completion before /new");
      input.requestRender();
      return;
    }
    if (input.state.newFlow) {
      input.appendStatus("intake already active. finish or cancel the current intake flow first");
      input.requestRender();
      return;
    }

    input.state.phase = "intake";
    input.state.newFlow = { stage: "await_question" };
    input.appendSystem("new study intake started. enter your research question, then press enter");
    input.requestRender();
  };

  const handlePlainInput = (value: string): void => {
    if (input.state.newFlow?.stage === "await_question") {
      input.state.newFlow.question = value;
      input.state.newFlow.stage = "select_profile";
      input.state.question = value;
      input.appendStatus("question recorded. choose a profile");
      openProfileOverlay();
      return;
    }

    input.appendStatus("input noted. use slash commands (try /help)");
    input.requestRender();
  };

  return {
    startNewFlow,
    handlePlainInput
  };
};
