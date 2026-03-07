# ExecPlan: TUI Product-Surface Polish

Status: completed
Owner: Codex
Last updated: 2026-03-06

## 1. Purpose / Big Picture

The TUI runtime foundation is now stable and externally signed off as `A+`. The open gap is no longer architecture; it is product-surface quality.

Arbiter currently renders as a coherent, trustworthy research instrument, but the product surface still grades around `B+` rather than `A`/`A-`. The main weaknesses are:

1. Stage 1 to Stage 2 handoff feels abrupt rather than intentional.
2. Selection surfaces still leak data-derived presentation (`[paid]`, raw provider styling, redundant persona prose).
3. Stage 2 regresses to raw model slugs instead of product labels.
4. Review and receipt surfaces are structurally correct but visually flat.
5. Mock-mode dashboard/receipt states read like fallbacks instead of designed states.

This plan tightens the display layer only. It does not reopen runtime architecture.

## 2. Scope Guardrails

In scope:

1. Stage 1 selection-row presentation and helper text fidelity.
2. Stage 1 to Stage 2 transition treatment.
3. Stage 2 worker-table display labels and mock-mode copy polish.
4. Step 7 review formatting consistency.
5. Stage 3 artifact list formatting, duration presentation, and reproduce-path presentation.
6. Governing spec updates required to make the new display contract explicit.

Out of scope:

1. TUI runtime ownership, frame lifecycle, or redraw architecture.
2. Engine or telemetry contract changes.
3. New dashboard layouts or multi-pane compositions.
4. Screenshot automation or new validation infrastructure.
5. Palette or glyph-vocabulary redesign.

Sequencing constraints:

1. Update governing product-spec docs before changing implementation.
2. Keep runtime seams unchanged unless an implementation detail is required to satisfy the display contract.
3. Preserve all current TUI validation and guard workflows.

## 3. Progress

- [x] M0: spec reconciliation for product polish
- [x] M1: display-quality cleanup
- [x] M2: transition and consistency polish
- [x] M3: validation, capture review, and closeout

## 4. Surprises & Discoveries

1. The runtime architecture is no longer the limiting factor. Product polish is now primarily constrained by presentation decisions encoded in `steps.ts`, `draft.ts`, `dashboard-vm.ts`, and `receipt-render.ts`.
2. The existing product-spec docs remain mostly correct, but some display details are stale relative to the current product ambition, especially model metadata formatting, Stage 1→2 transition guidance, and mock-mode usage copy.
3. The highest-value product improvements came from removing developer-facing presentation details rather than introducing new visual primitives. Display-name mapping, inline metadata, and a deliberate transition beat materially improved the product surface without touching runtime architecture.

## 5. Decision Log

1. Decision: keep the current shell, rail, ruled-section, and color systems intact.
   Rationale: the audit found coherence and trustworthiness are strengths; the gap is refinement, not visual reinvention.

2. Decision: use display-name mapping everywhere user-facing model identity appears.
   Rationale: Stage 1 already proved display names feel more premium than raw slugs; Stage 2 should match.

3. Decision: favor single-column clarity over dense artifact grids in Stage 3.
   Rationale: the receipt should read like a document of record, not a wrapped filename dump.

4. Decision: keep the current rendered-text + ANSI viewer validation model.
   Rationale: the runtime is stable enough that this round should spend effort on product surface, not new tooling.

## 6. Context and Orientation

Reviewed first:

1. `AGENTS.md` for local workflow, TUI validation, and spec precedence.
2. `docs/PLANS.md` for ExecPlan contract requirements.
3. `docs/product-specs/tui-copy-deck.md` for locked copy and current metadata/usage wording.
4. `docs/product-specs/tui-visual-screen-deck.md` for current wireframes and display targets.
5. `docs/product-specs/tui-wizard.md` for behavior boundaries.
6. Fresh capture pack `output/playwright/tui-visual/2026-03-07T01-20-10-313Z` for current rendered evidence.

Current implementation surfaces most relevant to this round:

1. `src/ui/wizard/steps.ts` for model/persona selection presentation.
2. `src/ui/wizard/resources.ts` for provider and persona display metadata.
3. `src/ui/wizard/draft.ts` for review-surface content and summaries.
4. `src/ui/runtime/dashboard-vm.ts` for worker-table model identity and mock-mode dashboard text.
5. `src/ui/runtime/dashboard-render.ts` for dashboard section composition.
6. `src/ui/runtime/receipt-render.ts` for artifact formatting, duration display, and reproduce command.

High-risk surfaces:

1. Step 1 copy fidelity: the helper line is `LOCKED` and must be restored exactly.
2. Stage 2 labels: must not regress semantic honesty while improving presentation.
3. Reproduce command path: should become relative when safe without breaking operator trust.

Validation commands for this round:

1. `npm run test:ui`
2. `npm run test:e2e:tui`
3. `npm run test:unit`
4. `npm run test:guards`
5. `npm run capture:tui`

## 7. Plan of Work

This plan is ordered by dependency and user-visible leverage.

1. Reconcile specs so the target display contract is explicit.
2. Fix the highest-signal display-quality issues first:
   - question helper fidelity,
   - model/persona row presentation,
   - dashboard model labels,
   - receipt artifact readability.
3. Then smooth the cross-stage experience:
   - Stage 1→2 transition,
   - review/receipt formatting consistency,
   - footer and mock-mode state wording.

## 8. Milestones and Gates

### M0: Spec reconciliation for product polish

Outcome:

1. Product specs explicitly describe the intended display treatment for:
   - model metadata,
   - persona rows,
   - Stage 1→2 transition,
   - mock-mode usage copy,
   - artifact list formatting,
   - reproduce-path presentation.

Entry:

1. Current audit findings and fresh capture pack exist.

Exit evidence:

1. `tui-copy-deck.md` and `tui-visual-screen-deck.md` are updated and internally consistent.
2. No spec change requires runtime architecture changes.

Rollback boundary:

1. Docs-only.

### M1: Display-quality cleanup

Outcome:

1. The core product-surface issues identified in the audit are resolved without changing runtime architecture.

Entry:

1. M0 spec updates are committed.

Exit evidence:

1. No bracket-wrapped model badges remain in user-facing selection surfaces.
2. No raw OpenRouter model slugs remain visible in Stage 2 worker rows.
3. Step 1 includes the locked helper text verbatim.
4. Stage 3 artifacts render as a readable vertical list.
5. Mock-mode usage and instant-duration states read as intentional product states, not fallbacks.

Rollback boundary:

1. Implementation remains confined to presentation modules and product-spec docs.

### M2: Transition and consistency polish

Outcome:

1. The app reads as one continuous product surface across Stage 1, Stage 2, and Stage 3.

Entry:

1. M1 has landed with green validation.

Exit evidence:

1. Stage 1→2 transition has a documented and implemented visual bridge.
2. Review, dashboard, and receipt use consistent KV-style formatting where the same conceptual content recurs.
3. Footer grammar is consistent and intentional across stages.

Rollback boundary:

1. Changes remain at the presentation/copy layer.

### M3: Validation, capture review, and closeout

Outcome:

1. The polished product surface is validated and graded again against the capture artifacts.

Entry:

1. M1 and M2 complete.

Exit evidence:

1. All validation commands pass.
2. A fresh capture pack is reviewed against the polish goals.
3. Product-surface grade is re-assessed honestly.

Rollback boundary:

1. Validation-only.

## 9. Concrete Steps

### M0

1. Update `docs/product-specs/tui-copy-deck.md`:
   - replace bracketed metadata guidance with inline metadata guidance,
   - restore the intended Step 1 helper contract,
   - change mock-mode usage wording to an intentional designed state,
   - document relative reproduce-path behavior.
2. Update `docs/product-specs/tui-visual-screen-deck.md`:
   - refresh Step 3 and Step 4 wireframes,
   - add Stage 1→2 transition guidance,
   - replace artifact-grid guidance with vertical-list guidance,
   - align Stage 2 worker examples with display names.

### M1

1. Update `src/ui/wizard/resources.ts` to expose polished display metadata instead of badge scaffolding.
2. Update `src/ui/wizard/steps.ts` to render model/persona rows using the new presentation metadata.
3. Update `src/ui/wizard/draft.ts` to align Step 7 summary formatting with the broader product KV style where appropriate.
4. Update `src/ui/runtime/dashboard-vm.ts` so Stage 2 worker rows use display labels instead of raw slugs.
5. Update `src/ui/runtime/dashboard-render.ts` and/or `src/ui/runtime/receipt-render.ts` for:
   - mock-mode usage wording,
   - instant-duration wording,
   - vertical artifact formatting,
   - relative reproduce paths when safe.

### M2

1. Introduce the Stage 1→2 transition beat in the appropriate Stage 2 entry path.
2. Standardize footer grammar and any cross-stage formatting inconsistencies exposed by the fresh captures.
3. Reconcile any remaining visual mismatch between Stage 1 review and Stage 3 summary treatment.

### M3

1. Run the validation stack serially.
2. Generate a fresh capture pack.
3. Review the updated `.txt` artifacts and paired `.ansi` files.
4. Record the new product-surface grade and any residual polish debt.

Completion notes:

1. Validation passed:
   - `npm run test:ui`
   - `npm run test:e2e:tui`
   - `npm run test:unit`
   - `npm run test:guards`
   - `npm run capture:tui`
2. Fresh capture pack reviewed:
   - `output/playwright/tui-visual/2026-03-07T01-55-03-472Z`
3. Result:
   - Stage 1 selection surfaces now use product display labels with inline metadata.
   - Stage 1 question screen now includes the locked helper text.
   - Stage 1→2 handoff now includes a visible transition beat.
   - Stage 2 worker rows now use display labels instead of raw slugs.
   - Stage 2 mock-mode usage now reads as an intentional state.
   - Stage 3 artifact list now renders vertically and reproduce paths prefer relative paths.
4. Updated product-surface grade:
   - `A-`
5. Residual polish debt:
   - Stage 3 summary remains functionally strong but visually plainer than Stage 1.
   - Persona descriptions are improved but still intentionally terse rather than highly expressive.

## 10. Validation and Acceptance

Acceptance criteria:

1. Stage 1 selection rows read like designed product UI, not resource manifests.
2. Stage 2 worker model labels match Stage 1 display quality.
3. Stage 1→2 handoff reads as one product, not two separate visual systems.
4. Stage 3 receipt reads as a document of record rather than a wrapped filename dump.
5. Mock-mode states feel intentional rather than absent-feature placeholders.

Validation:

1. `npm run test:ui`
2. `npm run test:e2e:tui`
3. `npm run test:unit`
4. `npm run test:guards`
5. `npm run capture:tui`

Expected evidence:

1. Stage 1 `.txt` captures show inline metadata without bracket-wrapped badges.
2. Stage 2 `.txt` captures show worker model display names rather than raw slugs.
3. Stage 3 `.txt` captures show a vertical artifact list and relative reproduce command when possible.
4. All existing tests remain green, with no runtime-architecture regressions.

## 11. Idempotence and Recovery

1. This round is presentation-only. If a change feels visually wrong after fresh capture review, revert the presentation delta without touching runtime seams.
2. Keep spec and implementation updates in the same milestone so the display contract remains truthful.
3. If any polish change implies a runtime-contract change, stop and write a separate plan instead of expanding this one.

## 12. Interfaces and Dependencies

Primary dependencies:

1. `resources/catalog/models.json`
2. `resources/prompts/manifest.json`
3. `docs/product-specs/tui-copy-deck.md`
4. `docs/product-specs/tui-visual-screen-deck.md`
5. `docs/TUI-RUNTIME.md`

No schema changes are expected in this plan.

## 13. Handoffs and Ownership

This plan is safe for handoff if the next contributor can answer:

1. which display surfaces are in scope,
2. which product-spec deltas were committed first,
3. what capture pack was used as the baseline,
4. which validation commands must be rerun after each milestone.

## 14. Artifacts and Notes

Baseline audit evidence:

1. `output/playwright/tui-visual/2026-03-07T01-20-10-313Z`

## 15. Plan Change Notes

1. Initial draft created after runtime architecture closeout and product-surface audit established the current `B+` grade.
