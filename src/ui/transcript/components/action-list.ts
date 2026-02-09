import {
  getEditorKeybindings,
  type Component,
  type SelectListTheme,
  wrapTextWithAnsi
} from "@mariozechner/pi-tui";

export type ActionItem = {
  id: string;
  label: string;
  description?: string;
  disabled?: boolean;
};

export class ActionList implements Component {
  private readonly items: ActionItem[];
  private readonly maxVisible: number;
  private readonly theme: SelectListTheme;
  private selectedIndex = 0;

  onSelectionChange?: (index: number) => void;
  onSelect?: (item: ActionItem) => void;
  onCancel?: () => void;

  constructor(items: ActionItem[], maxVisible: number, theme: SelectListTheme) {
    this.items = items;
    this.maxVisible = maxVisible;
    this.theme = theme;
  }

  private firstEnabledIndex(): number {
    const index = this.items.findIndex((item) => !item.disabled);
    return index >= 0 ? index : 0;
  }

  private isEnabledIndex(index: number): boolean {
    const item = this.items[index];
    return Boolean(item) && !item?.disabled;
  }

  setSelectedIndex(index: number): void {
    if (this.items.length === 0) {
      this.selectedIndex = 0;
      return;
    }
    const max = this.items.length - 1;
    const clamped = Math.max(0, Math.min(index, max));
    this.selectedIndex = this.isEnabledIndex(clamped) ? clamped : this.firstEnabledIndex();
  }

  invalidate(): void {
    // no cached state
  }

  private notifySelectionChange(): void {
    this.onSelectionChange?.(this.selectedIndex);
  }

  private move(delta: number): void {
    if (this.items.length === 0) {
      return;
    }
    let next = this.selectedIndex;
    for (let hop = 0; hop < this.items.length; hop += 1) {
      if (delta > 0) {
        next = next >= this.items.length - 1 ? 0 : next + 1;
      } else {
        next = next <= 0 ? this.items.length - 1 : next - 1;
      }
      if (this.isEnabledIndex(next)) {
        this.selectedIndex = next;
        this.notifySelectionChange();
        return;
      }
    }
  }

  private selectedItem(): ActionItem | null {
    return this.items[this.selectedIndex] ?? null;
  }

  private activateSelected(): void {
    const item = this.selectedItem();
    if (!item || item.disabled) {
      return;
    }
    this.onSelect?.(item);
  }

  render(width: number): string[] {
    if (this.items.length === 0) {
      return [this.theme.noMatch("  No options available")];
    }

    const safeWidth = Math.max(24, width);
    const contentWidth = Math.max(16, safeWidth - 2);
    const lines: string[] = [];

    const startIndex = Math.max(
      0,
      Math.min(this.selectedIndex - Math.floor(this.maxVisible / 2), this.items.length - this.maxVisible)
    );
    const endIndex = Math.min(this.items.length, startIndex + this.maxVisible);

    for (let index = startIndex; index < endIndex; index += 1) {
      const item = this.items[index];
      const selected = index === this.selectedIndex;
      const indicator = selected ? "●" : "○";
      const disabledSuffix = item.disabled ? " (unavailable)" : "";
      const baseLabel = `${indicator} ${item.label}${disabledSuffix}`;
      const prefix = selected ? "→ " : "  ";
      const wrappedLabel = wrapTextWithAnsi(baseLabel, Math.max(10, contentWidth - prefix.length));

      wrappedLabel.forEach((segment, segmentIndex) => {
        const segmentPrefix = segmentIndex === 0 ? prefix : "  ";
        const line = `${segmentPrefix}${segment}`;
        lines.push(selected ? this.theme.selectedText(line) : line);
      });

      if (item.description?.trim()) {
        const descLines = wrapTextWithAnsi(item.description.trim(), Math.max(10, contentWidth - 4));
        for (const descLine of descLines) {
          lines.push(this.theme.description(`    ${descLine}`));
        }
      }
    }

    if (startIndex > 0 || endIndex < this.items.length) {
      lines.push(this.theme.scrollInfo(`  (${this.selectedIndex + 1}/${this.items.length})`));
    }

    lines.push("");
    lines.push(this.theme.scrollInfo("  ↑/↓ move · Enter select · Esc back"));

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
    if (kb.matches(data, "selectConfirm")) {
      this.activateSelected();
    }
  }
}
