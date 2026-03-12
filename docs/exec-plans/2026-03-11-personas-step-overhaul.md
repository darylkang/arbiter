# ExecPlan: Personas Step Overhaul

Status: proposed
Owner: Codex
Last updated: 2026-03-11

## Purpose / Big Picture

The Stage 1 Personas step is currently dynamic for inventory but under-modeled for presentation. Arbiter can add or remove personas by editing `resources/prompts/manifest.json`, but the UI still derives labels from IDs and renders a thin `Display — description` row format that does not scale well or feel premium.

This plan upgrades the Personas step into a first-class product surface and data model without touching persona substance yet. The work is explicitly about form:

1. a dedicated persona catalog separate from the prompt manifest,
2. a richer `PersonaOption` presentation model,
3. a more premium and guidance-oriented Personas selection surface,
4. validation that keeps the step dynamic while eliminating hardcoded presentation hacks.

The goal is not to decide which new personas Arbiter should include. The goal is to make the step structurally ready for a larger, research-grade persona catalog.

## Scope Guardrails

In scope:

1. persona catalog schema and catalog file,
2. loader and type updates needed to consume persona presentation metadata,
3. Stage 1 Personas step presentation redesign,
4. focused-row guidance treatment for the Personas step,
5. copy/spec updates needed to lock the new row and helper layout,
6. TUI tests/capture updates for the changed Personas step output.

Out of scope:

1. deciding the final substantive persona set for the paper,
2. changing model, protocol, decode, or other wizard steps beyond shared helper plumbing,
3. runtime architecture or frame-ownership changes,
4. prompt-manifest integrity semantics beyond adding cross-reference checks if needed,
5. introducing grouped headers, two-column layouts, or advanced row expansion in the first pass.

Sequencing constraints:

1. freeze the form contract before implementation,
2. keep prompt manifest as the integrity source of truth,
3. add persona catalog as a separate presentation/research metadata source,
4. preserve backward-compatible behavior for the existing four personas while introducing the richer model.

## Progress

- [ ] M0 — form contract and catalog shape frozen
- [ ] M1 — persona catalog schema and loader implemented
- [ ] M2 — Personas step visual/presentation overhaul implemented
- [ ] M3 — validation, capture review, and closeout completed

## Surprises & Discoveries

1. The current step is already dynamic at the inventory layer: `loadPersonaOptions()` reads the prompt manifest and filters `participant_persona` entries.
2. The current presentation is partly propped up by UI-side hacks:
   - display names are derived from IDs,
   - `Neutral (empty) persona.` is special-cased into `default baseline stance`.
3. The prompt manifest is serving an integrity role today (existence, type, path/hash), not a rich presentation-catalog role. Overloading it would blur that boundary.
4. The premium UI problem is not only row text. The step also lacks a strong focused guidance area explaining what each persona is for and when to use it.
5. The focused guidance block cannot be treated as free-form text. If its height changes while the cursor moves, the list will jump vertically and the step will feel unstable.

## Decision Log

1. Decision: keep persona inventory integrity in the prompt manifest and add a separate persona catalog for presentation/research metadata.
   Rationale: this matches the existing models pattern and avoids overloading the manifest with UI semantics.

2. Decision: the first-pass Personas row should remain compact.
   Rationale: the list must stay scannable as the catalog grows; richer guidance belongs in the focused detail area, not inline on every row.

3. Decision: the focused persona should surface explicit researcher-facing guidance.
   Rationale: the current step explains what a prompt instruction says, but not when a researcher should choose that stance.

4. Decision: grouped persona sections are deferred.
   Rationale: category tags are enough for the current and near-term scale; grouped headers can be introduced later if the catalog grows materially.

5. Decision: the first pass will not render a visible `recommended` tag.
   Rationale: pre-selection already communicates the default, and a visible recommendation label is too opinionated for a research instrument.

6. Decision: manifest `description` stops being a Personas-step UI field once the catalog lands.
   Rationale: manifest descriptions remain content/integrity metadata; researcher-facing UI guidance moves to the catalog.

## Context and Orientation

Docs reviewed first:

1. `AGENTS.md` — process, precedence, and TUI workflow requirements.
2. `docs/PLANS.md` — ExecPlan contract.
3. `docs/DESIGN.md` — research framing around prompt/persona heterogeneity.
4. `docs/RESEARCH-METHOD.md` — paper-method boundary for heterogeneity dimensions.
5. `README.md` — operator workflow and CLI expectations.
6. `docs/product-specs/tui-wizard.md` — Stage 1 behavior contract.
7. `docs/product-specs/tui-copy-deck.md` — current Step 4 copy contract.
8. `docs/product-specs/tui-visual-screen-deck.md` — current visual contract and hierarchy rules.
9. `output/tmp/models-personas-ui-review.txt` — pasted current terminal output for Models and Personas.

Relevant implementation files:

1. `src/ui/wizard/resources.ts`
2. `src/ui/wizard/steps.ts`
3. `src/ui/wizard/types.ts`
4. `src/ui/wizard/controls.ts`
5. `src/ui/wizard/frame-manager.ts`
6. `resources/prompts/manifest.json`

Current state summary:

1. Persona inventory is sourced from `resources/prompts/manifest.json` entries with `type === "participant_persona"`.
2. Current `PersonaOption` shape is `{ id, display, description }`.
3. Current row format is effectively `{display} — {description}`.
4. Current descriptions are prompt-facing instructions, not consistently researcher-facing summaries.
5. The step lacks a rich focused guidance block for “what this persona does” and “when to use it.”

High-risk surfaces:

1. schema/loader divergence between persona catalog and prompt manifest,
2. copy/spec drift between new row format and current TUI tests/captures,
3. over-designing the step into a heavy card/grid pattern that breaks Stage 1 consistency.

## Plan of Work

Ordering principle: dependency order.

1. Freeze the persona data contract first.
2. Then wire the loader/types to that contract.
3. Then redesign the Personas step presentation around the richer data.
4. Validate against both structural tests and rendered captures.

## Milestones and Gates

### M0 — Form Contract Freeze

Entry criteria:

1. Current dynamic data path understood.
2. Current rendered Personas step reviewed.

Exit criteria:

1. Persona catalog shape is frozen.
2. Personas-step row format is frozen.
3. Focused guidance area content contract is frozen.
4. Data-driven vs UI-driven responsibilities are frozen.
5. Concrete M0 artifacts exist in the plan and/or the governing product-spec docs:
   - catalog field list,
   - first-pass category vocabulary,
   - row mockup,
   - fixed-height guidance mockup,
   - shared-control extension note,
   - draft copy/spec updates for Step 4.

### M1 — Persona Catalog Schema and Loader

Entry criteria:

1. M0 complete.

Exit criteria:

1. dedicated persona catalog schema exists,
2. dedicated catalog data file exists for the current personas,
3. `PersonaOption` is updated to the richer shape,
4. `loadPersonaOptions()` reads the catalog rather than deriving presentation from manifest IDs,
5. there is a validation path ensuring catalog IDs map to actual manifest entries,
6. Step 4 copy/spec docs are updated before UI implementation depends on the new contract.

### M2 — Personas Step Presentation Overhaul

Entry criteria:

1. M1 complete.

Exit criteria:

1. persona rows use the new compact premium format,
2. focused-row guidance replaces the thin generic helper treatment,
3. defaults/recommended personas are indicated from data rather than positional assumptions,
4. the step remains usable at minimum supported terminal size,
5. existing Stage 1 chrome and rail behavior remain intact,
6. the shared `selectMany` control supports cursor-sensitive guidance without introducing list jumpiness.

### M3 — Validation and Closeout

Entry criteria:

1. M1 and M2 complete.

Exit criteria:

1. `npm run test:ui` passes,
2. `npm run test:e2e:tui` passes,
3. `npm run test:unit` passes,
4. `npm run test:guards` passes,
5. `npm run capture:tui` produces updated artifacts,
6. the Personas step capture shows the new compact rows plus focused guidance,
7. residual open questions are limited to future persona substance, not step form.

## Concrete Steps

### M0 — Freeze the Form Contract

1. Introduce a dedicated persona catalog concept.
2. Freeze the first-pass catalog fields.
3. Freeze the row layout and focused-guidance layout.
4. Freeze what belongs in data versus UI code.

Proposed first-pass persona catalog fields:

1. `id`
2. `display_name`
3. `subtitle`
4. `category`
5. `when_to_use`
6. `risk_note` (optional)
7. `default`
8. `sort_order`

Frozen first-pass category vocabulary:

1. `baseline`
2. `adversarial`
3. `analytical`
4. `divergent`

Proposed first-pass row layout:

1. primary row: `{display_name} · {category}`
2. no visible `recommended` tag in the first pass
3. default personas are communicated by pre-selection, not by an explicit recommendation label
4. no long inline prose in the row itself

Proposed first-pass focused guidance layout:

1. line 1: `subtitle`
2. line 2: `when_to_use`
3. optional line 3: `risk_note`
4. the guidance block is always exactly 3 content lines tall; when `risk_note` is absent, line 3 is blank
5. `when_to_use` must be authored to fit on one rendered line at supported widths; do not rely on variable-height wrapping

### M1 — Catalog and Loader

1. Add `schemas/persona-catalog.schema.json`.
2. Add `resources/prompts/personas/catalog.json` for the current four personas.
3. Regenerate schema-derived types.
4. Update `src/ui/wizard/types.ts` so `PersonaOption` carries the richer fields.
5. Update `src/ui/wizard/resources.ts` to:
   - read the persona catalog,
   - validate that every catalog persona maps to a manifest entry,
   - sort by `sort_order`,
   - stop deriving display labels from IDs,
   - treat catalog/manifest mismatches as hard errors.
6. Update the governing Step 4 copy/visual specs before UI implementation begins:
   - `docs/product-specs/tui-copy-deck.md`
   - `docs/product-specs/tui-visual-screen-deck.md`

### M2 — Personas Step UI

1. Extend the shared `selectMany` control with an explicit cursor-sensitive guidance hook (for example `focusedLines(index)`), treated as shared helper plumbing.
2. Update `src/ui/wizard/steps.ts` so the Personas row format uses compact inline metadata rather than `display — description`.
3. Surface fixed-height focused persona guidance in the step helper area.
4. Mark default personas from data via pre-selection, not via an explicit recommendation tag.
5. Keep the list single-column and compact in the first pass.
6. Update frozen summary/review labels if needed so they use `display_name` cleanly.

### M3 — Validation and Closeout

1. Update or add tests for persona catalog loading and ID consistency.
2. Update rendered TUI assertions/captures to match the new layout.
3. Reassess whether the Personas step now feels premium, guidance-rich, and scalable.
4. Confirm manifest `description` is no longer used for Personas-step UI rendering.

## Validation and Acceptance

Required scope gate for the implementation round:

1. `npm run check:types`
2. `npm run check:schemas`
3. `npm run test:ui`
4. `npm run test:e2e:tui`
5. `npm run test:unit`
6. `npm run test:guards`
7. `npm run capture:tui`

Acceptance criteria:

1. Persona inventory remains dynamic.
2. Persona presentation is no longer derived from IDs or patched with special-case label hacks.
3. Persona rows are compact and scan-friendly.
4. Focused guidance clearly explains what the persona is for and when to use it.
5. Recommended/default personas are data-driven.
6. Current four personas continue to function correctly under the new schema.
7. The step is structurally ready for a materially larger persona catalog.
8. The guidance block remains visually stable while moving between options.

## Idempotence and Recovery

1. This plan adds a new catalog alongside the existing manifest rather than mutating the manifest into a polymorphic structure.
2. If the catalog integration reveals unexpected schema friction, rollback can be isolated to the new catalog/schema/loader changes.
3. The current four personas should remain representable in the new shape without changing their underlying prompt files.
4. If the shared `selectMany` extension proves awkward, fallback is to keep the compact row format and temporarily use static helper text, but do not backslide into long inline persona descriptions.

## Interfaces and Dependencies

Primary dependencies:

1. `resources/prompts/manifest.json` — source of prompt inventory/integrity.
2. `schemas/` — source of typed contract truth.
3. `docs/product-specs/tui-copy-deck.md` — human-facing Step 4 copy.
4. `docs/product-specs/tui-visual-screen-deck.md` — visual contract for the step.
5. `src/ui/wizard/controls.ts` — current selection surface mechanics.
6. `src/ui/wizard/frame-manager.ts` — current Stage 1 layout and available helper area budget.

Potential extension point:

- if future scale requires grouped headers or richer row expansion, that should be a separate follow-on plan rather than bundled into the first pass.

## Handoffs and Ownership

If this work is handed off:

1. the next contributor should treat this plan as a form-contract freeze for the Personas step,
2. substance decisions about which personas to add remain a separate track,
3. do not implement grouped headers, split layouts, or large control rewrites unless a new plan explicitly expands scope.

## Artifacts and Notes

Supporting analysis artifacts:

1. `output/tmp/models-personas-ui-review.txt`
2. Opus review of persona-catalog direction and focused-guidance treatment
3. separate Breezy/ChatGPT Pro prompt requested for persona-substance ideation

## Plan Change Notes
