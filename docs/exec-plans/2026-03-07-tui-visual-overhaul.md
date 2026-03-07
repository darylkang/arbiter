# ExecPlan: TUI Visual Overhaul

Status: proposed
Owner: Codex
Last updated: 2026-03-07

## Purpose / Big Picture

Arbiter's runtime and transcript foundation are now stable enough to support a real visual overhaul. The current product surface is coherent but still reads too much like a formatted log: shell-like stage chrome, a weak spaced-out wordmark, too many full-width rules, and insufficient hierarchy between setup, monitoring, and receipt.

This plan replaces that visual grammar with the accepted redesign direction:

1. a contained identity panel,
2. lifecycle stage headers (`▍ SETUP`, `▍ RUN`, `▍ RECEIPT`),
3. geometric rail glyphs (`◆`, `▸`, `◇`),
4. short-prefix subsection headers (`── PROGRESS`),
5. reduced rule density,
6. stronger stage-to-stage hierarchy.

The goal is not a runtime rewrite. The goal is to make the product surface feel premium, intentional, and terminal-native while preserving the A+ runtime foundation already in place.

## Scope Guardrails

In scope:

1. Stage 0 identity panel redesign.
2. Stage 1 chrome and rail visual redesign.
3. Stage 2 dashboard visual redesign.
4. Stage 3 receipt visual redesign.
5. Supporting copy updates needed to match the new chrome and glyph system.
6. Capture/test updates required for changed sentinels, glyphs, and stage headers.

Out of scope:

1. runtime architecture changes in `docs/TUI-RUNTIME.md`,
2. new engine events or telemetry semantics,
3. changes to research methodology, stopping semantics, or artifact contracts,
4. new major product features,
5. introducing a new TUI framework or rendering backend.

Sequencing constraints:

1. product-spec docs must be treated as the source of truth before implementation.
2. runtime architecture is fixed unless implementation reveals an actual defect.
3. capture/test updates must land in the same implementation round as the visual changes.

## Progress

- [x] M0 — design direction converged and product-spec docs updated
- [ ] M1 — Stage 0 and Stage 1 visual overhaul implemented
- [ ] M2 — Stage 2 and Stage 3 visual overhaul implemented
- [ ] M3 — validation, capture review, and product-surface re-grade completed

## Surprises & Discoveries

1. The redesign consensus moved away from shell-like status strips entirely; the replacement is lifecycle stage headers, not a refined prompt-style strip.
2. The prior `✔/◆/◇` rail contract is superseded by `◆/▸/◇` to avoid checkbox collisions while keeping a geometric vocabulary.
3. The identity panel should persist as top chrome during Stage 1 and appear once in the durable transcript, not be repeated as a heavy panel throughout the full run transcript.

## Decision Log

1. Decision: keep the current runtime architecture and overwrite model intact.
   Rationale: the open problem is product surface quality, not runtime structure.

2. Decision: adopt the Notion consensus redesign as the new visual baseline.
   Rationale: it is the first proposal that resolves the shell-like chrome problem, the weak wordmark, and the over-ruled dashboard/receipt hierarchy at the same time.

3. Decision: the visual contract lives in `docs/product-specs/tui-visual-screen-deck.md` and `docs/product-specs/tui-copy-deck.md`, not `docs/TUI-RUNTIME.md`.
   Rationale: this is a product-surface redesign, not a runtime-architecture change.

## Context and Orientation

Docs reviewed first:

1. `AGENTS.md` — process, precedence, and multi-agent safety.
2. `docs/PLANS.md` — ExecPlan contract.
3. `docs/DESIGN.md` — durable semantics and stage model.
4. `README.md` — operator-facing TUI workflow.
5. `docs/product-specs/tui-wizard.md` — behavior and interaction semantics that must remain unchanged.
6. `docs/product-specs/tui-copy-deck.md` — updated copy contract for the redesign.
7. `docs/product-specs/tui-visual-screen-deck.md` — updated visual contract for the redesign.
8. Notion page `Terminal Output` — current transcript plus Opus design proposal and consensus revision.

Relevant implementation files for the next round:

1. `src/ui/copy.ts`
2. `src/ui/fmt.ts`
3. `src/ui/wizard-theme.ts`
4. `src/ui/wizard/frame-manager.ts`
5. `src/ui/wizard/draft.ts`
6. `src/ui/runtime/dashboard-render.ts`
7. `src/ui/runtime/receipt-render.ts`
8. `scripts/tui-visual-capture.mjs`
9. `test/e2e/tui-pty.test.mjs`
10. `test/e2e/tui-visual-capture.test.mjs`

High-risk surfaces:

1. Stage 1 → Stage 2 handoff seam.
2. Rail glyph changes affecting both live setup and frozen summary transcript.
3. Capture/test assertions keyed to old strings like `A R B I T E R`, `✔  Entry Path`, and `› arbiter ...`.

## Plan of Work

Implement the redesign in two product-surface milestones and finish with one strict validation milestone.

Ordering principle: dependency order.

1. Stage 0 / Stage 1 first, because they define the new top-level chrome language.
2. Stage 2 / Stage 3 second, because they must visually harmonize with the new chrome.
3. Validation last, because it must inspect the fully integrated redesign rather than intermediate surfaces.

## Milestones and Gates

### M0 — Spec Freeze

Entry criteria:

1. Consensus redesign direction accepted.
2. Product-spec docs updated.

Exit criteria:

1. `docs/product-specs/tui-visual-screen-deck.md` reflects the new chrome, glyph, and hierarchy model.
2. `docs/product-specs/tui-copy-deck.md` reflects the new copy and glyph contract.

Status: completed in this round.

### M1 — Stage 0 and Stage 1 Visual Overhaul

Entry criteria:

1. M0 complete.

Exit criteria:

1. identity panel implemented,
2. `ARBITER` compact wordmark replaces `A R B I T E R`,
3. Stage 1 uses `▍ SETUP` instead of shell-like top strip,
4. rail glyphs are `◆/▸/◇`,
5. Stage 1 still behaves identically from a UX standpoint,
6. Stage 0 persists at the top of the durable transcript.

### M2 — Stage 2 and Stage 3 Visual Overhaul

Entry criteria:

1. M1 complete.

Exit criteria:

1. Stage 2 uses `▍ RUN` with short-prefix subsection headers,
2. Stage 3 uses `▍ RECEIPT` with parent/child subsection hierarchy,
3. full-width rule count is materially reduced,
4. worker/dashboard/receipt content remains functionally identical while gaining new hierarchy,
5. handoff seam between Stage 1 and Stage 2 is visually intentional.

### M3 — Validation and Product Re-Grade

Entry criteria:

1. M1 and M2 complete.

Exit criteria:

1. `npm run test:ui` passes,
2. `npm run test:e2e:tui` passes,
3. `npm run test:unit` passes,
4. `npm run test:guards` passes,
5. `npm run capture:tui` produces updated artifacts,
6. capture review confirms the redesign landed as specified,
7. product-surface grade is re-assessed with evidence.

## Concrete Steps

### M1 — Stage 0 and Stage 1

1. Update `src/ui/copy.ts` for the new brand string and stage-header vocabulary.
2. Add or centralize any new visual constants needed for stage headers, identity panel lines, and glyphs.
3. Rework `renderBrandBlock()` in `src/ui/wizard-theme.ts` into the identity panel shape.
4. Replace Stage 1 shell-like chrome with `▍ SETUP` in `src/ui/wizard/frame-manager.ts` and related render paths.
5. Update Stage 1 rail rendering to `◆/▸/◇` while preserving control glyphs.
6. Adjust Stage 1 footer and spacing so the screen remains readable at supported minimum sizes.
7. Ensure frozen Stage 1 transcript output uses the redesigned completed-rail treatment.

### M2 — Stage 2 and Stage 3

1. Replace shell-like run/receipt top strips with `▍ RUN` and `▍ RECEIPT`.
2. Replace full-width ruled subsection headers with short-prefix `── LABEL` headers in dashboard and receipt renders.
3. Reduce full-width rule usage to stage footers only.
4. Update dashboard spacing and hierarchy in `src/ui/runtime/dashboard-render.ts`.
5. Update receipt hierarchy and subsection treatment in `src/ui/runtime/receipt-render.ts`.
6. Refine the Stage 1 → Stage 2 handoff seam so `Starting run` sits between frozen setup and `▍ RUN` cleanly.
7. Preserve all existing transcript-integrity guarantees while changing only the visual layer.

### M3 — Validation and Closeout

1. Update capture wait strings and PTY assertions for the new headers and glyphs.
2. Run the TUI validation lane serially.
3. Review the fresh capture pack in both `*.txt` and `*.ansi` form.
4. Record the resulting product-surface grade and remaining polish gaps, if any.

## Validation and Acceptance

Required scope gate for the implementation round:

1. `npm run test:ui`
2. `npm run test:e2e:tui`
3. `npm run test:unit`
4. `npm run test:guards`
5. `npm run capture:tui`

Acceptance criteria:

1. No shell-like `› arbiter ...` status strips remain in Stage 1, Stage 2, or Stage 3.
2. `ARBITER` appears as a compact bold wordmark inside a teal identity panel.
3. Stage 1 rail uses `◆` complete, `▸` active, `◇` pending.
4. Stage 2 and Stage 3 use `▍ RUN` / `▍ RECEIPT` stage headers.
5. Subsection headers use short-prefix `── LABEL` format without trailing fill to terminal edge.
6. Full-width rule density is materially reduced.
7. The Stage 1 → Stage 2 handoff no longer visually collides with the dashboard header.
8. Durable transcript still preserves Stage 0 identity panel, frozen Stage 1 summary, one final Stage 2 snapshot, and one receipt.
9. Capture artifacts visibly reflect the new hierarchy and chrome.

## Idempotence and Recovery

1. This plan changes rendering and tests, not engine semantics or artifact contracts.
2. If implementation reveals an unexpected runtime regression, rollback can be isolated to the visual-layer commits.
3. If a particular visual treatment fails at minimum supported width, simplify the treatment rather than weakening runtime guarantees.

## Interfaces and Dependencies

Primary dependencies:

1. `docs/product-specs/tui-wizard.md` for behavior invariants,
2. `docs/product-specs/tui-copy-deck.md` for exact copy,
3. `docs/product-specs/tui-visual-screen-deck.md` for visual targets,
4. `docs/TUI-RUNTIME.md` for renderer/runtime boundaries,
5. `docs/TESTING.md` for TUI validation expectations.

## Handoffs and Ownership

If implementation is handed off:

1. the next contributor should treat this plan plus the two updated product-spec docs as the full source of truth,
2. no runtime-architecture changes should be made unless a new defect is discovered,
3. all changed tests/capture expectations must be updated atomically with the visual changes.

## Artifacts and Notes

Reference design conversation lives in Notion page:

- `Terminal Output` (`31c19a92-c679-806e-9274-c0556fa4ba61`)

The appended sections `Design Overhaul Proposal` and `Design Overhaul Proposal — Consensus Revision` are the design source material that this plan operationalizes.

## Plan Change Notes

1. 2026-03-07: initial implementation plan created after consensus redesign direction was reached.
