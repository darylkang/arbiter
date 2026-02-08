import {
  Container,
  SelectList,
  Spacer,
  Text,
  type Component,
  type SelectItem,
  wrapTextWithAnsi
} from "@mariozechner/pi-tui";

import type { ChecklistOverlay, ConfirmOverlay, OverlayState, SelectOverlay } from "../state.js";
import { selectListTheme } from "../theme.js";

export type OverlayComponent = {
  component: Component;
  focusTarget: Component;
};

type OverlayRenderOptions = {
  width: number;
};

const wrapBlock = (text: string, width: number): string => {
  return text
    .split("\n")
    .flatMap((line) => wrapTextWithAnsi(line || " ", Math.max(14, width - 6)))
    .join("\n");
};

const withTitle = (input: {
  title: string;
  component: Component;
  width: number;
  body?: string;
}): Component => {
  const safeWidth = Math.max(32, input.width);
  const container = new Container();
  container.addChild(new Text(wrapBlock(input.title, safeWidth), 1, 0));
  if (input.body) {
    container.addChild(new Spacer(1));
    container.addChild(new Text(wrapBlock(input.body, safeWidth), 1, 0));
  }
  container.addChild(new Spacer(1));
  container.addChild(input.component);
  return container;
};

const buildSelectRows = (items: SelectOverlay["items"]): SelectItem[] => {
  return items.map((item) => ({
    value: item.id,
    label: `${item.disabled ? "◌" : "◉"} ${item.label}`
  }));
};

const buildSelectBody = (overlay: SelectOverlay): string | undefined => {
  const sections: string[] = [];

  if (overlay.body?.trim()) {
    sections.push(overlay.body.trim());
  }

  const describedItems = overlay.items.filter((item) => item.description?.trim());
  if (describedItems.length > 0 && describedItems.length <= 6) {
    const details = describedItems.map((item) => {
      const unavailable = item.disabled ? " (unavailable)" : "";
      return `• ${item.label}${unavailable}: ${item.description?.trim() ?? ""}`;
    });
    sections.push(details.join("\n"));
  }

  if (sections.length === 0) {
    return undefined;
  }

  return sections.join("\n\n");
};

const createSelectOverlay = (
  overlay: SelectOverlay,
  _requestRefresh: () => void,
  renderOptions: OverlayRenderOptions
): OverlayComponent => {
  const list = new SelectList(buildSelectRows(overlay.items), Math.max(7, Math.min(12, overlay.items.length)), selectListTheme);
  list.setSelectedIndex(Math.max(0, Math.min(overlay.selectedIndex, overlay.items.length - 1)));
  list.onSelectionChange = (item): void => {
    const index = overlay.items.findIndex((candidate) => candidate.id === item.value);
    if (index >= 0) {
      overlay.selectedIndex = index;
    }
  };
  list.onSelect = (item): void => {
    const selected = overlay.items.find((candidate) => candidate.id === item.value);
    if (selected) {
      overlay.onSelect(selected);
    }
  };
  list.onCancel = (): void => {
    overlay.onCancel();
  };
  return {
    component: withTitle({
      title: overlay.title,
      component: list,
      width: renderOptions.width,
      body: buildSelectBody(overlay)
    }),
    focusTarget: list
  };
};

const createConfirmOverlay = (
  overlay: ConfirmOverlay,
  renderOptions: OverlayRenderOptions
): OverlayComponent => {
  const choices: SelectItem[] = [
    { value: "confirm", label: `◉ ${overlay.confirmLabel}` },
    { value: "cancel", label: `◉ ${overlay.cancelLabel}` }
  ];
  const list = new SelectList(choices, 4, selectListTheme);
  list.setSelectedIndex(Math.max(0, Math.min(overlay.selectedIndex, choices.length - 1)));
  list.onSelectionChange = (item): void => {
    overlay.selectedIndex = item.value === "cancel" ? 1 : 0;
  };
  list.onSelect = (item): void => {
    if (item.value === "confirm") {
      overlay.onConfirm();
      return;
    }
    overlay.onCancel();
  };
  list.onCancel = (): void => {
    overlay.onCancel();
  };
  return {
    component: withTitle({
      title: overlay.title,
      component: list,
      width: renderOptions.width,
      body: overlay.body
    }),
    focusTarget: list
  };
};

const buildChecklistRows = (overlay: ChecklistOverlay): SelectItem[] => {
  const rows: SelectItem[] = overlay.items.map((item) => ({
    value: item.id,
    label: `${item.selected ? "☑" : "☐"} ${item.label}`
  }));

  rows.push(
    { value: "__confirm__", label: "◉ Apply selections" },
    { value: "__cancel__", label: "◉ Cancel" }
  );

  return rows;
};

const buildChecklistBody = (): string => {
  return "Use Space to toggle options.\nPress Enter to continue.";
};

const createChecklistOverlay = (
  overlay: ChecklistOverlay,
  requestRefresh: () => void,
  renderOptions: OverlayRenderOptions
): OverlayComponent => {
  const renderRows = (): SelectItem[] => buildChecklistRows(overlay);
  const list = new SelectList(
    renderRows(),
    Math.max(8, Math.min(14, overlay.items.length + 2)),
    selectListTheme
  );

  const maxIndex = overlay.items.length + 1;
  list.setSelectedIndex(Math.max(0, Math.min(overlay.selectedIndex, maxIndex)));

  list.onSelectionChange = (item): void => {
    const index = renderRows().findIndex((candidate) => candidate.value === item.value);
    if (index >= 0) {
      overlay.selectedIndex = index;
    }
  };

  list.onSelect = (item): void => {
    if (item.value === "__confirm__") {
      const selectedIds = overlay.items.filter((entry) => entry.selected).map((entry) => entry.id);
      overlay.onConfirm(selectedIds);
      return;
    }

    if (item.value === "__cancel__") {
      overlay.onCancel();
      return;
    }

    const target = overlay.items.find((entry) => entry.id === item.value);
    if (!target || target.disabled) {
      return;
    }
    target.selected = !target.selected;
    requestRefresh();
  };

  list.onCancel = (): void => {
    overlay.onCancel();
  };

  return {
    component: withTitle({
      title: overlay.title,
      component: list,
      width: renderOptions.width,
      body: buildChecklistBody()
    }),
    focusTarget: list
  };
};

const assertNever = (value: never): never => {
  throw new Error(`Unhandled overlay kind: ${JSON.stringify(value)}`);
};

export const createOverlayComponent = (
  overlay: OverlayState,
  requestRefresh: () => void,
  renderOptions: OverlayRenderOptions
): OverlayComponent => {
  switch (overlay.kind) {
    case "select":
      return createSelectOverlay(overlay, requestRefresh, renderOptions);
    case "confirm":
      return createConfirmOverlay(overlay, renderOptions);
    case "checklist":
      return createChecklistOverlay(overlay, requestRefresh, renderOptions);
    default:
      return assertNever(overlay);
  }
};
