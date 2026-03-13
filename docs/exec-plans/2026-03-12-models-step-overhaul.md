# Models Step Overhaul

## Purpose / Big Picture

The current Stage 1 `Models` step is structurally sound but underpowered as a decision surface.

It already has a dedicated model catalog, schema validation, compact inline row formatting, and non-blocking warnings for free-tier selections. That is materially better than where the `Personas` step started.

What it lacks is a first-class presentation contract.

Today the step is still mostly a curated catalog browser:

- rows show `{display} · {provider} · {paid/free} · alias`,
- the focused row does not reveal deeper researcher-facing guidance,
- `notes` in the catalog are not surfaced in a disciplined way,
- there is no explicit tier vocabulary beyond `default`, `extended`, and `free`,
- the step helps users scan a list, but not confidently decide which models belong in a study.

This plan upgrades the `Models` step from a compact list into a guidance-rich, research-facing selection surface while preserving the current runtime architecture and compact TUI grammar.

This plan intentionally addresses the **form** of the step first:

1. backend presentation contract,
2. frontend rendering contract,
3. research-facing guidance model,
4. tier vocabulary and grouping semantics.

It intentionally does **not** finalize the long-term model catalog contents or expand the curated set. Catalog curation remains a later step once the form is strong enough to support it.

## Scope Guardrails

### In scope

1. defining the model-catalog presentation contract,
2. deciding which metadata fields the UI should consume,
3. defining tier vocabulary for the first pass,
4. defining the `Models` step row format,
5. defining the focused guidance block above the list,
6. deciding what comes from data versus what remains UI formatting,
7. updating canonical product-spec docs for Step 3,
8. defining validation and acceptance criteria for the step overhaul.

### Out of scope

1. expanding the curated model inventory beyond what is required to exercise the new form,
2. switching to grouped or multi-column layouts in the first implementation pass,
3. changing Stage 1 rail architecture or shared frame ownership,
4. changing run-path semantics or Stage 2/Stage 3 runtime behavior,
5. changing OpenRouter/provider semantics,
6. introducing model weighting UI,
7. introducing domain-role or task-specific model recommendations,
8. changing actual trial sampling semantics.

### Sequencing constraints

1. Freeze the presentation contract before changing catalog schema or loader code.
2. Update canonical product-spec docs before implementation depends on the new contract.
3. Keep the first pass flat and compact; defer grouped headers and responsive split layouts unless the flat version proves inadequate.
4. Treat tier-vocabulary changes as schema-significant and product-visible.

## Progress

- [x] `M0` Current-state audit completed.
- [ ] `M1` Form contract and spec freeze.
- [ ] `M2` Schema/catalog and loader implementation.
- [ ] `M3` Models-step UI implementation.
- [ ] `M4` Validation, capture review, and closeout.

## Surprises & Discoveries

1. The `Models` step already uses a proper dedicated catalog and schema (`resources/models/catalog.json`, `schemas/catalog.schema.json`). The primary weakness is presentation depth, not inventory plumbing.
2. `metadata_complete` in the model catalog is still `false`, which is an explicit signal that the catalog is not yet presentation-complete.
3. The current TUI row format is already good enough to keep as the primary compact row grammar. The missing layer is a focused guidance surface, not a more ornate row.
4. Current `notes` strings in the catalog are informative but not normalized for user-facing guidance. They are useful source material, not yet a finished UI contract.

## Decision Log

1. Follow the same high-level interaction pattern that now works well for `Personas`:
   - compact rows,
   - fixed-height focused guidance block,
   - data-driven defaults and ordering.
2. Do **not** mirror the `Personas` schema exactly. Models need catalog fields that reflect model-selection tradeoffs, not persona rationale.
3. Keep the row grammar as compact inline metadata rather than long prose rows.
4. Defer actual catalog expansion and final model-set curation until the form is ready.

## Context and Orientation

### Relevant current files

- `resources/models/catalog.json`
  - current curated model inventory and presentation metadata
- `schemas/catalog.schema.json`
  - current model catalog schema
- `src/ui/wizard/resources.ts`
  - `loadCatalogModels()` and display normalization
- `src/ui/wizard/types.ts`
  - `CatalogModel` UI shape
- `src/ui/wizard/steps.ts`
  - current Step 3 rendering via `selectMany`
- `docs/product-specs/tui-wizard.md`
  - current Step 3 behavioral contract
- `docs/product-specs/tui-copy-deck.md`
  - current Step 3 copy contract
- `docs/product-specs/tui-visual-screen-deck.md`
  - current Step 3 visual contract
- `output/tmp/models-personas-ui-review.txt`
  - user-pasted current transcript reference
- `output/playwright/tui-visual/2026-03-13T02-39-10-297Z/05-step3-models.txt`
  - current rendered capture of the shipped `Models` step

### Current shipped behavior

The current Step 3 surface renders as:

- static helper line: `Select one or more models for sampling.`
- flat checkbox list
- rows formatted as `{display} · {metadata}`
- a generic free-tier warning when any selected model ends with `:free`

This is clean but thin.

### Terms used in this plan

- **compact row**: the one-line list item used inside `selectMany`
- **focused guidance block**: the fixed-height region above the list that changes with the cursor
- **tier vocabulary**: the user-facing grouping language for model selection, separate from raw provider names
- **presentation contract**: the frozen set of fields and rendering rules the UI depends on

## Plan of Work

The work proceeds in dependency order:

1. freeze the product-facing `Models` step contract,
2. define the catalog field set needed to render that contract,
3. implement the loader and UI model,
4. implement the focused guidance block and row format,
5. validate through unit tests, PTY, capture, and manual review.

## Milestones and Gates

### `M1` Form contract and spec freeze

Outcome:

- the `Models` step has a frozen product contract for:
  - row format,
  - focused guidance layout,
  - tier vocabulary,
  - fixed-height rules,
  - truncation/wrapping rules,
  - what comes from catalog data.

Exit evidence:

1. this plan records the exact first-pass field set,
2. `docs/product-specs/tui-copy-deck.md` and `docs/product-specs/tui-visual-screen-deck.md` are updated for Step 3,
3. `docs/product-specs/tui-wizard.md` reflects the new Step 3 interaction contract,
4. first-pass tier vocabulary is frozen.

Rollback boundary:

- no code changes yet; this is a docs/spec freeze only.

### `M2` Schema/catalog and loader implementation

Outcome:

- the model catalog can drive the Step 3 presentation contract without UI-side hacks.

Exit evidence:

1. `schemas/catalog.schema.json` reflects the frozen first-pass field set,
2. generated types and validation pipeline are updated,
3. `resources/models/catalog.json` carries the required presentation fields for the current curated set,
4. `src/ui/wizard/types.ts` and `src/ui/wizard/resources.ts` expose the richer `CatalogModel` UI shape,
5. any catalog-data mismatch or missing required presentation field fails validation.

Rollback boundary:

- loader and schema changes can be reverted without touching shared TUI controls.

### `M3` Models-step UI implementation

Outcome:

- the `Models` step presents compact rows plus a fixed-height focused guidance block.

Exit evidence:

1. Step 3 uses the new compact row contract,
2. focused guidance updates with cursor movement without vertical jumpiness,
3. free-tier, alias, and other model cautions render through the focused guidance system or selected-state warnings, not ad hoc inline prose,
4. no regressions in shared `selectMany` behavior.

Rollback boundary:

- UI implementation remains isolated to Step 3 plus any minimal shared control plumbing.

### `M4` Validation, capture review, and closeout

Outcome:

- the new Step 3 form is verified and canonical docs are in sync.

Exit evidence:

1. required validation commands pass,
2. capture artifacts confirm the new Step 3 surface,
3. plan is marked completed,
4. any remaining risks are documented truthfully.

Rollback boundary:

- if the new form is visually weak or causes instability, revert to the prior flat-list contract while preserving any safe schema enrichments.

## Concrete Steps

### `M1` Freeze the form contract

1. Freeze the compact row format.

First-pass row contract:

- primary row: `{display_name} · {provider_label} · {tier_label}`
- optional final segment: `alias`
- no long notes inline
- no raw slug in the row

2. Freeze the focused guidance block.

Recommended first-pass guidance block contract:

- line 1: `subtitle`
- line 2: `when_to_use`
- line 3: `risk_note` or blank
- one blank separator line between the guidance block and the list
- fixed height while the cursor moves

3. Freeze the first-pass catalog field set.

Recommended first-pass fields for each model entry:

- `slug`
- `display_name`
- `provider`
- `tier`
- `is_aliased`
- `context_window`
- `subtitle`
- `when_to_use`
- `risk_note` (optional)
- `sort_order`
- `notes` (optional, non-UI source material)

4. Freeze first-pass tier vocabulary.

Recommended first-pass visible tier values:

- `free`
- `low`
- `medium`
- `high`

Migration note:

- current schema/catalog use `default`, `extended`, `free`
- first-pass overhaul should decide whether these remain internal only or whether the visible tier language shifts to `low/medium/high/free`
- if visible tier language changes, it must be reflected in schema/catalog and all product specs together

5. Freeze text-flow rules for Step 3.

Required rules:

- never wrap model names, provider names, or tier labels mid-token,
- prefer truncation over mid-token wrapping in constrained widths,
- guidance text wraps by word only,
- raw slugs appear only in a future details surface if explicitly added,
- notes do not appear inline in rows.

6. Update the canonical Step 3 specs before code implementation.

### `M2` Implement schema and loader changes

1. Extend `schemas/catalog.schema.json` with the frozen first-pass presentation fields.
2. Regenerate catalog types.
3. Update `resources/models/catalog.json` for the current curated set.
4. Extend `CatalogModel` in `src/ui/wizard/types.ts`.
5. Update `loadCatalogModels()` in `src/ui/wizard/resources.ts` to:
   - normalize and expose the chosen display fields,
   - precompute row metadata if that remains the preferred pattern,
   - expose focused-guidance fields directly.
6. Preserve strict schema validation and fail early if required presentation fields are missing.

### `M3` Implement the Step 3 surface

1. Update Step 3 in `src/ui/wizard/steps.ts` to consume the richer `CatalogModel` shape.
2. Reuse the shared `selectMany` focused-guidance mechanism already added for `Personas`.
3. Keep the list rows compact.
4. Route model-selection cautions through the focused guidance block where possible.
5. Preserve a selected-state warning for global conditions such as free-tier selection if it still adds value beyond per-row guidance.
6. Ensure the frozen rail summary remains concise and product-facing.

### `M4` Validate and close out

1. Update Step 3 tests and capture assertions.
2. Re-run the TUI validation lane serially.
3. Review the rendered `05-step3-models.txt` capture.
4. Mark this plan completed only after code and docs are aligned.

## Validation and Acceptance

### Acceptance criteria

The overhaul is complete when all of the following are true:

1. The `Models` step remains fully catalog-driven.
2. The compact row format is stable, scan-friendly, and product-facing.
3. A focused guidance block provides model-specific decision support.
4. The guidance block does not cause vertical jumpiness.
5. Tier language is explicit and consistent.
6. The step helps a researcher understand when and why to select a model, not just what the model is called.
7. The frozen rail summary remains concise.
8. Product-spec docs match the shipped behavior.

### Required validation commands

Run serially from `/Users/darylkang/Developer/arbiter`:

1. `npm run check:types`
2. `npm run check:schemas`
3. `npm run test:unit`
4. `npm run test:ui`
5. `npm run test:e2e:tui`
6. `npm run test:guards`
7. `npm run capture:tui`

### Expected evidence

1. Step 3 rendered capture shows the focused guidance block above the list.
2. No row wraps mid-token at supported widths.
3. Tests assert the new Step 3 strings and layout contract.
4. No regression in other wizard steps using shared controls.

## Idempotence and Recovery

1. Schema and catalog edits should be repeatable and deterministic.
2. If the new visible tier vocabulary proves visually or semantically weak, revert only the vocabulary layer while preserving safe schema enrichments.
3. If the focused guidance surface proves too heavy, revert to the prior flat-list rendering while keeping the richer catalog fields available for a later pass.
4. Do not remove or mutate existing slugs as part of the form overhaul.

## Interfaces and Dependencies

Depends on:

- `schemas/catalog.schema.json`
- `src/generated/catalog.types.ts`
- `src/config/schema-registry.ts`
- `src/config/schema-validation.ts`
- `src/ui/wizard/resources.ts`
- `src/ui/wizard/types.ts`
- `src/ui/wizard/steps.ts`
- `docs/product-specs/tui-wizard.md`
- `docs/product-specs/tui-copy-deck.md`
- `docs/product-specs/tui-visual-screen-deck.md`

Likely to require coordinated test updates in:

- `test/unit/*catalog*.test.mjs`
- `test/e2e/tui-pty.test.mjs`
- `test/e2e/tui-visual-capture.test.mjs`

## Artifacts and Notes

Current audit grade for the shipped `Models` step:

- backend/data foundation: `A-`
- front-end form: `B+`
- research-facing guidance: `B`
- overall current state: `B+ / A-`

Target after this plan:

- backend/data foundation: `A`
- front-end form: `A-`
- research-facing guidance: `A-`
- overall Step 3 form: `A- / A`

## Plan Change Notes

- 2026-03-12: Initial plan drafted from current-state audit of the shipped `Models` step, the current model catalog, and the existing TUI product specs.
