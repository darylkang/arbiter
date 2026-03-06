# Build Arbiter's Internal TUI Runtime Layer

This ExecPlan is a living document and must be updated as work proceeds.
This plan follows `docs/PLANS.md`.

## Purpose / Big Picture
Build an Arbiter-specific TUI runtime layer with framework-level engineering rigor for Arbiter's actual product shape: Stage 1 wizard, Stage 2 monitor, and Stage 3 receipt.

This is not a cosmetic cleanup and not a general-purpose terminal framework project.
It is a structural migration from today's string-oriented custom renderer to a runtime with:

1. typed screen state and view models,
2. a small declarative layout tree,
3. backend renderers for ANSI runtime and deterministic text snapshots,
4. centralized terminal lifecycle ownership,
5. framework-grade validation and architecture guards.

Primary operator-visible outcomes:

1. TUI changes are implemented by changing view models and layout primitives rather than ad hoc string assembly.
2. The same screen definition can be rendered both to the live terminal and to deterministic rendered-text fixtures.
3. Wizard, dashboard, and receipt share one runtime vocabulary and one ownership model for cursor, alt-screen, redraw, and teardown.
4. Contributors can extend the TUI without reverse-engineering low-level ANSI behavior.

## Scope Guardrails
In scope:

1. internal TUI runtime architecture for Stage 1, Stage 2, Stage 3, and supported fallback surfaces,
2. new view-model contracts and layout-node contracts,
3. ANSI and text render backends,
4. migration of current wizard/dashboard/receipt rendering onto the runtime layer,
5. runtime ownership of terminal lifecycle and frame policy,
6. architecture guards and validation expansion needed to make the runtime enforceable,
7. durable documentation updates in `docs/TUI-RUNTIME.md`, `docs/DESIGN.md`, `README.md`, and relevant product-spec docs when runtime-visible constraints change.

Out of scope:

1. changing engine semantics, event truth, stopping logic, or artifact contracts,
2. changing human-facing wizard behavior unless required by a runtime-safety migration and documented in the governing product spec,
3. inventing a reusable library for other repositories,
4. transcript/chat UX, plugin surfaces, or mouse-primary interaction,
5. framework migration to Ink or another third-party TUI stack in this plan.

Sequencing constraints:

1. preserve current user-facing behavior while the runtime layer is introduced underneath it,
2. maintain temporary coexistence between legacy string rendering and new runtime rendering only at explicit milestone boundaries,
3. land architecture guards only after the new runtime seams exist, otherwise they will block valid intermediate states,
4. keep build-backed TUI validation commands serial, not parallel.

Temporary coexistence rules:

1. legacy string composition may remain only behind adapters that are named and tracked in this plan,
2. once a screen family is migrated to layout nodes, no new string-assembly call sites may be added for that family,
3. renderer backends must accept layout nodes before any screen family is considered migrated.

## Progress
- [x] (2026-03-06 15:05Z) plan drafted from current TUI architecture audit and runtime-versus-Ink decision analysis (`proposed`)
- [x] (2026-03-06 15:24Z) runtime contract freeze completed in durable docs and canonical references (`in_progress`)
- [ ] render-tree and backend interfaces landed behind adapters
- [ ] Stage 1 migrated to view-model and layout-tree rendering
- [ ] Stage 2 migrated to view-model and layout-tree rendering
- [ ] Stage 3 migrated to view-model and layout-tree rendering
- [ ] legacy string-paths removed and architecture guards enabled
- [ ] validation matrix expanded and completion evidence captured (`completed`)

## Surprises & Discoveries
- Observation: Arbiter's current TUI stack is already structured enough that a disciplined internal runtime layer is cheaper than an Ink rewrite.
  Evidence: `src/ui/wizard/frame-manager.ts`, `src/ui/wizard/steps.ts`, `src/ui/wizard/controls.ts`, `src/ui/wizard-theme.ts`, `src/ui/run-lifecycle-hooks.ts`.
- Observation: the biggest remaining rigor gap is not terminal control alone; it is the lack of a declarative render/view-model layer.
  Evidence: controllers and render helpers still primarily exchange arrays of strings rather than typed screen trees.
- Observation: prior architecture reviews overrated the foundation because validation overfit the 120x40 happy path.
  Evidence: later audit findings uncovered 24-row and sub-60-column defects despite earlier strong scores.
- Observation: the repo now has enough rendered-validation infrastructure to support framework-grade migration discipline if the runtime exposes deterministic text rendering from the same screen definition.
  Evidence: `scripts/tui-visual-capture.mjs`, `scripts/tui-terminal-viewer.html`, `test/e2e/tui-visual-capture.test.mjs`.

## Decision Log
- Decision: do not migrate Arbiter to Ink in this plan.
  Rationale: the product shape is still wizard -> monitor -> receipt, and the migration cost is high relative to the benefit if we can impose framework-grade rigor on a narrower custom runtime.
  Date/Author: 2026-03-06, Codex planning round.
- Decision: introduce a small declarative layout tree rather than a React-like component system.
  Rationale: Arbiter needs rigorous authored terminal composition, not arbitrary general-purpose component composition.
  Date/Author: 2026-03-06, Codex planning round.
- Decision: require dual renderer backends from the same layout tree: ANSI runtime and deterministic text.
  Rationale: this is the shortest path to live rendering plus deterministic snapshot tests without duplicating screen logic.
  Date/Author: 2026-03-06, Codex planning round.
- Decision: keep runtime ownership of terminal lifecycle centralized and narrow.
  Rationale: the main source of historic TUI bugs has been smeared ownership of cursor, redraw, and scrollback boundaries.
  Date/Author: 2026-03-06, Codex planning round.

## Context and Orientation
Reviewed before drafting this plan:

1. `AGENTS.md` for repository invariants, validation expectations, and TUI workflow rules.
2. `README.md` for current operator and visual-validation workflow guidance.
3. `docs/DESIGN.md` for CLI and stage-model semantics plus artifact/scrollback constraints.
4. `docs/PLANS.md` and `docs/exec-plans/README.md` for ExecPlan structure and lifecycle contract.
5. `docs/product-specs/tui-wizard.md` for behavior semantics and stacked run-path contract.
6. `docs/product-specs/tui-copy-deck.md` for locked copy and fallback wording.
7. `docs/product-specs/tui-visual-screen-deck.md` for exact visual grammar and current runtime assumptions.
8. `src/ui/wizard/app.ts` for the current orchestration boundary.
9. `src/ui/wizard/frame-manager.ts` for current frame ownership.
10. `src/ui/wizard/controls.ts` for widget and raw-key ownership.
11. `src/ui/wizard/steps.ts` for typed step outcomes and controller seam.
12. `src/ui/wizard/resources.ts`, `src/ui/wizard/draft.ts`, `src/ui/wizard/flows.ts`, `src/ui/wizard/types.ts` for current data and presentation seams.
13. `src/ui/wizard-theme.ts` for current string-returning layout primitives.
14. `src/ui/run-lifecycle-hooks.ts` for Stage 2 and Stage 3 runtime rendering and terminal handoff.
15. `src/ui/tui-constraints.ts` for current support boundaries.
16. `scripts/tui-visual-capture.mjs`, `scripts/tui-terminal-viewer.html`, and `test/e2e/tui-visual-capture.test.mjs` for current visual-validation infrastructure.

Non-obvious terms used in this plan:

1. View model: typed renderer-facing screen data that already contains display-ready summaries and emphasis state.
2. Layout tree: a small declarative screen structure composed from Arbiter-specific node families such as rail, ruled section, key-value list, choice list, progress bar, worker table, and footer.
3. Backend renderer: a target-specific renderer that consumes the same layout tree and emits either ANSI terminal output or deterministic plain text.
4. Runtime seam: code allowed to own terminal mode, cursor, alternate screen, redraw policy, and direct stdout writes.
5. Architecture guard: an automated test that prevents bypassing the intended renderer/runtime boundaries.

Entry points and high-risk components:

1. `src/ui/wizard/app.ts`: high risk because it is the top-level entry for wizard lifecycle and will need to pivot from `StepFrame` string composition toward layout-tree rendering.
2. `src/ui/wizard/frame-manager.ts`: high risk because it owns cursor and alt-screen semantics and must not regress cleanup or resize handling during migration.
3. `src/ui/run-lifecycle-hooks.ts`: high risk because Stage 2 and Stage 3 redraw correctness and scrollback preservation are already historically fragile.
4. `src/ui/wizard-theme.ts`: high risk because it is the natural migration seam from string helpers to layout primitives and backends.
5. `test/e2e/tui-pty.test.mjs` and `test/e2e/tui-visual-capture.test.mjs`: high risk because they must continue validating the product surface while the internal render path changes.

Validation commands that matter throughout this plan:

1. `npm run check:types`
2. `npm run check:schemas`
3. `npm run test:ui`
4. `npm run test:e2e:tui`
5. `npm run test:unit`
6. `npm run capture:tui`
7. merge gate suite from `AGENTS.md` before final closure

## Plan of Work
Ordering principle: establish durable contracts first, then land the minimal runtime core, then migrate screen families in dependency order from most interactive to least interactive, then remove bypass paths and harden enforcement.

The work proceeds in seven milestones:

1. freeze the runtime contract and migration boundaries,
2. land the runtime core and adapter seam,
3. migrate Stage 1 wizard rendering,
4. migrate Stage 2 monitor rendering,
5. migrate Stage 3 receipt rendering,
6. remove legacy paths and add architecture guards,
7. expand validation and close documentation.

## Milestones and Gates
### M0: Runtime contract freeze
Outcome:

1. durable runtime architecture truth exists outside the ExecPlan,
2. migration boundaries and coexistence rules are documented,
3. contributor routing for TUI runtime work is updated.

Entry criteria:

1. current TUI architecture has been audited,
2. current product-spec docs are treated as user-facing truth.

Exit evidence:

1. `docs/TUI-RUNTIME.md` exists and is coherent with `docs/DESIGN.md`, `README.md`, and `AGENTS.md`,
2. this plan references exact migration seams and milestones without hand-wavy future intent,
3. no lasting runtime design truth remains only in the ExecPlan.

Rollback boundary:

1. docs-only; no runtime behavior changes yet.

### M1: Runtime core and adapter seam
Outcome:

1. typed layout-node and renderer-backend interfaces exist,
2. ANSI and text render backends exist behind a narrow surface,
3. adapters allow old `StepFrame`/dashboard data to render through the new backend without full migration.

Entry criteria:

1. M0 docs are checked in,
2. the node vocabulary and backend responsibilities are frozen enough to code against.

Exit evidence:

1. new runtime modules exist under a dedicated namespace,
2. one canonical fixture proves the same layout tree renders to both ANSI and text output,
3. existing UI behavior remains unchanged in PTY tests and capture output,
4. no direct call sites outside approved seams depend on backend internals.

Rollback boundary:

1. runtime core can be reverted without undoing product-spec truth.

### M2: Stage 1 migration
Outcome:

1. onboarding, editable steps, and review render through view models and layout nodes,
2. `StepFrame` string assembly is no longer the Stage 1 rendering contract,
3. raw-key widgets render through runtime primitives rather than bespoke line arrays.

Entry criteria:

1. M1 runtime core is landed and stable,
2. product-spec behavior for Stage 1 is frozen.

Exit evidence:

1. Stage 1 PTY tests pass unchanged at the product level,
2. rendered snapshot fixtures exist for representative Stage 1 screens,
3. controllers no longer return or depend on screen-wide string arrays for migrated screens,
4. unsupported-terminal behavior still works correctly.

Rollback boundary:

1. Stage 1 migration can be reverted without touching Stage 2 and Stage 3.

### M3: Stage 2 migration
Outcome:

1. dashboard rendering is driven by `DashboardVM` plus layout nodes,
2. redraw math and live-region ownership live behind the renderer/runtime seam,
3. text-render snapshots for the dashboard come from the same layout tree as ANSI output.

Entry criteria:

1. M2 is stable,
2. dashboard semantics are unchanged and still truthful to engine events.

Exit evidence:

1. 24-row and standard-height regressions pass,
2. one fixture proves the Stage 2 layout tree renders structurally the same in ANSI and text backends,
3. dashboard live-region redraw logic no longer depends on ad hoc string assembly in feature code.

Rollback boundary:

1. Stage 2 migration can be reverted independently of Stage 1 and Stage 3.

### M4: Stage 3 migration
Outcome:

1. receipt rendering is driven by `ReceiptVM` plus layout nodes,
2. the same runtime vocabulary covers receipt sections and terminal teardown,
3. Stage 2 to Stage 3 handoff remains scrollback-safe.

Entry criteria:

1. M3 is stable,
2. Stage 2 final snapshot and receipt semantics remain governed by current product specs.

Exit evidence:

1. full scrollback capture shows frozen Stage 1 summary, Stage 2 final snapshot, and Stage 3 receipt in the correct order,
2. receipt fixtures render identically in text backend and runtime structure,
3. `receipt.txt` artifact generation remains untouched and ANSI-free.

Rollback boundary:

1. Stage 3 migration can be reverted independently while leaving runtime core and earlier stages intact.

### M5: Legacy path removal and guards
Outcome:

1. string-based screen rendering bypasses are removed for migrated screens,
2. architecture guards enforce renderer/runtime monopoly over ANSI output,
3. contributors have one obvious path for new TUI work.

Entry criteria:

1. Stage 1 through Stage 3 are running through the new runtime layer.

Exit evidence:

1. tests fail if feature modules write ANSI directly or call stdout directly outside approved seams,
2. legacy adapters and dead helpers are removed or explicitly retained only for unmigrated fallbacks,
3. product behavior remains unchanged under PTY and rendered-capture validation.

Rollback boundary:

1. guards can be relaxed temporarily only in the same commit that explains why.

### M6: Validation expansion and closeout
Outcome:

1. the runtime layer is observable, testable, and contributor-ready,
2. validation matrix covers the edge cases that historically escaped,
3. docs and plan closure reflect the new steady state.

Entry criteria:

1. M5 is complete,
2. no known product-surface regressions remain.

Exit evidence:

1. full merge-gate suite passes,
2. TUI capture workflow produces deterministic text snapshots from the new runtime path,
3. `README.md`, `AGENTS.md`, `docs/DESIGN.md`, `docs/TUI-RUNTIME.md`, and relevant product-spec docs are in sync,
4. this plan's `Outcomes & Retrospective` records delivered architecture and residual risks truthfully.

Rollback boundary:

1. none; this is the new baseline.

## Concrete Steps
From `/Users/darylkang/Developer/arbiter`.

M0:

1. create `docs/TUI-RUNTIME.md` with layer model, renderer contracts, and migration rules,
2. update `docs/DESIGN.md` to point TUI runtime architecture work at `docs/TUI-RUNTIME.md`,
3. update `README.md` documentation pointers,
4. update `AGENTS.md` authority and orientation text for TUI runtime work.

M1:

1. introduce a dedicated runtime namespace, likely under `src/ui/runtime/`,
2. add layout-node type definitions,
3. add backend renderer interfaces,
4. add ANSI backend and text backend with at least one shared fixture,
5. add adapter(s) from current Stage 1 or Stage 2 data structures into layout nodes,
6. run `npm run test:unit`, `npm run test:e2e:tui`, `npm run capture:tui`.

M2:

1. replace `StepFrame`-driven Stage 1 screen composition with view models and layout-tree rendering,
2. migrate controls to return typed widget outcomes instead of screen-line fragments,
3. add Stage 1 fixture tests for representative screens,
4. rerun `npm run test:ui`, `npm run test:e2e:tui`, `npm run capture:tui`.

M3:

1. introduce `DashboardVM`,
2. migrate Stage 2 ruled sections, worker table, and footer to layout nodes,
3. move line-budget and redraw math behind runtime/backend seams,
4. add Stage 2 fixture and short-terminal regressions,
5. rerun `npm run test:ui`, `npm run test:e2e:tui`, `npm run capture:tui`.

M4:

1. introduce `ReceiptVM`,
2. migrate Stage 3 receipt sections and teardown path to layout nodes,
3. verify Stage 2-to-Stage 3 scrollback preservation on standard and short terminals,
4. rerun `npm run test:ui`, `npm run test:e2e:tui`, `npm run capture:tui`.

M5:

1. remove legacy string-render helpers no longer used,
2. add or expand tests that forbid direct ANSI writes and direct stdout writes outside approved seams,
3. clean dead adapters,
4. run `npm run test:unit`, `npm run test:e2e:tui`, `npm run capture:tui`, and any new guard tests.

M6:

1. run the merge-gate suite from `AGENTS.md`,
2. review rendered snapshot output under the capture workflow,
3. update plan retrospective and close status to `completed`,
4. commit closure docs if they changed during implementation.

## Validation and Acceptance
Behavioral acceptance criteria:

1. wizard, dashboard, and receipt still satisfy `docs/product-specs/tui-wizard.md`, `docs/product-specs/tui-copy-deck.md`, and `docs/product-specs/tui-visual-screen-deck.md` from the user's perspective,
2. migrated screens render from typed view models and layout nodes rather than ad hoc screen-wide string assembly,
3. the same screen definition can be rendered both to live ANSI output and deterministic text snapshots,
4. direct ANSI and stdout rendering is confined to approved runtime seams,
5. terminal cleanup, resize, unsupported-size behavior, and scrollback preservation remain correct.

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

Fail-before/pass-after evidence expected from this migration:

1. at least one fixture test that would fail if ANSI and text backends structurally diverge,
2. at least one architecture guard that fails if a feature module emits direct ANSI after migration,
3. at least one Stage 2 short-terminal regression proving scrollback-preserving handoff remains correct.

Residual gaps that would block truthful completion:

1. any migrated screen family still depending on ad hoc screen-wide string assembly,
2. any direct stdout/ANSI bypass in feature modules outside approved seams,
3. inability to produce deterministic text snapshots from the same screen definition used for live rendering.

## Idempotence and Recovery
This migration must remain resumable and reversible.

1. Each milestone must leave the repo in a runnable state.
2. Each milestone should be commit-bounded by screen family or guard layer.
3. Legacy adapters may exist temporarily, but only while tracked explicitly in this plan.
4. If a milestone destabilizes the runtime, revert that milestone's commits without discarding earlier stable milestones.
5. Capture output under `output/` remains disposable and must not be treated as durable truth.
6. If renderer backends diverge during implementation, stop and fix the shared layout-node contract before proceeding to more screens.

## Interfaces and Dependencies
Primary code surfaces this plan expects to touch:

1. `src/ui/wizard/app.ts`
2. `src/ui/wizard/frame-manager.ts`
3. `src/ui/wizard/controls.ts`
4. `src/ui/wizard/steps.ts`
5. `src/ui/wizard/draft.ts`
6. `src/ui/wizard/resources.ts`
7. `src/ui/wizard-theme.ts`
8. `src/ui/run-lifecycle-hooks.ts`
9. new runtime modules under `src/ui/runtime/`
10. `scripts/tui-visual-capture.mjs`
11. `test/e2e/tui-pty.test.mjs`
12. `test/e2e/tui-visual-capture.test.mjs`
13. new unit and fixture tests for runtime nodes and renderer backends

Dependencies and constraints:

1. engine event semantics remain governed outside this plan,
2. product specs remain the human-facing source of truth,
3. build-backed TUI commands must continue running serially,
4. if a new dependency is proposed, justify it explicitly in the plan before adoption.

## Handoffs and Ownership
This work is explicitly multi-agent safe and likely multi-round.

Ownership boundaries:

1. one runtime owner per milestone should own render-tree and backend code for that milestone,
2. other agents may change product-spec or visual docs only if they do not invalidate the runtime migration boundary,
3. engine-event semantics are outside this plan unless a separate approved plan changes them.

Required handoff contents after each milestone:

1. what was migrated,
2. which files now depend on the new runtime layer,
3. which legacy adapters remain,
4. which validation commands were run,
5. what residual risk remains,
6. what next milestone should do.

Do not hand off a milestone as complete unless the milestone exit evidence is present.

## Artifacts and Notes
Expected durable artifacts from this plan:

1. `docs/TUI-RUNTIME.md`
2. runtime modules under `src/ui/runtime/`
3. fixture tests that make the runtime inspectable without PTY execution
4. updated contributor guidance in `README.md` and `AGENTS.md`

Expected disposable artifacts during execution:

1. timestamped capture output under `output/playwright/tui-visual/`
2. local inspection notes produced while comparing ANSI and text backend output

## Plan Change Notes
- 2026-03-06 15:05Z: initial plan drafted to build an Arbiter-specific internal TUI runtime layer with view models, layout nodes, dual render backends, and centralized runtime ownership.
- 2026-03-06 15:24Z: M0 durable docs landed in `docs/TUI-RUNTIME.md` and canonical references were updated in `docs/DESIGN.md`, `README.md`, and `AGENTS.md`.
