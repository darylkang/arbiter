# Models Step Overhaul

## Purpose / Big Picture

The current Stage 1 `Models` step is structurally sound but underpowered as a decision surface.

It already has a dedicated model catalog, schema validation, compact inline row formatting, and non-blocking warnings for free-tier selections. That is materially better than where the `Personas` step started.

What it lacks is a first-class presentation contract.

Today the step is still mostly a curated catalog browser:

- rows show `{display} · {provider} · {paid/free} · alias`,
- the focused row does not reveal deeper researcher-facing guidance,
- `notes` in the catalog are not surfaced in a disciplined way,
- there is no explicit research-facing tier vocabulary beyond `default`, `extended`, and `free`,
- the step helps users scan a list, but not confidently decide which models belong in a study.

This plan upgrades the `Models` step from a compact list into a guidance-rich, research-facing selection surface while preserving the current runtime architecture and compact TUI grammar.

This plan intentionally addresses the **form** of the step first:

1. backend presentation contract,
2. frontend rendering contract,
3. research-facing guidance model,
4. tier vocabulary and grouping semantics.

It intentionally does **not** finalize the long-term model catalog contents or expand the curated set. But it does freeze the maintenance model and enough catalog structure that later curation and refresh work does not force another schema redesign.

The current checked-in catalog should be treated as scaffolding, not canon. The form overhaul is free to support a future first-principles rewrite of the curated set rather than preserving the placeholder catalog by inertia.

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
9. freezing the catalog maintenance strategy so schema decisions do not paint us into a corner.

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
5. Freeze the future catalog maintenance model before freezing schema fields that may need to be programmatically refreshed.
6. Do not treat current inclusion, ordering, or tier assignments as migration truth; the eventual curated set may be rewritten from first principles.

## Progress

- [x] `M0` Current-state audit completed.
- [x] `M1` Form contract and spec freeze.
- [x] `M2` Schema/catalog and loader implementation.
- [x] `M3` Models-step UI implementation.
- [x] `M4` Validation, capture review, and closeout.

## Surprises & Discoveries

1. The `Models` step already uses a proper dedicated catalog and schema (`resources/models/catalog.json`, `schemas/catalog.schema.json`). The primary weakness is presentation depth, not inventory plumbing.
2. `metadata_complete` in the model catalog is still `false`, which is an explicit signal that the catalog is not yet presentation-complete.
3. The current TUI row format is already good enough to keep as the primary compact row grammar. The missing layer is a focused guidance surface, not a more ornate row.
4. Current `notes` strings in the catalog are informative but not normalized for user-facing guidance. They are useful source material, not yet a finished UI contract.
5. OpenRouter's live inventory is very large and fast-moving. A fully manual catalog will drift too easily, but a fully automatic catalog would undermine curation and reproducibility. The right long-term shape is a hybrid curated catalog backed by programmatic refresh of factual fields.
6. The current `default / extended / free` tier values are placeholder-era scaffolding and should not be treated as the long-term visible or internal taxonomy.

## Decision Log

1. Follow the same high-level interaction pattern that now works well for `Personas`:
   - compact rows,
   - fixed-height focused guidance block,
   - data-driven defaults and ordering.
2. Do **not** mirror the `Personas` schema exactly. Models need catalog fields that reflect model-selection tradeoffs, not persona rationale.
3. Keep the row grammar as compact inline metadata rather than long prose rows.
4. Freeze a hybrid maintenance model: the checked-in catalog remains authoritative, while future refresh tooling may update factual OpenRouter-backed fields for human review rather than mutating the catalog automatically at runtime.
5. Use a model-specific guidance contract rather than the persona-shaped `subtitle / when_to_use / risk_note` pattern.
6. Freeze visible tier vocabulary as a cost-capability stratum, not a quality ladder.

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
- **hybrid maintenance model**: a checked-in curated catalog augmented by a future refresh workflow that can pull factual availability data from OpenRouter without making silent runtime changes

## Plan of Work

The work proceeds in dependency order:

1. freeze the product-facing `Models` step contract,
2. define the catalog field set needed to render that contract,
3. freeze the catalog maintenance strategy and visible tier language,
4. implement the loader and UI model,
5. implement the focused guidance block and row format,
6. validate through unit tests, PTY, capture, and manual review.

## Milestones and Gates

### `M1` Form contract and spec freeze

Outcome:

- the `Models` step has a frozen product contract for:
  - row format,
  - focused guidance layout,
  - tier vocabulary,
  - ordering and default-selection rules,
  - catalog maintenance strategy,
  - fixed-height rules,
  - truncation/wrapping rules,
  - what comes from catalog data.

Exit evidence:

1. this plan records the exact first-pass field set,
2. `docs/product-specs/tui-copy-deck.md` and `docs/product-specs/tui-visual-screen-deck.md` are updated for Step 3,
3. `docs/product-specs/tui-wizard.md` reflects the new Step 3 interaction contract,
4. first-pass tier vocabulary is frozen,
5. ordering principle and default-selection semantics are frozen,
6. provider-label rendering strategy is frozen,
7. future catalog maintenance strategy is frozen.

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
5. any catalog-data mismatch or missing required presentation field fails validation,
6. the schema remains compatible with a future hybrid refresh workflow.

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

Provider-label rule:

- `provider_label` is derived in the loader from the raw `provider` field
- do not add a separate catalog field solely for provider display casing
- keep the normalization map small and explicit

2. Freeze the focused guidance block.

Recommended first-pass guidance block contract:

- line 1: `summary_line`
- line 2: `research_note`
- line 3: `risk_note` or blank
- one blank separator line between the guidance block and the list
- fixed height while the cursor moves

Interpretation:

- `summary_line` is a compact factual characterization of the model, not a persona-style subtitle
- `research_note` is the one-line researcher-facing selection cue
- `risk_note` is reserved for alias, free-tier, or other selection-relevant cautions when needed

Authoring contract:

- `summary_line` is human-authored and should stay under roughly 60 characters at supported widths
- preferred grammar: `{capability_note} · {context_fragment} · {slug_type}` when those fragments are known and worth surfacing
- `context_fragment` is omitted when `context_window` is unknown
- `slug_type` should be `pinned slug` or `alias slug` when that distinction matters
- `research_note` describes why a researcher would include the model in a study, not raw technical specifications already visible elsewhere
- `risk_note` is optional, but `is_aliased: true` should imply `risk_note` is present

3. Freeze the first-pass catalog field set.

Recommended first-pass fields for each model entry:

- `slug`
- `display_name`
- `provider`
- `tier`
- `is_aliased`
- `context_window`
- `summary_line`
- `research_note`
- `risk_note` (optional)
- `default`
- `sort_order`
- `notes` (optional, non-UI source material)

4. Freeze first-pass tier vocabulary.

Recommended first-pass visible tier values:

- `free`
- `budget`
- `mid`
- `flagship`

Migration note:

- current schema/catalog use `default`, `extended`, `free`
- these values are placeholder-era scaffolding and should be reassigned from first principles rather than mechanically mapped
- `extended` does not map 1:1 to the new vocabulary; per-model reassignment is required
- if visible tier language changes, it must be reflected in schema/catalog and all product specs together
- visible tier language should describe a cost-capability stratum, not imply low-quality vs high-quality judgment

5. Freeze ordering and default-selection rules.

Recommended first-pass ordering:

- `sort_order` is the canonical ordering key at runtime
- tier-first (`flagship`, then `mid`, then `budget`, then `free`) and alphabetical within tier is the authoring convention used to assign `sort_order` values
- the loader should sort by `sort_order` alone rather than re-deriving tier ordering at runtime

Recommended default-selection rule:

- explicit `default: true` in the catalog
- multiple models may be `default: true` for this multi-select step
- do not rely on position-zero as an implicit default forever

6. Freeze the catalog maintenance strategy.

Recommended long-term maintenance model:

- the checked-in model catalog remains the authoritative research-facing set
- a future refresh workflow may pull factual availability and metadata from OpenRouter
- the refresh workflow should surface candidate changes for human review rather than mutating the catalog silently
- runtime rendering must not depend on live OpenRouter fetches

Field ownership principle:

- human-curated fields: `slug` inclusion, `display_name`, `tier`, `is_aliased`, `summary_line`, `research_note`, `risk_note`, `default`, `sort_order`, `notes`
- machine-refreshable fields: `provider`, `context_window`, and factual existence/availability checks against OpenRouter
- a future refresh workflow may propose updates to human-authored fields but must not silently overwrite them

7. Freeze text-flow rules for Step 3.

Required rules:

- never wrap model names, provider names, or tier labels mid-token,
- prefer truncation over mid-token wrapping in constrained widths,
- guidance text wraps by word only,
- raw slugs appear only in a future details surface if explicitly added,
- notes do not appear inline in rows,
- `context_window` may be omitted from the guidance line when unknown (`null`)

8. Freeze the intended scale assumption for the first pass.

- the first-pass form contract should remain comfortable up to roughly 20 catalog entries
- this assumption constrains row width, guidance density, and the need for explicit grouping

9. Update the canonical Step 3 specs before code implementation.

### `M2` Implement schema and loader changes

1. Extend `schemas/catalog.schema.json` with the frozen first-pass presentation fields.
2. Regenerate catalog types.
3. Update `resources/models/catalog.json` for the current curated set.
4. Extend `CatalogModel` in `src/ui/wizard/types.ts`.
5. Update `loadCatalogModels()` in `src/ui/wizard/resources.ts` to:
   - normalize and expose the chosen display fields,
   - expose focused-guidance fields directly,
   - preserve enough source data that a future refresh workflow can safely reconcile factual model metadata.
6. Preserve strict schema validation and fail early if required presentation fields are missing.
7. Keep the schema compatible with a future hybrid refresh script rather than assuming the catalog will remain forever hand-maintained.
8. Treat the eventual catalog rewrite as a curated first-principles rewrite if that is cleaner than migrating placeholder-era entries in place.

### `M3` Implement the Step 3 surface

1. Update Step 3 in `src/ui/wizard/steps.ts` to consume the richer `CatalogModel` shape.
2. Reuse the shared `selectMany` focused-guidance mechanism already added for `Personas`.
3. Keep the list rows compact.
4. Route model-selection cautions through the focused guidance block where possible.
5. Preserve a selected-state warning for global conditions such as free-tier selection if it still adds value beyond per-row guidance.
6. Keep alias visible in the compact row if it remains a first-class reproducibility concern.
7. Ensure the frozen rail summary remains concise and product-facing.

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
5. Tier language is explicit, consistent, and does not imply a simplistic quality ladder.
6. The step helps a researcher understand when and why to select a model, not just what the model is called.
7. The frozen rail summary remains concise.
8. Product-spec docs match the shipped behavior.
9. The catalog shape remains compatible with a future curated+refreshable OpenRouter maintenance model.

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
4. Rewriting the placeholder curated set is allowed, but every included slug must be grounded in OpenRouter availability and justified by the final curation policy.

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
- future OpenRouter-derived availability data, but not as a runtime dependency

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
