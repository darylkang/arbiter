import assert from "node:assert/strict";
import test from "node:test";

import { ActionList } from "../../dist/ui/transcript/components/action-list.js";

const theme = {
  selectedText: (text) => text,
  description: (text) => text,
  scrollInfo: (text) => text,
  noMatch: (text) => text
};

const selectedLine = (list) => list.render(80).find((line) => line.trimStart().startsWith("→ "));

test("ActionList selects the first enabled option when initial index is disabled", () => {
  const list = new ActionList(
    [
      { id: "quickstart", label: "Quick Start", disabled: true },
      { id: "wizard", label: "Setup Wizard" },
      { id: "quit", label: "Quit" }
    ],
    8,
    theme
  );

  list.setSelectedIndex(0);
  assert.match(selectedLine(list) ?? "", /Setup Wizard/);
});

test("ActionList navigation skips disabled rows", () => {
  const list = new ActionList(
    [
      { id: "live", label: "Live run" },
      { id: "quickstart", label: "Quick Start", disabled: true },
      { id: "mock", label: "Mock run" }
    ],
    8,
    theme
  );

  list.setSelectedIndex(0);
  list.handleInput("\u001b[B");
  assert.match(selectedLine(list) ?? "", /Mock run/);
});
