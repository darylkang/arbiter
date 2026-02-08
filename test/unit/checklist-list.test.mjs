import assert from "node:assert/strict";
import test from "node:test";

import { ChecklistList } from "../../dist/ui/transcript/components/checklist-list.js";

const theme = {
  selectedPrefix: (text) => text,
  selectedText: (text) => text,
  description: (text) => text,
  scrollInfo: (text) => text,
  noMatch: (text) => text
};

const createList = (items) =>
  new ChecklistList(items, 8, theme, {
    confirmLabel: "Apply selections",
    cancelLabel: "Cancel"
  });

test("ChecklistList toggles selected item with Space", () => {
  const items = [
    { id: "neutral", label: "Neutral", selected: false },
    { id: "skeptical", label: "Skeptical", selected: false }
  ];
  const list = createList(items);
  let toggleCount = 0;

  list.onToggle = () => {
    toggleCount += 1;
  };

  list.setSelectedIndex(0);
  list.handleInput(" ");
  assert.equal(items[0].selected, true);
  assert.equal(toggleCount, 1);

  list.handleInput("\u001b[B");
  list.handleInput(" ");
  assert.equal(items[1].selected, true);
  assert.equal(toggleCount, 2);
});

test("ChecklistList ignores Space on disabled checklist items", () => {
  const items = [
    { id: "neutral", label: "Neutral", selected: false, disabled: true },
    { id: "skeptical", label: "Skeptical", selected: false }
  ];
  const list = createList(items);
  let toggleCount = 0;
  list.onToggle = () => {
    toggleCount += 1;
  };

  list.setSelectedIndex(0);
  list.handleInput(" ");

  assert.equal(items[0].selected, false);
  assert.equal(toggleCount, 0);
});

test("ChecklistList confirms and cancels through Enter/Escape", () => {
  const items = [{ id: "neutral", label: "Neutral", selected: true }];
  const list = createList(items);
  let confirmed = 0;
  let cancelled = 0;

  list.onConfirm = () => {
    confirmed += 1;
  };
  list.onCancel = () => {
    cancelled += 1;
  };

  list.setSelectedIndex(items.length); // confirm row
  list.handleInput("\r");
  assert.equal(confirmed, 1);

  list.handleInput("\u001b");
  assert.equal(cancelled, 1);
});
