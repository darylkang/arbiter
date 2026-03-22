import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";

import { loadPersonaOptions } from "../../src/ui/wizard/resources.ts";
import { REPO_ROOT } from "../helpers/workspace.mjs";

const writeJson = (filePath, value) => {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

test("loadPersonaOptions reads presentation metadata from the persona catalog", () => {
  const personas = loadPersonaOptions(REPO_ROOT);

  assert.deepEqual(
    personas.map((persona) => ({
      id: persona.id,
      displayName: persona.displayName,
      category: persona.category,
      categoryLabel: persona.categoryLabel,
      isDefault: persona.isDefault
    })),
    [
      {
        id: "persona_neutral",
        displayName: "Neutral",
        category: "baseline",
        categoryLabel: "control",
        isDefault: true
      },
      {
        id: "persona_skeptical",
        displayName: "Skeptical",
        category: "adversarial",
        categoryLabel: "adversarial",
        isDefault: false
      },
      {
        id: "persona_precise",
        displayName: "Analytical",
        category: "analytical",
        categoryLabel: "structured",
        isDefault: false
      },
      {
        id: "persona_exploratory",
        displayName: "Exploratory",
        category: "divergent",
        categoryLabel: "divergent",
        isDefault: false
      },
      {
        id: "persona_decisive",
        displayName: "Decisive",
        category: "decisive",
        categoryLabel: "convergent",
        isDefault: false
      }
    ]
  );
  assert.equal(personas[0]?.whenToUse, "Use as the format-matched control for prompted-persona comparisons.");
});

test("loadPersonaOptions rejects catalog and manifest drift as a hard error", () => {
  const assetRoot = mkdtempSync(join(tmpdir(), "arbiter-persona-catalog-"));

  try {
    writeJson(join(assetRoot, "resources/prompts/manifest.json"), {
      schema_version: "1.0.0",
      hash_algorithm: "sha256",
      prompt_bank_stage: "curated",
      entries: [
        {
          id: "persona_neutral",
          type: "participant_persona",
          path: "resources/prompts/personas/neutral.txt",
          sha256: "40b4c34ffb101c0870429062b3140e0cb107593f78db94f413d8c5ea9339e509",
          description: "Format-matched control condition."
        }
      ]
    });

    writeJson(join(assetRoot, "resources/prompts/personas/catalog.json"), {
      schema_version: "1.0.0",
      personas: [
        {
          id: "persona_neutral",
          display_name: "Neutral",
          subtitle: "Format-matched control condition",
          category: "baseline",
          when_to_use: "Use as the format-matched control for prompted-persona comparisons.",
          expected_effect:
            "Expected to absorb prompt-presence effects without steering answers toward a specific reasoning posture.",
          default: true,
          sort_order: 0
        },
        {
          id: "persona_skeptical",
          display_name: "Skeptical",
          subtitle: "Strongest-objection stress test",
          category: "adversarial",
          when_to_use: "Use when you want models to challenge their own answer before committing.",
          expected_effect:
            "Expected to widen the distribution by increasing objections, caveats, or reversals.",
          default: false,
          sort_order: 1
        }
      ]
    });

    assert.throws(
      () => loadPersonaOptions(assetRoot),
      /persona catalog and prompt manifest are out of sync/
    );
  } finally {
    rmSync(assetRoot, { recursive: true, force: true });
  }
});
