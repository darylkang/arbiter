# Harden Arbiter's Internal TUI Runtime Layer

This ExecPlan is a living document and must be updated as work proceeds.
This plan follows `docs/PLANS.md`.

## Purpose / Big Picture
Harden Arbiter's existing custom TUI runtime into an Arbiter-specific framework-grade architecture without migrating to Ink and without introducing a second competing rendering model.

This is not a general-purpose framework project and not a render-tree rewrite.
It is a structural hardening pass around the architecture Arbiter already has:

1. typed screen state and view models,
2. pure render primitives returning strings,
3. a semantic formatter layer,
4. centralized terminal lifecycle ownership,
5. deterministic rendered validation and architecture guards.

Primary operator-visible outcomes:

1. TUI changes are implemented through typed view models and shared render primitives rather than ad hoc feature-level string assembly.
2. Wizard, dashboard, and receipt share one runtime vocabulary and one ownership model for cursor, alt-screen, redraw, and teardown.
3. Deterministic review uses the real ANSI output plus xterm replay, not a second rendering implementation.
4. Contributors can extend the TUI without reverse-engineering low-level terminal behavior.

## Scope Guardrails
In scope:

1. internal TUI runtime architecture for Stage 1, Stage 2, Stage 3, and supported fallback surfaces,
2. formalizing current view-model contracts including new `DashboardVM` and `ReceiptVM` if needed,
3. pure render primitive and formatter hardening,
4. runtime ownership of terminal lifecycle and frame policy,
5. architecture guards and validation expansion needed to make the runtime enforceable,
6. durable documentation updates in `docs/TUI-RUNTIME.md`, `docs/DESIGN.md`, `README.md`, and relevant product-spec docs when runtime-visible constraints change.

Out of scope:

1. changing engine semantics, event truth, stopping logic, or artifact contracts,
2. changing human-facing wizard behavior unless required by a runtime-safety fix and documented in the governing product spec,
3. introducing a declarative layout tree or dual renderer backend architecture in this plan,
4. inventing a reusable library for other repositories,
5. transcript/chat UX, plugin surfaces, or mouse-primary interaction,
6. framework migration to Ink or another third-party TUI stack in this plan.

Sequencing constraints:

1. preserve current user-facing behavior while internal runtime seams are hardened,
2. update stale product-spec implementation guidance in the same planning round before implementation starts,
3. land architecture guards only after approved write seams and formatter contracts are explicit,
4. keep build-backed TUI validation commands serial, not parallel.

Temporary coexistence rules:

1. current pure render functions remain the rendering contract,
2. new view models may coexist with older data shapes while a given stage is being normalized,
3. widget fallback rendering may remain temporarily only while explicitly tracked in this plan and tests.

## Progress
- [x] (2026-03-06 15:05Z) initial plan drafted around a larger runtime-layer migration (`proposed`)
- [x] (2026-03-06 15:24Z) durable runtime contract landed in docs and canonical references (`in_progress`)
- [x] (2026-03-06 16:12Z) runtime contract revised to match the existing pure-render-function architecture
- [ ] Stage 1, Stage 2, and Stage 3 view-model contracts formalized and reconciled
- [ ] formatter, primitive, and fixture-test hardening landed
- [ ] architecture guard and terminal-edge-case coverage landed
- [ ] runtime ownership seams tightened and remaining implementation guidance drift removed
- [ ] validation matrix expanded and completion evidence captured

## Surprises & Discoveries
- Observation: Arbiter's current TUI stack is already structured enough that a disciplined internal runtime layer is cheaper than an Ink rewrite.
  Evidence: `src/ui/wizard/frame-manager.ts`, `src/ui/wizard/steps.ts`, `src/ui/wizard/controls.ts`, `src/ui/wizard-theme.ts`, `src/ui/run-lifecycle-hooks.ts`.
- Observation: the main remaining rigor gaps are not missing abstractions like a render tree; they are test ergonomics, contract drift, and enforcement gaps.
  Evidence: current runtime already has typed state, pure render primitives, and centralized frame ownership, but still lacks plain-formatter fixtures and architecture guards.
- Observation: deterministic text validation is already strongest when derived from the real ANSI output via `@xterm/headless`.
  Evidence: `scripts/tui-visual-capture.mjs` and `test/e2e/tui-visual-capture.test.mjs`.
- Observation: prior architecture reviews overrated the foundation because validation overfit the 120x40 happy path.
  Evidence: later audit findings uncovered 24-row and sub-60-column defects despite earlier strong scores.

## Decision Log
- Decision: do not migrate Arbiter to Ink in this plan.
  Rationale: the product shape is still wizard -> monitor -> receipt, and the migration cost is high relative to the benefit if we impose framework-grade rigor on the narrower custom runtime.
  Date/Author: 2026-03-06, Codex planning round.
- Decision: keep pure render functions as the core rendering contract.
  Rationale: the current architecture already uses typed state plus composable pure string-returning primitives; replacing that with a render tree would add migration risk without proportionate payoff.
  Date/Author: 2026-03-06, revised after architecture review.
- Decision: deterministic structural truth comes from ANSI replay through `@xterm/headless`, not a second text-render backend.
  Rationale: this validates the actual runtime output and avoids divergence between parallel render implementations.
  Date/Author: 2026-03-06, revised after architecture review.
- Decision: prioritize architecture guards, plain-formatter fixtures, and formal view-model contracts over deeper runtime abstraction.
  Rationale: these close the actual rigor gaps in the current codebase.
  Date/Author: 2026-03-06, revised after architecture review.

## Context and Orientation
Reviewed before revising this plan:

1. `AGENTS.md` for repository invariants, validation expectations, and TUI workflow rules.
2. `README.md` for current operator and visual-validation workflow guidance.
3. `docs/DESIGN.md` for CLI and stage-model semantics plus artifact/scrollback constraints.
4. `docs/PLANS.md` and `docs/exec-plans/README.md` for ExecPlan structure and lifecycle contract.
5. `docs/product-specs/tui-wizard.md` for behavior semantics and stacked run-path contract.
6. `docs/product-specs/tui-copy-deck.md` for locked copy and fallback wording.
7. `docs/product-specs/tui-visual-screen-deck.md` for exact visual grammar and implementation guidance that now requires reconciliation.
8. `docs/TUI-RUNTIME.md` for the durable runtime contract.
9. `src/ui/wizard/app.ts` for the current orchestration boundary.
10. `src/ui/wizard/frame-manager.ts` for current frame ownership.
11. `src/ui/wizard/controls.ts` for widget and raw-key ownership.
12. `src/ui/wizard/steps.ts` and `src/ui/wizard/types.ts` for typed step outcomes and `StepFrame` contract.
13. `src/ui/wizard-theme.ts` for current pure render primitives and current drift points.
14. `src/ui/run-lifecycle-hooks.ts` for Stage 2 and Stage 3 runtime rendering and terminal handoff.
15. `src/ui/fmt.ts` for formatter capabilities and current lack of a plain/no-color formatter.
16. `scripts/tui-visual-capture.mjs`, `scripts/tui-terminal-viewer.html`, and `test/e2e/tui-visual-capture.test.mjs` for current visual-validation infrastructure.

Non-obvious terms used in this plan:

1. View model: typed renderer-facing screen data that already contains display-ready summaries and emphasis state.
2. Plain formatter: a formatter implementation whose style methods return the input unchanged so pure render functions can be unit-tested without ANSI noise.
3. Runtime seam: code allowed to own terminal mode, cursor, alternate screen, redraw policy, and direct stdout writes.
4. Architecture guard: an automated test that prevents bypassing the intended renderer/runtime boundaries.
5. Render fixture: a deterministic string or xterm-replayed snapshot used to validate a screen or primitive.

Entry points and high-risk components:

1. `src/ui/wizard/frame-manager.ts`: high risk because it owns Stage 1 screen composition and must remain the narrow terminal owner.
2. `src/ui/run-lifecycle-hooks.ts`: high risk because Stage 2 and Stage 3 redraw correctness and scrollback preservation are historically fragile.
3. `src/ui/wizard/controls.ts`: high risk because widgets are interactive and must remain exception-safe while keeping ownership boundaries clean.
4. `src/ui/wizard-theme.ts`: high risk because stale constants and terminal-width leaks currently live here.
5. `docs/product-specs/tui-visual-screen-deck.md`: high risk because it currently mixes valuable visual truth with stale implementation specifics.

Validation commands that matter throughout this plan:

1. `npm run check:types`
2. `npm run check:schemas`
3. `npm run test:ui`
4. `npm run test:e2e:tui`
5. `npm run test:unit`
6. `npm run capture:tui`
7. merge gate suite from `AGENTS.md` before final closure

## Plan of Work
Ordering principle: reconcile contracts first, then harden the current runtime seams from the bottom up, then expand guards and validation where prior regressions escaped.

The work proceeds in five milestones:

1. freeze the revised runtime contract and remove stale implementation contradictions,
2. formalize view models, formatter contracts, and primitive fixtures,
3. harden runtime ownership seams and architecture guards,
4. expand edge-case validation and artifact checks,
5. close documentation and capture completion evidence.

## Milestones and Gates
### M0: Runtime contract and spec reconciliation
Outcome:

1. durable runtime architecture truth exists outside the ExecPlan,
2. stale or contradictory implementation guidance is reconciled,
3. contributors have one clear architectural model to follow.

Entry criteria:

1. current TUI architecture has been audited,
2. current product-spec docs are treated as user-facing truth.

Exit evidence:

1. `docs/TUI-RUNTIME.md` reflects the pure-render-function architecture rather than a layout-tree plan,
2. `docs/product-specs/tui-visual-screen-deck.md` no longer contradicts the runtime contract on implementation model,
3. doc references in `README.md`, `AGENTS.md`, and any TUI specs point at the right canonical sources.

Rollback boundary:

1. docs-only; no runtime behavior changes yet.

### M1: View-model and formatter hardening
Outcome:

1. Stage 1, Stage 2, and Stage 3 have explicit view-model contracts,
2. formatter contract supports plain/no-color fixture rendering,
3. render primitives have direct unit and fixture coverage.

Entry criteria:

1. M0 docs are checked in,
2. the pure-render-function model is frozen.

Exit evidence:

1. `StepFrame` remains explicit for Stage 1 and equivalent typed contracts exist for Stage 2 and Stage 3,
2. `fmt.ts` exposes a plain/no-color formatter path,
3. primitive fixture tests exist for representative render helpers,
4. one full-screen fixture exists for each major stage using the real render functions.

Rollback boundary:

1. view-model additions and formatter changes can be reverted independently of guard tests.

### M2: Runtime ownership and architecture guards
Outcome:

1. direct stdout and raw ANSI ownership are explicit and enforced,
2. width/context leaks in render primitives are removed,
3. Stage 1 and Stage 2/3 runtime seams are tighter and easier to reason about.

Entry criteria:

1. M1 contracts and fixtures are stable.

Exit evidence:

1. tests fail if feature modules write ANSI directly or call stdout directly outside approved seams,
2. `renderBrandBlock` and similar primitives no longer read terminal globals directly,
3. widget fallback rendering paths are either eliminated or explicitly documented and covered,
4. current PTY behavior remains unchanged at the product level.

Rollback boundary:

1. guard tests can be reverted separately only if the same commit explains the temporary exception.

### M3: Edge-case validation and artifact safety
Outcome:

1. runtime validation covers the edge cases that historically escaped,
2. receipt terminal rendering and `receipt.txt` artifact behavior remain clearly separated,
3. xterm-replayed rendered snapshots are part of the acceptance story.

Entry criteria:

1. M2 is stable,
2. runtime seams are explicit enough to test aggressively.

Exit evidence:

1. PTY or rendered tests cover minimum-supported and standard terminal sizes, including at least `60x18`, `60x24`, and `120x24`,
2. a short-terminal regression proves Stage 2 to Stage 3 handoff preserves required scrollback ordering,
3. tests explicitly verify that `receipt.txt` remains ANSI-free and structurally correct,
4. `npm run capture:tui` artifacts remain coherent with the hardened runtime.

Rollback boundary:

1. validation additions can be reverted independently, but only with an explicit statement of reopened risk.

### M4: Closeout and steady-state contributor contract
Outcome:

1. the runtime layer is observable, testable, and contributor-ready,
2. the docs reflect the hardened steady state,
3. this plan records what changed and what remains intentionally out of scope.

Entry criteria:

1. M3 is complete,
2. no known product-surface regressions remain.

Exit evidence:

1. full merge-gate suite passes,
2. `README.md`, `AGENTS.md`, `docs/DESIGN.md`, `docs/TUI-RUNTIME.md`, and relevant product-spec docs are in sync,
3. this plan's `Outcomes & Retrospective` records delivered architecture and residual risks truthfully.

Rollback boundary:

1. none; this is the new baseline.

## Concrete Steps
From `/Users/darylkang/Developer/arbiter`.

M0:

1. revise `docs/TUI-RUNTIME.md` to codify the pure-render-function architecture,
2. reconcile stale implementation details in `docs/product-specs/tui-visual-screen-deck.md`,
3. remove stale doc references such as outdated ExecPlan links in TUI product specs,
4. ensure `README.md` and `AGENTS.md` route TUI runtime work through the revised doc set.

M1:

1. add a plain/no-color formatter path in `src/ui/fmt.ts`,
2. add explicit `DashboardVM` and `ReceiptVM` contracts near the current runtime seams,
3. fix render primitives that read terminal globals directly by passing width/context explicitly,
4. add primitive fixture tests using the plain formatter,
5. add full-screen fixture tests for representative Stage 1, Stage 2, and Stage 3 compositions,
6. run `npm run test:unit`, `npm run test:e2e:tui`, `npm run capture:tui`.

M2:

1. add guard tests for direct stdout writes outside approved seams,
2. add guard tests for raw ANSI sequences outside approved seams,
3. narrow or document widget fallback paths in `controls.ts`,
4. consolidate any remaining render ownership leaks into frame/runtime seams,
5. rerun `npm run test:ui`, `npm run test:e2e:tui`, `npm run test:unit`, `npm run capture:tui`.

M3:

1. add explicit terminal-dimension regressions for minimum-supported and standard sizes,
2. add receipt ANSI-free artifact validation alongside TTY receipt checks,
3. add or expand short-terminal scrollback-preservation regressions,
4. verify xterm-replayed rendered snapshots remain coherent with runtime truth,
5. rerun `npm run test:ui`, `npm run test:e2e:tui`, `npm run test:unit`, `npm run capture:tui`.

M4:

1. run the merge-gate suite from `AGENTS.md`,
2. review rendered snapshot output under the capture workflow,
3. update plan retrospective and close status to `completed`,
4. commit closure docs if they changed during implementation.

## Validation and Acceptance
Behavioral acceptance criteria:

1. wizard, dashboard, and receipt still satisfy `docs/product-specs/tui-wizard.md`, `docs/product-specs/tui-copy-deck.md`, and `docs/product-specs/tui-visual-screen-deck.md` from the user's perspective,
2. Stage 1, Stage 2, and Stage 3 are rendered through typed view models and pure render primitives rather than controller-level ad hoc screen assembly,
3. direct ANSI and stdout rendering is confined to approved runtime seams,
4. deterministic structural review comes from the real ANSI output plus xterm replay and from plain-formatter fixture tests,
5. terminal cleanup, resize, unsupported-size behavior, scrollback preservation, and receipt artifact behavior remain correct.

Required validation commands during implementation milestones:

1. `npm run test:unit`
2. `npm run test:ui`
3. `npm run test:e2e:tui`
4. `npm run capture:tui`

Required completion validation before truthful closure:

1. `npm run check:types`
2. `npm run check:schemas`
3. `npm run test:mock-run`
4. `npm run test:templates`
5. `npm run test:verify`
6. `npm run test:debate`
7. `npm run test:clustering`
8. `npm run test:embeddings`
9. `npm run test:pack`
10. `npm run test:ui`
11. `npm run test:e2e:tui`
12. `npm run test:cli-contracts`
13. `npm run test:unit`
14. `npm run capture:tui`

Fail-before/pass-after evidence expected from this hardening plan:

1. at least one guard test that would fail if a feature module emits direct ANSI after hardening,
2. at least one fixture test that would fail if plain-formatter output diverges from the intended structural screen contract,
3. at least one Stage 2 short-terminal regression proving scrollback-preserving handoff remains correct,
4. at least one test that would fail if `receipt.txt` accidentally gained ANSI output.

Residual gaps that would block truthful completion:

1. any feature module still writing ANSI or stdout directly outside approved seams without an explicit documented exception,
2. missing view-model contracts for Stage 2 or Stage 3,
3. inability to generate deterministic fixture output from the actual render functions,
4. unresolved contradiction between the runtime contract and screen-deck implementation guidance.

## Idempotence and Recovery
This hardening plan must remain resumable and reversible.

1. Each milestone must leave the repo in a runnable state.
2. Each milestone should be commit-bounded by contract or guard layer.
3. Pure render functions remain the core rendering model throughout the plan, so there is no competing rendering architecture to reconcile later.
4. If a guard or validation addition proves too strict, relax it only in the same commit that records the temporary exception and rationale.
5. Capture output under `output/` remains disposable and must not be treated as durable truth.

## Interfaces and Dependencies
Primary code surfaces this plan expects to touch:

1. `src/ui/fmt.ts`
2. `src/ui/wizard-theme.ts`
3. `src/ui/wizard/frame-manager.ts`
4. `src/ui/wizard/controls.ts`
5. `src/ui/wizard/steps.ts`
6. `src/ui/wizard/types.ts`
7. `src/ui/run-lifecycle-hooks.ts`
8. `scripts/tui-visual-capture.mjs`
9. `test/e2e/tui-pty.test.mjs`
10. `test/e2e/tui-visual-capture.test.mjs`
11. new unit and fixture tests for formatter and render primitives

Dependencies and constraints:

1. engine event semantics remain governed outside this plan,
2. product specs remain the human-facing source of truth,
3. build-backed TUI commands must continue running serially,
4. avoid new dependencies unless they solve a problem the current pure-render-function architecture cannot solve.

## Handoffs and Ownership
This work is multi-round and may involve multiple agents, but it should not fragment into competing runtime architectures.

Ownership boundaries:

1. one runtime owner per milestone should own formatter and render-primitives changes for that milestone,
2. other agents may change product-spec or visual docs only if they do not reintroduce a conflicting architectural model,
3. engine-event semantics are outside this plan unless a separate approved plan changes them.

Required handoff contents after each milestone:

1. what contract or seam was hardened,
2. which files now rely on the hardened contract,
3. which explicit exceptions or fallback paths remain,
4. which validation commands were run,
5. what residual risk remains,
6. what next milestone should do.

Do not hand off a milestone as complete unless the milestone exit evidence is present.

## Artifacts and Notes
Expected durable artifacts from this plan:

1. `docs/TUI-RUNTIME.md`
2. stronger type contracts in current runtime modules,
3. fixture tests that make the runtime inspectable without PTY execution,
4. updated contributor guidance in `README.md` and `AGENTS.md`

Expected disposable artifacts during execution:

1. timestamped capture output under `output/playwright/tui-visual/`
2. local inspection notes produced while comparing fixture output and xterm-replayed snapshots

## Plan Change Notes
- 2026-03-06 15:05Z: initial plan drafted to build an Arbiter-specific internal TUI runtime layer with view models, layout nodes, dual render backends, and centralized runtime ownership.
- 2026-03-06 15:24Z: M0 durable docs landed in `docs/TUI-RUNTIME.md` and canonical references were updated in `docs/DESIGN.md`, `README.md`, and `AGENTS.md`.
- 2026-03-06 16:03Z: plan revised after architecture review to keep pure render functions, drop layout-tree and dual-backend migration, and focus on view-model, formatter, and guard hardening.
- 2026-03-06 16:12Z: reconciled `tui-copy-deck.md` and `tui-visual-screen-deck.md` with the revised runtime contract and removed stale implementation-guide contradictions.
