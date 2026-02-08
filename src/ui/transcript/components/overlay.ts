import {
  Container,
  SelectList,
  Spacer,
  Text,
  type Component,
  type SelectItem
} from "@mariozechner/pi-tui";

import type { ChecklistOverlay, ConfirmOverlay, OverlayState, SelectOverlay } from "../state.js";
import { selectListTheme } from "../theme.js";

const mapSelectItems = (items: SelectOverlay["items"]): SelectItem[] =>
  items.map((item) => ({
    value: item.id,
    label: `◉ ${item.label}`,
    description: item.description
  }));

const createSelectOverlay = (overlay: SelectOverlay): Component => {
  const list = new SelectList(mapSelectItems(overlay.items), Math.max(7, Math.min(12, overlay.items.length)), selectListTheme);
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
  return withTitle(overlay.title, list);
};

const createConfirmOverlay = (overlay: ConfirmOverlay): Component => {
  const choices: SelectItem[] = [
    { value: "confirm", label: `◉ ${overlay.confirmLabel}`, description: overlay.body },
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
  return withTitle(overlay.title, list);
};

const buildChecklistItems = (overlay: ChecklistOverlay): SelectItem[] => {
  const rows: SelectItem[] = overlay.items.map((item) => ({
    value: item.id,
    label: `${item.selected ? "☑" : "☐"} ${item.label}`,
    description: item.description
  }));

  rows.push(
    { value: "__confirm__", label: "◉ apply selections", description: "enter confirms selected items" },
    { value: "__cancel__", label: "◉ cancel" }
  );

  return rows;
};

const createChecklistOverlay = (
  overlay: ChecklistOverlay,
  requestRefresh: () => void
): Component => {
  const list = new SelectList(
    buildChecklistItems(overlay),
    Math.max(8, Math.min(14, overlay.items.length + 2)),
    selectListTheme
  );

  const maxIndex = overlay.items.length + 1;
  list.setSelectedIndex(Math.max(0, Math.min(overlay.selectedIndex, maxIndex)));

  list.onSelectionChange = (item): void => {
    const index = buildChecklistItems(overlay).findIndex((candidate) => candidate.value === item.value);
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

  return withTitle(overlay.title, list);
};

const withTitle = (title: string, component: Component): Component => {
  const container = new Container();
  container.addChild(new Text(title, 1, 0));
  container.addChild(new Spacer(1));
  container.addChild(component);
  return container;
};

export const createOverlayComponent = (
  overlay: OverlayState,
  requestRefresh: () => void
): Component => {
  switch (overlay.kind) {
    case "select":
      return createSelectOverlay(overlay);
    case "confirm":
      return createConfirmOverlay(overlay);
    case "checklist":
      return createChecklistOverlay(overlay, requestRefresh);
    default:
      return createSelectOverlay(overlay as SelectOverlay);
  }
};
