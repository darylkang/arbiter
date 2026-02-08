import {
  getEditorKeybindings,
  truncateToWidth,
  type Component,
  type SelectListTheme,
  wrapTextWithAnsi
} from "@mariozechner/pi-tui";

export type ChecklistItem = {
  id: string;
  label: string;
  description?: string;
  selected: boolean;
  disabled?: boolean;
};

type ChecklistRow =
  | {
      kind: "item";
      item: ChecklistItem;
    }
  | {
      kind: "confirm";
      label: string;
      description?: string;
    }
  | {
      kind: "cancel";
      label: string;
      description?: string;
    };

type ChecklistActions = {
  confirmLabel: string;
  cancelLabel: string;
};

export class ChecklistList implements Component {
  private readonly items: ChecklistItem[];
  private readonly maxVisible: number;
  private readonly theme: SelectListTheme;
  private readonly actions: ChecklistActions;
  private selectedIndex = 0;

  onSelectionChange?: (index: number) => void;
  onToggle?: (item: ChecklistItem) => void;
  onConfirm?: () => void;
  onCancel?: () => void;

  constructor(
    items: ChecklistItem[],
    maxVisible: number,
    theme: SelectListTheme,
    actions: ChecklistActions
  ) {
    this.items = items;
    this.maxVisible = maxVisible;
    this.theme = theme;
    this.actions = actions;
  }

  setSelectedIndex(index: number): void {
    const max = Math.max(0, this.rows().length - 1);
    this.selectedIndex = Math.max(0, Math.min(index, max));
  }

  invalidate(): void {
    // no cached state
  }

  private rows(): ChecklistRow[] {
    return [
      ...this.items.map((item) => ({ kind: "item", item }) as const),
      {
        kind: "confirm",
        label: this.actions.confirmLabel,
        description: "Apply the current selections"
      } as const,
      {
        kind: "cancel",
        label: this.actions.cancelLabel,
        description: "Return to the previous step"
      } as const
    ];
  }

  private selectedRow(): ChecklistRow | null {
    const row = this.rows()[this.selectedIndex];
    return row ?? null;
  }

  private notifySelectionChange(): void {
    this.onSelectionChange?.(this.selectedIndex);
  }

  private move(delta: number): void {
    const rows = this.rows();
    if (rows.length === 0) {
      return;
    }
    const max = rows.length - 1;
    if (delta > 0) {
      this.selectedIndex = this.selectedIndex >= max ? 0 : this.selectedIndex + 1;
    } else {
      this.selectedIndex = this.selectedIndex <= 0 ? max : this.selectedIndex - 1;
    }
    this.notifySelectionChange();
  }

  private toggleSelectedItem(): void {
    const row = this.selectedRow();
    if (!row || row.kind !== "item" || row.item.disabled) {
      return;
    }
    row.item.selected = !row.item.selected;
    this.onToggle?.(row.item);
  }

  private activateSelectedRow(): void {
    const row = this.selectedRow();
    if (!row) {
      return;
    }
    if (row.kind === "item") {
      this.toggleSelectedItem();
      return;
    }
    if (row.kind === "confirm") {
      this.onConfirm?.();
      return;
    }
    this.onCancel?.();
  }

  render(width: number): string[] {
    const rows = this.rows();
    if (rows.length === 0) {
      return [this.theme.noMatch("  No options available")];
    }

    const safeWidth = Math.max(20, width);
    const maxLineWidth = Math.max(12, safeWidth - 2);
    const lines: string[] = [];

    const startIndex = Math.max(
      0,
      Math.min(this.selectedIndex - Math.floor(this.maxVisible / 2), rows.length - this.maxVisible)
    );
    const endIndex = Math.min(startIndex + this.maxVisible, rows.length);

    for (let i = startIndex; i < endIndex; i += 1) {
      const row = rows[i];
      if (!row) {
        continue;
      }
      const selected = i === this.selectedIndex;
      const rowLabel =
        row.kind === "item"
          ? `${row.item.disabled ? "◌" : row.item.selected ? "☑" : "☐"} ${row.item.label}`
          : `◉ ${row.label}`;
      const prefix = selected ? "→ " : "  ";
      const text = `${prefix}${truncateToWidth(rowLabel, maxLineWidth - prefix.length, "")}`;
      lines.push(selected ? this.theme.selectedText(text) : text);
    }

    if (startIndex > 0 || endIndex < rows.length) {
      lines.push(this.theme.scrollInfo(`  (${this.selectedIndex + 1}/${rows.length})`));
    }

    const selected = this.selectedRow();
    const description =
      selected?.kind === "item" ? selected.item.description : selected?.description;
    if (description) {
      lines.push("");
      const wrapped = wrapTextWithAnsi(description, Math.max(10, safeWidth - 4));
      for (const line of wrapped) {
        lines.push(this.theme.description(`  ${line}`));
      }
    }

    lines.push("");
    lines.push(this.theme.scrollInfo("  Space toggle · Enter select · Esc back"));

    return lines;
  }

  handleInput(data: string): void {
    const kb = getEditorKeybindings();
    if (kb.matches(data, "selectUp")) {
      this.move(-1);
      return;
    }
    if (kb.matches(data, "selectDown")) {
      this.move(1);
      return;
    }
    if (kb.matches(data, "selectCancel")) {
      this.onCancel?.();
      return;
    }
    if (data === " ") {
      this.toggleSelectedItem();
      return;
    }
    if (kb.matches(data, "selectConfirm")) {
      this.activateSelectedRow();
    }
  }
}
