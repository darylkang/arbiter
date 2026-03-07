# Close Arbiter's TUI Runtime from A- to A+

This ExecPlan is a living document and must be updated as work proceeds.
This plan follows `docs/PLANS.md`.

## Purpose / Big Picture
Raise Arbiter's internal TUI runtime from its current strong-but-not-finished state to an A+ grade for Arbiter's actual product shape: Stage 1 wizard, Stage 2 live monitor, Stage 3 receipt, and their supported fallback paths.

The current runtime is coherent and credible. It is no longer a loose collection of terminal tricks. The remaining gap is narrower and more exacting:

1. Stage 2 and Stage 3 runtime ownership is still denser and less symmetric than Stage 1.
2. Stage 2 and Stage 3 still rely on row accounting that is correct for Arbiter's current glyph set but not yet isolated as an explicit runtime contract.
3. The validation stack is strong for structural truth, but not yet strong enough to call the runtime foundation elite across resize and scrollback edge cases.

Primary outcomes:

1. all stages of the runtime, not only the wizard, share the same engineering standard,
2. Stage 2 and Stage 3 become as intentionally decomposed and testable as Stage 1,
3. runtime frame math and row budgeting become explicit, localized, and validated for the glyphs and line grammar Arbiter actually emits,
4. validation catches resize, scrollback, and runtime-truth regressions before users do.

## Scope Guardrails
In scope:

1. terminal geometry and row-budget correctness for Stage 1, Stage 2, Stage 3, and supported fallback surfaces,
2. Stage 2 and Stage 3 runtime decomposition, ownership clarity, and explicit contracts,
3. stronger rendered validation for runtime-visible behavior and explicit review procedure for color/composition truth,
4. resize, short-terminal, and scrollback-handling semantics where required for runtime integrity,
5. doc and test updates needed to make the new A+ baseline explicit.

Out of scope:

1. changing research semantics, engine scheduling, stop-policy semantics, or artifact schemas,
2. changing user-facing wizard flow unless required by a runtime-safety or resize-handling fix and reflected in product specs,
3. broad visual redesign work,
4. migration to Ink or any third-party TUI framework,
5. generalized terminal framework features Arbiter does not need.

Sequencing constraints:

1. fold runtime exactness into the Stage 2/3 decomposition work rather than treating it as an isolated rewrite,
2. preserve the current pure-render-function model from `docs/TUI-RUNTIME.md`,
3. keep the current ANSI -> xterm-headless structural-truth path as the required automated validation model,
4. keep build-backed TUI commands serial throughout the work.

Temporary coexistence rules:

1. current `run-lifecycle-hooks.ts` may temporarily coexist with extracted Stage 2/3 helpers while the new seams are proven,
2. current xterm-headless `*.txt` review remains authoritative for structural truth throughout this plan,
3. resize handling may initially fail closed with explicit unsupported-size or no-live-resize messaging before more graceful reflow behavior is introduced.

## Progress
- [x] (2026-03-06 00:00Z) plan drafted (`proposed`)
- [x] (2026-03-07 06:04Z) M1 complete: Stage 2/3 runtime decomposed into explicit dashboard VM, dashboard render, live-region, and receipt-render seams; runtime behavior preserved and validated (`completed`)
- [x] (2026-03-07 06:04Z) M2 complete: validation expanded to cover undersized dashboard fallback, live resize across the dashboard path, short-terminal scrollback, and current glyph-width assumptions (`completed`)
- [ ] (2026-03-07 06:04Z) M3 pending external sign-off on the implemented runtime and A+ closeout evidence (`in_progress`)

## Surprises & Discoveries
- Observation: the remaining gap to A+ is no longer missing layering in Stage 1; it is runtime exactness and parity across all stages.
  Evidence: `src/ui/wizard/frame-manager.ts`, `src/ui/wizard/steps.ts`, `src/ui/wizard/controls.ts`, `src/ui/wizard-theme.ts`, `src/ui/runtime-view-models.ts`.
- Observation: the current hardening round left Stage 2 and Stage 3 improved but still dense.
  Evidence: `src/ui/run-lifecycle-hooks.ts` still owns event subscription, VM construction, live-region math, dashboard composition, receipt composition, and final teardown.
- Observation: the main known technical debt in runtime exactness is the heuristic row-counting path.
  Evidence: `src/ui/run-lifecycle-hooks.ts` uses `countRenderedRows()` based on stripped string length and `Math.ceil(line.length / width)`.
- Observation: the current row-counting path is correct for Arbiter's current emitted glyph set because the runtime uses single-width BMP codepoints in the live region.
  Evidence: runtime glyphs such as `✔`, `◆`, `◇`, `─`, `█`, `░`, and the braille spinner frames are single-width in the supported terminal profiles; current risk is latent rather than active.
- Observation: `RunDashboardMonitor` currently combines two responsibilities: event accumulation into `DashboardState` and render-orchestration/live-region ownership.
  Evidence: `src/ui/run-lifecycle-hooks.ts` contains both the event handler mutators and the render/teardown logic in one class.
- Observation: the existing validation stack is strong for text truth but still requires a human-operated viewer for color/composition truth.
  Evidence: `scripts/tui-visual-capture.mjs`, `scripts/tui-terminal-viewer.html`, `test/e2e/tui-visual-capture.test.mjs`.
- Observation: the Stage 2 live region now re-measures frozen-prefix height at the current terminal width on every render tick rather than relying on a startup-only prefix row count.
  Evidence: `src/ui/run-lifecycle-hooks.ts`, `src/ui/runtime/live-region.ts`.

## Outcomes & Retrospective
Delivered in this round:

1. `src/ui/run-lifecycle-hooks.ts` is now a runtime coordinator rather than the sole owner of Stage 2/3 view-model construction, rendering, geometry, and receipt composition.
2. New explicit Stage 2/3 seams now exist in:
   - `src/ui/runtime/dashboard-vm.ts`
   - `src/ui/runtime/dashboard-render.ts`
   - `src/ui/runtime/live-region.ts`
   - `src/ui/runtime/receipt-render.ts`
3. Runtime geometry assumptions are localized and documented in code via the live-region module rather than buried inside the coordinator.
4. The resize contract is now explicit in `docs/TUI-RUNTIME.md` and `docs/product-specs/tui-visual-screen-deck.md`.
5. Validation now covers:
   - undersized dashboard startup fallback,
   - live resize during the dashboard path,
   - short-terminal Stage 2→Stage 3 handoff,
   - current glyph-width row counting assumptions,
   - receipt artifact ANSI separation.

Remaining gap before the plan can be marked fully completed:

1. external review/sign-off on the implemented runtime and this closeout evidence.

## Decision Log
- Decision: keep the current five-layer runtime architecture from `docs/TUI-RUNTIME.md`.
  Rationale: the remaining gap is execution quality and stage parity, not missing fundamental abstraction boundaries.
  Date/Author: 2026-03-06, Codex planning round.
- Decision: A+ closeout work should center Stage 2 and Stage 3, not re-open the Stage 1 architecture.
  Rationale: Stage 1 is already the cleanest part of the runtime and should serve as the benchmark for Stage 2 and Stage 3.
  Date/Author: 2026-03-06, Codex planning round.
- Decision: screenshot automation is not a required success criterion for this closeout plan.
  Rationale: structural truth already comes from real ANSI output replayed through `@xterm/headless`, and manual color/composition review already exists through the xterm viewer. Screenshot automation is optional future infrastructure, not part of the A+ bar for this plan.
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
4. Resize contract: the explicit documented answer to whether Stage 2 supports live resize, partially supports it, or intentionally fails closed.

Current known weak points:

1. `src/ui/run-lifecycle-hooks.ts` still uses heuristic row counting and owns too many responsibilities.
2. resize behavior is handled at process-start constraints, but not yet proven as an elite runtime during mid-session size changes.
3. the validation matrix is stronger than before but still needs a tighter resize and scrollback contract for Stage 2 and Stage 3.

## Plan of Work
Ordering principle: dependency and risk.

1. bring Stage 2 and Stage 3 runtime ownership up to Stage 1’s standard while localizing the current row-budget and geometry assumptions,
2. then strengthen the validation stack around resize, scrollback, and unsupported-size behavior,
3. then close with an explicit A+ readiness audit.

## Milestones and Gates
### M1: Stage 2 and Stage 3 runtime parity
Outcome:

1. Stage 2 and Stage 3 runtime code is decomposed into explicit seams comparable to Stage 1,
2. event subscription, VM construction, frame math, dashboard composition, and receipt composition are no longer crowded into one file,
3. row budgeting and live-region math are extracted, localized, and explicitly documented for Arbiter's current glyph assumptions,
4. run-path runtime ownership becomes easier to reason about and review.

Entry criteria:

1. current runtime hardening baseline is green,
2. current dashboard and receipt behavior is captured in fixtures and PTY evidence.

Exit evidence:

1. `src/ui/run-lifecycle-hooks.ts` is materially slimmer and acts primarily as a runtime coordinator,
2. extracted modules exist for:
   - dashboard view-model construction,
   - live-region or frame math,
   - dashboard text composition,
   - receipt text composition,
   or an equivalently clear split with the same effect,
3. row-counting and related geometry assumptions are moved into the extracted live-region or equivalent helper seam and documented explicitly,
4. Stage 2 and Stage 3 fixture coverage exists at the module seam level,
5. PTY and rendered tests still prove correct behavior at `120x24`, `60x24`, and `60x18`,
6. no user-facing behavior drift relative to the governing product-spec docs unless explicitly recorded.

Rollback boundary:

1. extracted Stage 2/3 modules can be reverted independently of later validation expansion.

### M2: Elite validation and resize/scrollback confidence
Outcome:

1. the validation stack covers the edge cases and visual truths most likely to regress,
2. runtime changes can be reviewed without relying only on manual terminal inspection,
3. resize and scrollback are treated as first-class runtime contracts.

Entry criteria:

1. M1 seams are stable enough that test failures localize to meaningful ownership boundaries.

Exit evidence:

1. `npm run capture:tui` produces structural artifacts validated at `120x24`, `60x24`, and `60x18`,
2. automated checks exist for:
   - startup at undersized terminals,
   - minimum supported sizes,
   - short-terminal Stage 2→Stage 3 handoff,
   - full scrollback ordering,
   - an explicit, documented resize contract proven either by a resize-sensitive test or by a documented unsupported/no-live-resize contract,
3. the recent hardening commits are re-reviewed against the new validation matrix and any fidelity gaps are either closed or documented.

Rollback boundary:

1. validation additions may be reverted independently only with explicit reopened-risk documentation; the PTY/xterm structural-truth coverage must remain.

### M3: A+ closeout and external sign-off
Outcome:

1. the runtime is judged elite for Arbiter’s product shape across all stages,
2. docs, tests, and review workflows all describe the same steady-state model,
3. an external review signs off on both the plan execution fidelity and the resulting architecture.

Entry criteria:

1. M2 validations are green,
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
### M1: Stage 2 and Stage 3 runtime parity
1. Split `src/ui/run-lifecycle-hooks.ts` into clearer ownership seams. Preferred module targets:
   - `src/ui/runtime/dashboard-vm.ts`
   - `src/ui/runtime/dashboard-render.ts`
   - `src/ui/runtime/live-region.ts`
   - `src/ui/runtime/receipt-render.ts`
   Use equivalent names if better, but keep responsibilities narrow and explicit.
2. Keep `src/ui/runtime-view-models.ts` as the shared VM contract source, expanding it only when it increases clarity rather than coupling.
3. As part of that extraction, isolate row-counting and related geometry logic into the live-region seam and document the current single-width-BMP glyph assumption explicitly in code and tests.
4. Add or update unit tests for:
   - braille spinner rows,
   - ruled-section lines,
   - row-counting behavior for the current emitted glyph set.
5. Ensure direct write ownership remains only in the approved seams from `docs/TUI-RUNTIME.md` and `scripts/architecture-guard.mjs`.
6. Add fixture tests that compose Stage 2 and Stage 3 from their extracted seams, not only from end-to-end capture.
7. Re-run the architecture guard, unit, PTY, and capture workflows.

### M2: Elite validation and resize/scrollback confidence
1. Expand `test/e2e/tui-visual-capture.test.mjs` and/or a companion test to cover:
   - short-terminal scrollback correctness,
   - minimum supported runtime layout,
   - unsupported-size behavior,
   - one explicit resize-sensitive path or a documented no-live-resize contract if dynamic resize remains intentionally unsupported.
2. Document the resize contract explicitly in the runtime docs and any affected product-spec/runtime workflow docs.
3. Review the recent runtime commits against the strengthened validation matrix and record any fidelity corrections required before M3.

### M3: A+ closeout and external sign-off
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

1. Stage 2 and Stage 3 no longer bury redraw and handoff assumptions in an oversized runtime file; current row-budget assumptions are explicit, localized, and validated for Arbiter's glyph set.
2. Stage 2 and Stage 3 runtime code is decomposed and reviewable at the same level of clarity as Stage 1.
3. The runtime passes the edge cases that previously escaped review:
   - short terminals,
   - minimum supported sizes,
   - scrollback preservation,
   - receipt artifact separation,
   - unsupported-size handling,
   - resize contract handling.
4. Reviewers can inspect:
   - deterministic rendered text truth,
   - ANSI replay truth,
   - human-reviewed color/composition truth through the existing xterm viewer,
   without inventing a second rendering path.

Required commands by milestone:

- M1 scope gate:
  - `npm run test:unit`
  - `npm run test:guards`
  - `npm run test:e2e:tui`
  - `npm run capture:tui`
- M2 scope gate:
  - `npm run test:e2e:tui`
  - `npm run test:unit`
  - `npm run test:guards`
  - `npm run capture:tui`
- M3 merge gate:
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
5. explicit review notes covering recent-commit fidelity and the final resize contract.

## Idempotence and Recovery
1. Land Stage 2/3 module extractions and geometry-localization changes in logical commits so regressions can be localized.
2. If row-budget or geometry-localization changes introduce regressions, revert to the last passing implementation only with a documented issue and reopened risk; do not silently keep a mixed model.
3. If resize behavior cannot be made elite within reasonable scope, fail closed with an explicit documented unsupported-resize or no-live-resize contract rather than pretending the runtime supports it.

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
- 2026-03-06: revised after external architecture review to merge geometry work into the Stage 2/3 decomposition milestone and drop screenshot automation as a required success criterion.
- 2026-03-07: M1 and M2 completed. Stage 2/3 runtime seams were extracted, the resize contract was made explicit, and validation expanded to cover undersized dashboard fallback plus live resize on the dashboard path.
