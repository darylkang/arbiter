# Close Arbiter's TUI Runtime from A- to A+

This ExecPlan is a living document and must be updated as work proceeds.
This plan follows `docs/PLANS.md`.

## Purpose / Big Picture
Raise Arbiter's internal TUI runtime from its current strong-but-not-finished state to an A+ grade for Arbiter's actual product shape: Stage 1 wizard, Stage 2 live monitor, Stage 3 receipt, and their supported fallback paths.

The current runtime is coherent and credible. It is no longer a loose collection of terminal tricks. The remaining gap is narrower and more exacting:

1. Stage 2 and Stage 3 still rely on heuristic row accounting rather than true rendered-cell math.
2. Stage 2 and Stage 3 runtime ownership is still denser and less symmetric than Stage 1.
3. The validation stack is strong for structural truth, but not yet strong enough to call the visual/runtime foundation elite across resize and scrollback edge cases.

Primary outcomes:

1. all stages of the runtime, not only the wizard, share the same engineering standard,
2. runtime frame math is cell-width accurate for the glyphs and line grammar Arbiter actually emits,
3. Stage 2 and Stage 3 become as intentionally decomposed and testable as Stage 1,
4. validation catches resize, scrollback, and visual-truth regressions before users do.

## Scope Guardrails
In scope:

1. terminal geometry and row-budget correctness for Stage 1, Stage 2, Stage 3, and supported fallback surfaces,
2. Stage 2 and Stage 3 runtime decomposition, ownership clarity, and explicit contracts,
3. stronger rendered and screenshot-backed validation for runtime-visible behavior,
4. resize, short-terminal, and scrollback-handling semantics where required for runtime integrity,
5. doc and test updates needed to make the new A+ baseline explicit.

Out of scope:

1. changing research semantics, engine scheduling, stop-policy semantics, or artifact schemas,
2. changing user-facing wizard flow unless required by a runtime-safety or resize-handling fix and reflected in product specs,
3. broad visual redesign work,
4. migration to Ink or any third-party TUI framework,
5. generalized terminal framework features Arbiter does not need.

Sequencing constraints:

1. fix runtime exactness before expanding validation or refactoring Stage 2/3 composition,
2. preserve the current pure-render-function model from `docs/TUI-RUNTIME.md`,
3. treat screenshot automation as validation infrastructure layered on top of the current ANSI-render path, not as a second rendering system,
4. keep build-backed TUI commands serial throughout the work.

Temporary coexistence rules:

1. current `run-lifecycle-hooks.ts` may temporarily coexist with extracted Stage 2/3 helpers while the new seams are proven,
2. current xterm-headless `*.txt` review remains authoritative for structural truth until screenshot automation lands,
3. resize handling may initially fail closed with explicit unsupported-size messaging before more graceful reflow behavior is introduced.

## Progress
- [ ] (2026-03-06 00:00Z) plan drafted; implementation not started (`proposed`)
- [ ] external architecture review and sign-off recorded before M1 starts

## Surprises & Discoveries
- Observation: the remaining gap to A+ is no longer missing layering in Stage 1; it is runtime exactness and parity across all stages.
  Evidence: `src/ui/wizard/frame-manager.ts`, `src/ui/wizard/steps.ts`, `src/ui/wizard/controls.ts`, `src/ui/wizard-theme.ts`, `src/ui/runtime-view-models.ts`.
- Observation: the current hardening round left Stage 2 and Stage 3 improved but still dense.
  Evidence: `src/ui/run-lifecycle-hooks.ts` still owns event subscription, VM construction, live-region math, dashboard composition, receipt composition, and final teardown.
- Observation: the main known technical debt in runtime exactness is the heuristic row-counting path.
  Evidence: `src/ui/run-lifecycle-hooks.ts` uses `countRenderedRows()` based on stripped string length and `Math.ceil(line.length / width)`.
- Observation: the existing validation stack is strong for text truth but still requires a human-operated viewer for color/composition truth.
  Evidence: `scripts/tui-visual-capture.mjs`, `scripts/tui-terminal-viewer.html`, `test/e2e/tui-visual-capture.test.mjs`.

## Decision Log
- Decision: keep the current five-layer runtime architecture from `docs/TUI-RUNTIME.md`.
  Rationale: the remaining gap is execution quality and stage parity, not missing fundamental abstraction boundaries.
  Date/Author: 2026-03-06, Codex planning round.
- Decision: A+ closeout work should center Stage 2 and Stage 3, not re-open the Stage 1 architecture.
  Rationale: Stage 1 is already the cleanest part of the runtime and should serve as the benchmark for Stage 2 and Stage 3.
  Date/Author: 2026-03-06, Codex planning round.
- Decision: visual-truth automation should be additive to the current ANSI/xterm replay path, not a replacement.
  Rationale: structural truth must continue to come from real ANSI output; screenshot evidence should augment, not fork, the validation model.
  Date/Author: 2026-03-06, Codex planning round.

## Context and Orientation
Reviewed before drafting this plan:

1. `AGENTS.md` for current TUI workflow, validation policy, and repository invariants.
2. `docs/DESIGN.md` for stage model, run-path contract, and receipt/artifact boundaries.
3. `README.md` for the operator-facing visual-capture workflow and current testing story.
4. `docs/PLANS.md` for ExecPlan structure and completion rules.
5. `docs/TUI-RUNTIME.md` for the durable runtime architecture and approved write seams.
6. `docs/product-specs/tui-wizard.md`, `docs/product-specs/tui-copy-deck.md`, and `docs/product-specs/tui-visual-screen-deck.md` for current user-facing TUI truth.
7. `src/ui/wizard/frame-manager.ts` for current Stage 1 runtime ownership.
8. `src/ui/wizard/steps.ts` and `src/ui/wizard/controls.ts` for current typed stage control and widget behavior.
9. `src/ui/wizard-theme.ts` for render primitives and current width/spacing rules.
10. `src/ui/runtime-view-models.ts` for current VM contracts.
11. `src/ui/run-lifecycle-hooks.ts` for current Stage 2 and Stage 3 runtime behavior, row budgeting, and scrollback handling.
12. `src/ui/tui-constraints.ts` for minimum supported terminal sizes.
13. `test/e2e/tui-pty.test.mjs`, `test/e2e/tui-visual-capture.test.mjs`, and `test/unit/tui-runtime-fixtures.test.mjs` for current validation coverage.
14. `scripts/architecture-guard.mjs` and `scripts/tui-visual-capture.mjs` for current architectural enforcement and rendered validation.

Recent implementation baseline to be reviewed for fidelity as part of this plan:

1. `092f0d8` `feat(ui): improve TUI polish and semantics`
2. `e64852d` `fix(ui): stabilize dashboard redraw region`
3. `d5a1426` `fix(ui): harden TUI terminal safety`
4. `23acd42` `refactor(ui): complete TUI runtime hardening`

Non-obvious terms used in this plan:

1. Cell-width accounting: width and row calculation based on rendered terminal cells rather than raw string length.
2. Runtime parity: Stage 2 and Stage 3 having the same level of modularity, ownership clarity, and testability as Stage 1.
3. Visual truth: the actual rendered terminal output a user sees, not just stripped or abstracted text.
4. Screenshot-backed validation: browser-rendered xterm output captured as images for repeatable human or automated review, while still sourcing terminal state from the real ANSI stream.

Current known weak points:

1. `src/ui/run-lifecycle-hooks.ts` still uses heuristic row counting and owns too many responsibilities.
2. resize behavior is handled at process-start constraints, but not yet proven as an elite runtime during mid-session size changes.
3. the validation matrix is stronger than before but still optimized for text truth more than screenshot-grade runtime truth.

## Plan of Work
Ordering principle: dependency and risk.

1. make terminal geometry exact before refactoring Stage 2/3 runtime seams,
2. bring Stage 2 and Stage 3 runtime ownership up to Stage 1’s standard,
3. then strengthen the validation stack so the new baseline is enforceable and reviewable,
4. then close with an explicit A+ readiness audit.

## Milestones and Gates
### M1: Terminal geometry exactness
Outcome:

1. row budgeting, wrapping, truncation, and live-region math are based on rendered cell width rather than string length,
2. runtime calculations are shared and explicit instead of being re-derived ad hoc,
3. short-terminal and scrollback behavior are exact for Arbiter’s current glyph set and layout grammar.

Entry criteria:

1. current runtime hardening baseline is green,
2. current known heuristic paths are identified in code and tests.

Exit evidence:

1. `src/ui/run-lifecycle-hooks.ts` no longer uses `countRenderedRows()` based on `line.length`,
2. a shared rendered-width utility exists and is used by Stage 2/3 row budgeting and any affected truncation helpers,
3. PTY and rendered tests prove correct behavior at `120x24`, `60x24`, and `60x18`,
4. no duplicated dashboard frames or lost top-line status under short-terminal handoff cases.

Rollback boundary:

1. geometry utility and the Stage 2/3 callers can be reverted independently of later runtime decomposition.

### M2: Stage 2 and Stage 3 runtime parity
Outcome:

1. Stage 2 and Stage 3 runtime code is decomposed into explicit seams comparable to Stage 1,
2. event subscription, VM construction, frame math, dashboard composition, and receipt composition are no longer crowded into one file,
3. run-path runtime ownership becomes easier to reason about and review.

Entry criteria:

1. M1 geometry utilities are stable,
2. current dashboard and receipt behavior is captured in fixtures and PTY evidence.

Exit evidence:

1. `src/ui/run-lifecycle-hooks.ts` is materially slimmer and acts primarily as a runtime coordinator,
2. extracted modules exist for:
   - dashboard view-model construction,
   - live-region or frame math,
   - dashboard text composition,
   - receipt text composition,
   or an equivalently clear split with the same effect,
3. Stage 2 and Stage 3 fixture coverage exists at the module seam level,
4. no user-facing behavior drift relative to the governing product-spec docs unless explicitly recorded.

Rollback boundary:

1. extracted Stage 2/3 modules can be reverted while preserving the M1 geometry improvements.

### M3: Elite validation and resize/scrollback confidence
Outcome:

1. the validation stack covers the edge cases and visual truths most likely to regress,
2. runtime changes can be reviewed without relying only on manual terminal inspection,
3. resize and scrollback are treated as first-class runtime contracts.

Entry criteria:

1. M2 seams are stable enough that test failures localize to meaningful ownership boundaries.

Exit evidence:

1. `npm run capture:tui` produces not only `*.txt` structural artifacts but also a documented, repeatable screenshot review path suitable for A+ closeout,
2. automated checks exist for:
   - startup at undersized terminals,
   - minimum supported sizes,
   - short-terminal Stage 2→Stage 3 handoff,
   - full scrollback ordering,
   - at least one resize-sensitive scenario or an explicit, documented unsupported-resize contract,
3. the recent hardening commits are re-reviewed against the new validation matrix and any fidelity gaps are either closed or documented.

Rollback boundary:

1. screenshot-backed validation may be reverted independently if it proves flaky, but the underlying PTY/xterm structural truth coverage must remain.

### M4: A+ closeout and external sign-off
Outcome:

1. the runtime is judged elite for Arbiter’s product shape across all stages,
2. docs, tests, and review workflows all describe the same steady-state model,
3. an external review signs off on both the plan execution fidelity and the resulting architecture.

Entry criteria:

1. M3 validations are green,
2. no known P1 runtime defects remain.

Exit evidence:

1. merge-gate suite passes,
2. `README.md`, `AGENTS.md`, `docs/TUI-RUNTIME.md`, and the TUI product-spec docs are in sync,
3. this plan’s `Outcomes & Retrospective` records the final architecture, validation story, and any explicitly deferred non-blocking items,
4. Opus or equivalent external review signs off on both:
   - the recent implementation fidelity,
   - the A+ closeout plan and its results.

Rollback boundary:

1. none; this becomes the new baseline.

## Concrete Steps
### M1: Terminal geometry exactness
1. Audit every runtime path that assumes `string.length === rendered cell width`, starting with `src/ui/run-lifecycle-hooks.ts` and any shared helper in `src/ui/wizard-theme.ts`.
2. Introduce a shared rendered-width utility module under `src/ui/` that:
   - strips ANSI,
   - measures visible width using terminal-cell semantics for Arbiter’s glyph set,
   - computes wrapped row counts for a given width,
   - exposes truncation helpers where needed.
3. Replace heuristic row-counting in Stage 2/3 with the shared utility.
4. Add or update unit tests for:
   - braille spinner rows,
   - box-drawing or ruled-section lines,
   - wide-glyph or mixed-glyph width handling as emitted by the current runtime.
5. Re-run PTY and rendered capture validations across `120x24`, `60x24`, and `60x18`.

### M2: Stage 2 and Stage 3 runtime parity
1. Split `src/ui/run-lifecycle-hooks.ts` into clearer ownership seams. Preferred module targets:
   - `src/ui/runtime/dashboard-vm.ts`
   - `src/ui/runtime/dashboard-render.ts`
   - `src/ui/runtime/live-region.ts`
   - `src/ui/runtime/receipt-render.ts`
   Use equivalent names if better, but keep responsibilities narrow and explicit.
2. Keep `src/ui/runtime-view-models.ts` as the shared VM contract source, expanding it only when it increases clarity rather than coupling.
3. Ensure direct write ownership remains only in the approved seams from `docs/TUI-RUNTIME.md` and `scripts/architecture-guard.mjs`.
4. Add fixture tests that compose Stage 2 and Stage 3 from their extracted seams, not only from end-to-end capture.
5. Re-run the architecture guard, unit, PTY, and capture workflows.

### M3: Elite validation and resize/scrollback confidence
1. Extend `scripts/tui-visual-capture.mjs` or a companion script to produce screenshot-ready artifacts through the existing xterm/browser path.
2. Add at least one documented automated or semi-automated screenshot workflow that reviewers can run repeatably without guesswork.
3. Expand `test/e2e/tui-visual-capture.test.mjs` and/or a companion test to cover:
   - short-terminal scrollback correctness,
   - minimum supported runtime layout,
   - unsupported-size behavior,
   - one explicit resize-sensitive path or a documented no-live-resize contract if dynamic resize remains intentionally unsupported.
4. Review the recent runtime commits against the strengthened validation matrix and record any fidelity corrections required before M4.

### M4: A+ closeout and external sign-off
1. Sync docs where runtime-visible constraints changed.
2. Run the full merge gate plus `npm run capture:tui`.
3. Prepare a concise sign-off packet for external review:
   - recent commits,
   - changed runtime seams,
   - latest capture pack path,
   - remaining known non-blocking items, if any.
4. Obtain Opus review focused on:
   - implementation fidelity of the recent major coding round,
   - correctness of this A+ closeout plan,
   - sign-off or blocking objections.

## Validation and Acceptance
Observable acceptance criteria:

1. Stage 2 and Stage 3 no longer depend on heuristic row math for redraw and handoff.
2. Stage 2 and Stage 3 runtime code is decomposed and reviewable at the same level of clarity as Stage 1.
3. The runtime passes the edge cases that previously escaped review:
   - short terminals,
   - minimum supported sizes,
   - scrollback preservation,
   - receipt artifact separation,
   - unsupported-size handling.
4. Reviewers can inspect:
   - deterministic rendered text truth,
   - ANSI replay truth,
   - screenshot-level visual truth,
   without inventing a second rendering path.

Required commands by milestone:

- M1 and M2 scope gate:
  - `npm run test:unit`
  - `npm run test:guards`
  - `npm run test:e2e:tui`
  - `npm run capture:tui`
- M3 scope gate:
  - `npm run test:e2e:tui`
  - `npm run test:unit`
  - `npm run test:guards`
  - `npm run capture:tui`
  - any screenshot-backed validation command introduced in this plan
- M4 merge gate:
  - `npm run check:types`
  - `npm run check:schemas`
  - `npm run test:mock-run`
  - `npm run test:templates`
  - `npm run test:verify`
  - `npm run test:debate`
  - `npm run test:clustering`
  - `npm run test:embeddings`
  - `npm run test:pack`
  - `npm run test:ui`
  - `npm run test:e2e:tui`
  - `npm run test:cli-contracts`
  - `npm run test:unit`
  - `npm run test:guards`
  - `npm run capture:tui`

Expected evidence:

1. updated fixture tests for Stage 2 and Stage 3 module seams,
2. PTY and rendered capture evidence at `120x24`, `60x24`, and `60x18`,
3. one current capture pack path for reviewer consumption,
4. architecture guard output showing write/ANSI ownership remains constrained,
5. explicit review notes covering recent-commit fidelity.

## Idempotence and Recovery
1. Land geometry utilities and Stage 2/3 module extractions in logical commits so regressions can be localized.
2. If geometry exactness introduces regressions, revert to the last passing heuristic implementation only with a documented issue and reopened risk; do not silently keep a mixed model.
3. If screenshot automation proves flaky, keep xterm-headless rendered truth and the manual xterm viewer as the fallback while preserving any stable screenshot helper assets that remain useful.
4. If resize behavior cannot be made elite within reasonable scope, fail closed with an explicit documented unsupported-resize contract rather than pretending the runtime supports it.

## Interfaces and Dependencies
Primary code surfaces:

1. `src/ui/run-lifecycle-hooks.ts`
2. `src/ui/runtime-view-models.ts`
3. `src/ui/wizard-theme.ts`
4. `src/ui/fmt.ts`
5. `src/ui/wizard/frame-manager.ts`
6. `src/ui/tui-constraints.ts`
7. `scripts/tui-visual-capture.mjs`
8. `scripts/tui-terminal-viewer.html`
9. `test/e2e/tui-pty.test.mjs`
10. `test/e2e/tui-visual-capture.test.mjs`
11. `test/unit/tui-runtime-fixtures.test.mjs`
12. `scripts/architecture-guard.mjs`

External reviewer inputs:

1. Opus review of recent runtime commits and this plan,
2. latest capture pack path,
3. full merge-gate results at closeout.

## Handoffs and Ownership
Implementation owner:

1. runtime engineer executing this plan owns code changes, validation, and doc sync.

External review owner:

1. Opus reviews:
   - recent runtime hardening fidelity,
   - this A+ closeout plan,
   - final post-implementation readiness.

Required handoff packet before external review:

1. touched files,
2. commit list for the current round,
3. validation commands run,
4. latest capture pack path,
5. unresolved risks or explicitly deferred non-blocking items.

## Artifacts and Notes
Current baseline artifacts:

1. latest merge-gate capture pack under `output/playwright/tui-visual/`
2. current runtime hardening plan in `docs/exec-plans/2026-03-06-build-internal-tui-runtime-layer.md`
3. current runtime architecture contract in `docs/TUI-RUNTIME.md`

## Plan Change Notes
- 2026-03-06: created as a follow-on plan after the runtime hardening plan closed at a strong but not yet elite grade.
