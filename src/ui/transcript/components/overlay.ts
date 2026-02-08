import {
  Container,
  SelectList,
  Spacer,
  Text,
  type Component,
  type SelectItem,
  visibleWidth,
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

type RowBudgets = {
  labelWidth: number;
  descriptionWidth: number;
};

const ellipsize = (text: string, maxWidth: number): string => {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (maxWidth <= 0) {
    return "";
  }
  if (visibleWidth(normalized) <= maxWidth) {
    return normalized;
  }

  const targetWidth = Math.max(1, maxWidth - 1);
  let acc = "";
  for (const char of [...normalized]) {
    const next = `${acc}${char}`;
    if (visibleWidth(next) > targetWidth) {
      break;
    }
    acc = next;
  }
  return `${acc.trimEnd()}…`;
};

const resolveRowBudgets = (width: number): RowBudgets => {
  const safeWidth = Math.max(32, width);

  if (safeWidth < 84) {
    return {
      labelWidth: Math.max(14, safeWidth - 14),
      descriptionWidth: 0
    };
  }

  if (safeWidth < 104) {
    return {
      labelWidth: 26,
      descriptionWidth: 20
    };
  }

  return {
    labelWidth: 34,
    descriptionWidth: Math.max(24, Math.min(40, safeWidth - 56))
  };
};

const formatItemLabel = (input: {
  text: string;
  disabled: boolean;
  budgets: RowBudgets;
}): string => {
  const prefix = input.disabled ? "◌" : "◉";
  const suffix = input.disabled ? " (unavailable)" : "";
  return `${prefix} ${ellipsize(`${input.text}${suffix}`, input.budgets.labelWidth)}`;
};

const formatItemDescription = (input: {
  description?: string;
  disabled: boolean;
  budgets: RowBudgets;
}): string | undefined => {
  if (input.budgets.descriptionWidth <= 0) {
    return undefined;
  }

  if (!input.description) {
    return input.disabled ? "unavailable" : undefined;
  }

  return ellipsize(input.description, input.budgets.descriptionWidth);
};

const mapSelectItems = (items: SelectOverlay["items"], renderOptions: OverlayRenderOptions): SelectItem[] => {
  const budgets = resolveRowBudgets(renderOptions.width);
  return items.map((item) => ({
    value: item.id,
    label: formatItemLabel({
      text: item.label,
      disabled: Boolean(item.disabled),
      budgets
    }),
    description: formatItemDescription({
      description: item.description,
      disabled: Boolean(item.disabled),
      budgets
    })
  }));
};

const createSelectOverlay = (
  overlay: SelectOverlay,
  renderOptions: OverlayRenderOptions
): OverlayComponent => {
  const list = new SelectList(
    mapSelectItems(overlay.items, renderOptions),
    Math.max(7, Math.min(12, overlay.items.length)),
    selectListTheme
  );
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
    component: withTitle(overlay.title, list, renderOptions.width, overlay.body),
    focusTarget: list
  };
};

const createConfirmOverlay = (
  overlay: ConfirmOverlay,
  renderOptions: OverlayRenderOptions
): OverlayComponent => {
  const budgets = resolveRowBudgets(renderOptions.width);
  const choices: SelectItem[] = [
    {
      value: "confirm",
      label: formatItemLabel({ text: overlay.confirmLabel, disabled: false, budgets }),
      description: formatItemDescription({
        description: overlay.body,
        disabled: false,
        budgets
      })
    },
    {
      value: "cancel",
      label: formatItemLabel({ text: overlay.cancelLabel, disabled: false, budgets })
    }
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
    component: withTitle(overlay.title, list, renderOptions.width),
    focusTarget: list
  };
};

const buildChecklistItems = (
  overlay: ChecklistOverlay,
  renderOptions: OverlayRenderOptions
): SelectItem[] => {
  const budgets = resolveRowBudgets(renderOptions.width);
  const rows: SelectItem[] = overlay.items.map((item) => ({
    value: item.id,
    label: `${item.selected ? "☑" : "☐"} ${ellipsize(item.label, budgets.labelWidth)}`,
    description: formatItemDescription({
      description: item.description,
      disabled: false,
      budgets
    })
  }));

  rows.push(
    {
      value: "__confirm__",
      label: formatItemLabel({
        text: "Apply selections",
        disabled: false,
        budgets
      }),
      description: formatItemDescription({
        description: "Press Enter to continue",
        disabled: false,
        budgets
      })
    },
    {
      value: "__cancel__",
      label: formatItemLabel({
        text: "Cancel",
        disabled: false,
        budgets
      })
    }
  );

  return rows;
};

const createChecklistOverlay = (
  overlay: ChecklistOverlay,
  requestRefresh: () => void,
  renderOptions: OverlayRenderOptions
): OverlayComponent => {
  const renderItems = (): SelectItem[] => buildChecklistItems(overlay, renderOptions);
  const list = new SelectList(
    renderItems(),
    Math.max(8, Math.min(14, overlay.items.length + 2)),
    selectListTheme
  );

  const maxIndex = overlay.items.length + 1;
  list.setSelectedIndex(Math.max(0, Math.min(overlay.selectedIndex, maxIndex)));

  list.onSelectionChange = (item): void => {
    const index = renderItems().findIndex((candidate) => candidate.value === item.value);
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
    component: withTitle(overlay.title, list, renderOptions.width),
    focusTarget: list
  };
};

const wrapBody = (body: string, width: number): string => {
  const wrappedLines = body
    .split("\n")
    .flatMap((line) => wrapTextWithAnsi(line || " ", Math.max(12, width - 6)));
  return wrappedLines.join("\n");
};

const withTitle = (title: string, component: Component, width: number, body?: string): Component => {
  const safeWidth = Math.max(32, width);
  const container = new Container();
  container.addChild(new Text(ellipsize(title, safeWidth - 6), 1, 0));
  if (body) {
    container.addChild(new Spacer(1));
    container.addChild(new Text(wrapBody(body, safeWidth), 1, 0));
  }
  container.addChild(new Spacer(1));
  container.addChild(component);
  return container;
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
      return createSelectOverlay(overlay, renderOptions);
    case "confirm":
      return createConfirmOverlay(overlay, renderOptions);
    case "checklist":
      return createChecklistOverlay(overlay, requestRefresh, renderOptions);
    default:
      return assertNever(overlay);
  }
};
