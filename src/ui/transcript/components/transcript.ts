import { type Component, visibleWidth, wrapTextWithAnsi } from "@mariozechner/pi-tui";

import { renderProgressSummary } from "./progress.js";
import type { AppState, GuidedSetupState, TranscriptEntry } from "../state.js";
import { makeBlockTitle } from "../theme.js";

const MAX_RENDERED_CARDS = 32;
const MAX_ACTIVITY_LINES = 12;
const MAX_RECEIPT_LINES = 28;

type StageCardKind = "launch" | "intake" | "run" | "receipt" | "activity";
type StageCardStatus = "active" | "frozen";

type StageCard = {
  kind: StageCardKind;
  status: StageCardStatus;
  title: string;
  lines: string[];
};

const cardKindLabel = (kind: StageCardKind): string => {
  if (kind === "launch") {
    return "launch";
  }
  if (kind === "intake") {
    return "intake";
  }
  if (kind === "run") {
    return "run";
  }
  if (kind === "receipt") {
    return "receipt";
  }
  return "notes";
};

const formatMaybe = (value: number | null | undefined): string => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "-";
  }
  return value.toFixed(3);
};

const padAnsi = (text: string, width: number): string => {
  const printable = Math.max(0, width);
  const current = visibleWidth(text);
  if (current >= printable) {
    return text;
  }
  return `${text}${" ".repeat(printable - current)}`;
};

const toWrappedLines = (rawLines: string[], width: number): string[] => {
  const contentWidth = Math.max(18, width - 4);
  const wrapped: string[] = [];

  for (const rawLine of rawLines) {
    const source = rawLine.length === 0 ? " " : rawLine;
    wrapped.push(...wrapTextWithAnsi(source, contentWidth));
  }

  return wrapped;
};

const renderCard = (card: StageCard, width: number): string[] => {
  const cardWidth = Math.max(40, Math.min(width, 80));
  const title = makeBlockTitle(cardKindLabel(card.kind), card.status === "active");
  const body = toWrappedLines([card.title, "", ...card.lines], cardWidth).map(
    (line) => `  ${padAnsi(line, Math.max(18, cardWidth - 2))}`
  );

  return [title, "", ...body];
};

const stageTitleForStep = (flow: GuidedSetupState): string => {
  switch (flow.stage) {
    case "question":
      return "Step 1/9 · Research question";
    case "labels":
      return "Step 2/9 · Decision labels";
    case "decode":
      return "Step 3/9 · Decode settings";
    case "personas":
      return "Step 4/9 · Personas";
    case "models":
      return "Step 5/9 · Models";
    case "protocol":
      return "Step 6/9 · Protocol";
    case "advanced":
      return "Step 7/9 · Advanced settings";
    case "mode":
      return "Step 8/9 · Run mode";
    case "review":
      return "Step 9/9 · Review setup";
    default:
      return "Guided setup";
  }
};

const formatQuestionSummary = (question: string): string => {
  const trimmed = question.trim();
  if (!trimmed) {
    return "-";
  }
  if (trimmed.length <= 96) {
    return trimmed;
  }
  return `${trimmed.slice(0, 95)}…`;
};

const buildActiveIntakeCard = (state: AppState): StageCard => {
  if (!state.newFlow) {
    const hasQuickStart = state.hasConfig && state.configCount > 0;
    return {
      kind: "launch",
      status: "active",
      title: "Choose how to continue",
      lines: [
        "1. Select run mode (mock or live).",
        hasQuickStart
          ? `2. Choose quick start or setup wizard (${state.configCount} configuration file${state.configCount === 1 ? "" : "s"} detected).`
          : "2. Continue with setup wizard (quick start requires a valid configuration file).",
        "Use arrow keys and Enter to select."
      ]
    };
  }

  const flow = state.newFlow;
  const labels =
    flow.labelMode === "custom" && flow.labels.length > 0 ? flow.labels.join(", ") : "free-form responses";

  const base = [
    `Question: ${flow.question.trim() || "-"}`,
    `Labels: ${labels}`,
    `Run mode: ${flow.runMode}`
  ];

  if (flow.stage === "question") {
    return {
      kind: "intake",
      status: "active",
      title: stageTitleForStep(flow),
      lines: [
        ...base,
        "What is your research question?",
        "Type your question in the input area and press Enter.",
        "Use Esc to cancel setup."
      ]
    };
  }

  if (flow.stage === "labels") {
    return {
      kind: "intake",
      status: "active",
      title: stageTitleForStep(flow),
      lines: [
        ...base,
        flow.labelMode === "custom"
          ? "Enter comma-separated labels in the input area."
          : "Select free-form or custom labels."
      ]
    };
  }

  if (flow.stage === "decode" || flow.stage === "personas" || flow.stage === "models" || flow.stage === "protocol") {
    return {
      kind: "intake",
      status: "active",
      title: stageTitleForStep(flow),
      lines: [
        ...base,
        `Decode: temp ${flow.temperature.toFixed(2)}, top_p ${flow.topP.toFixed(2)}, max_tokens ${flow.maxTokens}, seed ${flow.seed}`,
        `Personas selected: ${flow.personaIds.length}`,
        `Models selected: ${flow.modelSlugs.length}`,
        `Protocol: ${flow.protocol}${flow.protocol === "debate_v1" ? ` (${flow.debateVariant})` : ""}`
      ]
    };
  }

  if (flow.stage === "advanced") {
    return {
      kind: "intake",
      status: "active",
      title: stageTitleForStep(flow),
      lines: [
        ...base,
        `Execution: k_max ${flow.kMax}, workers ${flow.workers}, batch ${flow.batchSize}`,
        "Adjust execution depth if needed, then continue."
      ]
    };
  }

  return {
    kind: "intake",
    status: "active",
    title: stageTitleForStep(flow),
    lines: [
      ...base,
      `Decode: temp ${flow.temperature.toFixed(2)}, top_p ${flow.topP.toFixed(2)}, max_tokens ${flow.maxTokens}, seed ${flow.seed}`,
      `Personas: ${flow.personaIds.join(", ") || "-"}`,
      `Models: ${flow.modelSlugs.join(", ") || "-"}`,
      `Protocol: ${flow.protocol}${flow.protocol === "debate_v1" ? ` (${flow.debateVariant})` : ""}`,
      `Advanced: k_max ${flow.kMax}, workers ${flow.workers}, batch ${flow.batchSize}`,
      "Review the setup and choose Start run to continue."
    ]
  };
};

const buildBatchCardLines = (state: AppState): string[] => {
  const latest = state.runProgress.recentBatches[state.runProgress.recentBatches.length - 1];
  if (!latest) {
    return ["No batch boundary metrics yet."];
  }

  return [
    `Batch ${latest.batchNumber}`,
    `Novelty: ${formatMaybe(latest.noveltyRate)}`,
    `Mean similarity: ${formatMaybe(latest.meanMaxSim)}`,
    `Embedding groups: ${latest.clusterCount ?? "-"}`,
    "Groups reflect embedding similarity, not semantic categories.",
    "Stopping indicates diminishing novelty, not correctness."
  ];
};

const buildActiveRunCard = (state: AppState, width: number): StageCard => {
  const progressLines = renderProgressSummary(state.runProgress, width).split("\n");
  const workerRows = Object.entries(state.runProgress.workerStatus)
    .map(([workerId, worker]) =>
      worker.status === "busy"
        ? `W${workerId} [busy] trial #${worker.trialId ?? "-"}`
        : `W${workerId} [idle]`
    )
    .slice(0, 8);

  const hiddenWorkers = Math.max(0, Object.keys(state.runProgress.workerStatus).length - workerRows.length);

  return {
    kind: "run",
    status: "active",
    title: `Run in progress (${state.runMode ?? "mock"})`,
    lines: [
      `Question: ${formatQuestionSummary(state.question)}`,
      ...progressLines,
      "",
      ...workerRows,
      ...(hiddenWorkers > 0 ? [`... ${hiddenWorkers} additional workers hidden`] : []),
      "",
      ...buildBatchCardLines(state)
    ]
  };
};

const buildPostRunPlaceholder = (state: AppState): StageCard => ({
  kind: "receipt",
  status: "active",
  title: "Receipt pending",
  lines: [
    state.runDir ? `Run directory: ${state.runDir}` : "Run directory will appear here when available.",
    "Choose the next action to continue."
  ]
});

const entryToActivityLines = (entry: TranscriptEntry): string[] => {
  if (entry.kind === "warning") {
    return [`⚠ ${entry.content}`];
  }
  if (entry.kind === "error") {
    return [`✖ ${entry.content}`];
  }
  if (entry.kind === "report" || entry.kind === "verify") {
    const contentLines = entry.content.split("\n");
    if (contentLines.length === 0) {
      return [entry.content];
    }
    return [contentLines[0] || "", ...contentLines.slice(1).map((line) => `  ${line}`)];
  }
  return [entry.content];
};

const shouldIncludeInActivity = (entry: TranscriptEntry): boolean => {
  if (entry.kind === "warning" || entry.kind === "error" || entry.kind === "report" || entry.kind === "verify") {
    return true;
  }
  if (entry.kind === "status") {
    if (entry.content.startsWith("Stage 1 · Intake")) {
      return false;
    }
    if (entry.content.startsWith("Batch ")) {
      return false;
    }
    if (entry.content.startsWith("Run started:")) {
      return false;
    }
    if (entry.content.startsWith("What is your research question?")) {
      return false;
    }
    if (entry.content.startsWith("Set up a new study.")) {
      return false;
    }
    if (entry.content.startsWith("Enter comma-separated labels")) {
      return false;
    }
    if (entry.content.startsWith("Use the guided controls")) {
      return false;
    }
    return true;
  }
  if (entry.kind === "system") {
    return entry.content.startsWith("commands:");
  }

  return false;
};

const buildActivityCard = (entries: TranscriptEntry[], phase: AppState["phase"]): StageCard | null => {
  const activityEntries = entries.filter((entry) => shouldIncludeInActivity(entry));
  if (activityEntries.length === 0) {
    return null;
  }

  const shouldShowOutsidePostRun = activityEntries.some(
    (entry) =>
      entry.kind === "warning" ||
      entry.kind === "error" ||
      entry.kind === "report" ||
      entry.kind === "verify" ||
      (entry.kind === "system" && entry.content.startsWith("commands:"))
  );

  if (phase !== "post-run" && !shouldShowOutsidePostRun) {
    return null;
  }

  const lines = activityEntries
    .flatMap((entry) => entryToActivityLines(entry))
    .slice(-MAX_ACTIVITY_LINES);

  return {
    kind: "activity",
    status: "frozen",
    title: "Session notes",
    lines
  };
};

const buildFrozenCards = (state: AppState): StageCard[] => {
  return state.stageBlocks.map((block) => {
    const lines =
      block.kind === "receipt" && block.lines.length > MAX_RECEIPT_LINES
        ? [...block.lines.slice(0, MAX_RECEIPT_LINES), `... ${block.lines.length - MAX_RECEIPT_LINES} additional lines`]
        : block.lines;

    return {
      kind: block.kind,
      status: "frozen",
      title: block.title,
      lines
    };
  });
};

const buildCards = (state: AppState, width: number): StageCard[] => {
  const cards: StageCard[] = [...buildFrozenCards(state)];

  if (state.phase === "intake" || (state.phase === "idle" && !state.newFlow)) {
    cards.push(buildActiveIntakeCard(state));
  } else if (state.phase === "running") {
    cards.push(buildActiveRunCard(state, width));
  } else if (state.phase === "post-run") {
    const hasReceiptCard = state.stageBlocks.some((block) => block.kind === "receipt");
    if (!hasReceiptCard) {
      cards.push(buildPostRunPlaceholder(state));
    }
  }

  const activityCard = buildActivityCard(state.transcript, state.phase);
  if (activityCard) {
    cards.push(activityCard);
  }

  if (cards.length === 0) {
    cards.push({
      kind: "launch",
      status: "active",
      title: "Welcome to Arbiter",
      lines: ["Choose a run mode and setup path to begin."]
    });
  }

  return cards.slice(-MAX_RENDERED_CARDS);
};

export class TranscriptComponent implements Component {
  private state: AppState | null = null;
  private lastRenderedLineCount = 0;

  setState(state: AppState): void {
    this.state = state;
  }

  invalidate(): void {
    // no cached render state
  }

  render(width: number): string[] {
    const safeWidth = Math.max(40, width);
    const blankLine = " ".repeat(safeWidth);
    const state = this.state;
    if (!state) {
      return [blankLine, "Initializing transcript...", blankLine];
    }

    if (state.overlay) {
      const clearedLineCount = Math.max(48, this.lastRenderedLineCount);
      const lines = new Array(clearedLineCount).fill(blankLine);
      this.lastRenderedLineCount = lines.length;
      return lines;
    }

    const cards = buildCards(state, safeWidth);
    let lines: string[] = [];

    for (const card of cards) {
      lines.push(...renderCard(card, safeWidth), "");
    }

    if (lines.length === 0) {
      lines = [blankLine, "Guided setup will appear here.", blankLine];
    }

    if (lines.length < this.lastRenderedLineCount) {
      lines = [...lines, ...new Array(this.lastRenderedLineCount - lines.length).fill(blankLine)];
    }
    this.lastRenderedLineCount = lines.length;
    return lines;
  }
}
