import { type Component, visibleWidth, wrapTextWithAnsi } from "@mariozechner/pi-tui";

import { renderProgressSummary } from "./progress.js";
import type { AppState, GuidedSetupState, TranscriptEntry } from "../state.js";
import { palette } from "../theme.js";

const MAX_RENDERED_CARDS = 24;
const MAX_ACTIVITY_LINES = 10;
const MAX_RECEIPT_LINES = 22;

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
  return "activity";
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

const toCardLines = (rawLines: string[], width: number): string[] => {
  const contentWidth = Math.max(18, width - 4);
  const wrapped: string[] = [];

  for (const rawLine of rawLines) {
    const segments = wrapTextWithAnsi(rawLine || " ", contentWidth);
    wrapped.push(...segments);
  }

  return wrapped;
};

const renderCard = (card: StageCard, width: number): string[] => {
  const cardWidth = Math.max(30, Math.min(width, 88));
  const titleText = `${cardKindLabel(card.kind).toUpperCase()} • ${card.status === "active" ? "active" : "frozen"}`;
  const title = card.status === "active" ? palette.amber(titleText) : palette.steel(titleText);
  const contentWidth = Math.max(18, cardWidth - 4);

  const top = `╔${"═".repeat(cardWidth - 2)}╗`;
  const titleLine = `║ ${padAnsi(title, contentWidth)} ║`;
  const divider = `╟${"─".repeat(cardWidth - 2)}╢`;
  const body = toCardLines([card.title, "", ...card.lines], cardWidth).map(
    (line) => `║ ${padAnsi(line, contentWidth)} ║`
  );
  const bottom = `╚${"═".repeat(cardWidth - 2)}╝`;

  return [top, titleLine, divider, ...body, bottom];
};

const isRunTerminalLine = (entry: TranscriptEntry): boolean => {
  if (entry.kind === "status" && entry.content.startsWith("Run complete:")) {
    return true;
  }
  return entry.kind === "error" && entry.content.startsWith("Run failed:");
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
          ? `2. Choose quick start or setup wizard (${state.configCount} config file${state.configCount === 1 ? "" : "s"} detected).`
          : "2. Continue with setup wizard (quick start requires a valid config file).",
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
        "Type your research question in the input area and press Enter.",
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

const buildActiveRunCard = (state: AppState, width: number): StageCard => {
  const progressLines = renderProgressSummary(state.runProgress, width).split("\n");
  const workerRows = Object.entries(state.runProgress.workerStatus)
    .map(([workerId, worker]) =>
      worker.status === "busy"
        ? `worker ${workerId}: busy (trial ${worker.trialId ?? "-"})`
        : `worker ${workerId}: idle`
    )
    .slice(0, 6);

  const hiddenWorkers = Math.max(0, Object.keys(state.runProgress.workerStatus).length - workerRows.length);
  const latest = state.runProgress.recentBatches[state.runProgress.recentBatches.length - 1];

  const batchCard = latest
    ? [
        `Batch ${latest.batchNumber}: novelty ${formatMaybe(latest.noveltyRate)} | mean similarity ${formatMaybe(latest.meanMaxSim)} | groups ${latest.clusterCount ?? "-"}`,
        "Groups reflect embedding similarity, not semantic categories.",
        "Stopping indicates diminishing novelty, not correctness."
      ]
    : ["Waiting for first batch boundary metrics."];

  return {
    kind: "run",
    status: "active",
    title: `Run in progress (${state.runMode ?? "mock"})`,
    lines: [
      ...progressLines,
      "",
      ...workerRows,
      ...(hiddenWorkers > 0 ? [`... ${hiddenWorkers} additional workers hidden`] : []),
      "",
      ...batchCard
    ]
  };
};

const buildPostRunPlaceholder = (state: AppState): StageCard => ({
  kind: "receipt",
  status: "active",
  title: "Receipt pending",
  lines: [
    state.runDir ? `Run directory: ${state.runDir}` : "Run directory will appear here when available.",
    "Choose the next action from the selector to continue."
  ]
});

const entryToActivityLines = (entry: TranscriptEntry): string[] => {
  if (entry.kind === "report" || entry.kind === "verify") {
    return entry.content.split("\n");
  }
  return [entry.content];
};

const shouldIncludeInActivity = (entry: TranscriptEntry): boolean => {
  if (entry.kind === "warning" || entry.kind === "error" || entry.kind === "report" || entry.kind === "verify") {
    return true;
  }
  if (entry.kind === "system" || entry.kind === "user") {
    return true;
  }
  if (entry.kind === "status") {
    if (entry.content.startsWith("Batch ")) {
      return false;
    }
    if (entry.content.startsWith("Run started:")) {
      return false;
    }
    return true;
  }
  return false;
};

const buildFrozenCards = (entries: TranscriptEntry[]): { cards: StageCard[]; consumedIds: Set<string> } => {
  const cards: StageCard[] = [];
  const consumedIds = new Set<string>();

  let pendingRunCard: StageCard | null = null;

  for (const entry of entries) {
    if (entry.content.startsWith("Stage 1 · Intake\n")) {
      const lines = entry.content.split("\n").slice(1);
      const intakeCard: StageCard = {
        kind: "intake",
        status: "frozen",
        title: "Intake summary",
        lines
      };
      cards.push(intakeCard);
      consumedIds.add(entry.id);
      pendingRunCard = null;
      continue;
    }

    if (isRunTerminalLine(entry)) {
      const runCard: StageCard = {
        kind: "run",
        status: "frozen",
        title: "Run summary",
        lines: [entry.content]
      };
      cards.push(runCard);
      consumedIds.add(entry.id);
      pendingRunCard = runCard;
      continue;
    }

    if (entry.kind === "status" && entry.content.startsWith("Artifacts written to ") && pendingRunCard) {
      pendingRunCard.lines.push(entry.content);
      consumedIds.add(entry.id);
      continue;
    }

    if (entry.kind === "receipt") {
      const rawLines = entry.content.split("\n");
      const lines =
        rawLines.length > MAX_RECEIPT_LINES
          ? [...rawLines.slice(0, MAX_RECEIPT_LINES), `... ${rawLines.length - MAX_RECEIPT_LINES} additional lines`]
          : rawLines;
      cards.push({
        kind: "receipt",
        status: "frozen",
        title: "Receipt",
        lines
      });
      consumedIds.add(entry.id);
      pendingRunCard = null;
      continue;
    }
  }

  return { cards, consumedIds };
};

const buildActivityCard = (entries: TranscriptEntry[], consumedIds: Set<string>): StageCard | null => {
  const activityEntries = entries.filter((entry) => !consumedIds.has(entry.id) && shouldIncludeInActivity(entry));
  if (activityEntries.length === 0) {
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

const buildCards = (state: AppState, width: number): StageCard[] => {
  const { cards: frozenCards, consumedIds } = buildFrozenCards(state.transcript);
  const cards: StageCard[] = [...frozenCards];

  if (state.phase === "intake" || (state.phase === "idle" && !state.newFlow)) {
    cards.push(buildActiveIntakeCard(state));
  } else if (state.phase === "running") {
    cards.push(buildActiveRunCard(state, width));
  } else if (state.phase === "post-run") {
    const hasReceiptCard = cards.some((card) => card.kind === "receipt");
    if (!hasReceiptCard) {
      cards.push(buildPostRunPlaceholder(state));
    }
  }

  const activityCard = buildActivityCard(state.transcript, consumedIds);
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

    // When an overlay is active, render a clean backdrop so list text does not
    // visually blend with underlying stage cards in constrained terminals.
    let lines: string[] = [];
    if (state.overlay) {
      lines = [blankLine, blankLine, blankLine];
    } else {
      const cards = buildCards(state, safeWidth);
      for (const card of cards) {
        lines.push(...renderCard(card, safeWidth), "");
      }

      if (lines.length === 0) {
        lines = [blankLine, "Guided setup will appear here.", blankLine];
      }
    }

    if (lines.length < this.lastRenderedLineCount) {
      lines = [...lines, ...new Array(this.lastRenderedLineCount - lines.length).fill(blankLine)];
    }
    this.lastRenderedLineCount = lines.length;
    return lines;
  }
}
