# Re-architect Arbiter's Testing System

This ExecPlan is a living document and must be updated as work proceeds.
This plan follows `docs/PLANS.md`.

## Purpose / Big Picture
Turn Arbiter's current strong-but-fragmented test collection into one coherent testing system with explicit layers, shared fixtures, named lanes, and clear invariant ownership.

This is not a "more tests" plan.
It is a testing-architecture plan whose goal is to make the suite:

1. minimal but high-signal,
2. risk-aligned rather than historically accumulated,
3. fast in the common local loop,
4. strong on the end-user TUI surface,
5. legible to future contributors and agents without oral tradition.

Primary operator-visible outcomes:

1. local contributors can answer "what should I run?" from a small set of named lanes rather than a long script list,
2. every critical invariant has one primary test owner and, at most, one deliberate shadow layer,
3. the TUI has a first-class render-validation story and a curated PTY end-to-end story,
4. release and publish confidence come from dedicated release-lane validation instead of incidental smoke coverage,
5. Arbiter gains a durable testing charter that explains the whole system from first principles.

## Scope Guardrails
In scope:

1. defining Arbiter's durable testing charter in a new canonical doc such as `docs/TESTING.md`,
2. introducing an explicit lane model for static checks, unit, integration, CLI, TUI render, TUI end-to-end, release, and live canary validation,
3. restructuring test entrypoints in `package.json` so the named lanes match the architecture,
4. migrating test-only smoke scripts out of `scripts/` and into an explicit `test/` hierarchy where practical,
5. moving fast deterministic tests off build-backed `dist/` imports where practical,
6. introducing a shared scenario-matrix and fixture vocabulary across test layers,
7. tightening the TUI testing model so render-layout checks, PTY behavior checks, and visual review artifacts each have a clear role,
8. removing or consolidating redundant tests only after a replacement lane clearly owns the same invariant,
9. updating `AGENTS.md`, `README.md`, and other canonical docs so the testing system is fully documented and operationally coherent.

Out of scope:

1. changing engine semantics, stop semantics, protocol semantics, or artifact contracts except where a testing seam requires a non-semantic extraction,
2. migrating the TUI to Ink or any other UI framework,
3. adopting Jest, Vitest, Playwright browser E2E, or another general-purpose test framework unless the current Node-based approach proves insufficient,
4. rewriting the entire TUI runtime architecture in this plan,
5. choosing or binding to a specific CI provider; this plan defines repo-local lanes and artifacts first,
6. broadening live-provider coverage beyond a narrow canary lane.

Sequencing constraints:

1. define the testing charter and lane model before deleting or renaming existing test commands,
2. preserve current behavioral coverage while migrating tests into the new structure,
3. treat `docs/exec-plans/2026-03-06-build-internal-tui-runtime-layer.md` as the owner of runtime-seam hardening already in flight,
4. do not move TUI render tests ahead of the runtime plan's view-model and formatter seams if those seams are still unstable,
5. keep build-backed TUI commands serial throughout the migration.

Temporary coexistence rules:

1. legacy test scripts and new lane entrypoints may coexist while parity is being established,
2. build-backed tests may remain temporarily while source-level lanes are introduced,
3. `npm run capture:tui` remains an artifact-generation and review workflow, not a generic substitute for all automated TUI tests,
4. no redundant test is deleted until the plan records which new lane now owns its invariant.

## Progress
- [x] (2026-03-06 16:55Z) initial testing-system redesign plan drafted (`proposed`)
- [x] (2026-03-06 23:40Z) M0 testing charter, lane taxonomy, and invariant-owner matrix checked in (`in_progress`)
- [x] (2026-03-06 23:40Z) transitional named lane aliases landed in `package.json` without deleting the legacy command surface
- [x] (2026-03-07 02:55Z) fast source-level lane established and build-coupled unit tests reduced
- [x] (2026-03-07 02:55Z) integration, CLI, release, and canary lanes rationalized
- [x] (2026-03-07 02:55Z) TUI render lane formalized and PTY coverage narrowed to terminal-behavior ownership
- [x] (2026-03-07 02:55Z) redundant tests and script sprawl pruned with evidence-backed replacements
- [x] (2026-03-07 02:55Z) steady-state documentation and merge path finalized

## Surprises & Discoveries
- Observation: Arbiter's current suite is stronger than it first looks, but its structure is encoded in `package.json` and ad hoc script names rather than in a durable testing charter.
  Evidence: `package.json`, `scripts/*.mjs`, `test/unit/*.test.mjs`, `test/e2e/*.test.mjs`.
- Observation: there is no CI provider configuration currently checked into the repository, so test-system coherence must be achieved at the repo-local command and documentation layer first.
  Evidence: no `.github/` directory exists in the repository root.
- Observation: many unit tests still import `dist/*`, which makes the "unit" lane slower and more build-coupled than it should be.
  Evidence: `test/unit/event-bus-async.test.mjs`, `test/unit/planner.test.mjs`, `test/unit/run-lifecycle-hooks.test.mjs`.
- Observation: the new TUI render-fixture direction is already emerging under the internal runtime hardening work.
  Evidence: `test/unit/tui-runtime-fixtures.test.mjs`, `src/ui/runtime-view-models.ts`, `docs/TUI-RUNTIME.md`.
- Observation: the visual-capture pipeline is already the right backbone for end-user TUI review; the gap is its integration into a broader lane model, not the absence of a visual tool.
  Evidence: `scripts/tui-visual-capture.mjs`, `test/e2e/tui-visual-capture.test.mjs`, `README.md`.
- Observation: `scripts/tui-headless.mjs` tests a strict subset of what `scripts/cli-output-contracts.mjs` already covers.
  Evidence: both assert on no-arg help and root help output, while `scripts/cli-output-contracts.mjs` additionally covers `init`, version, non-TTY routing, and missing-config failure paths.
- Observation: Node's native `--experimental-strip-types` is not sufficient for Arbiter's source tree because `NodeNext` source imports use `.js` specifiers that do not resolve back to `.ts` automatically.
  Evidence: source-level imports of `src/planning/planner.ts` and `src/ui/run-lifecycle-hooks.ts` fail without a loader; `tsx` resolves the source tree correctly.

## Decision Log
- Decision: keep `node:test` and `node:assert/strict` as Arbiter's primary test runner and assertion framework.
  Rationale: the main weakness is taxonomy and architecture, not the runner itself; preserving the current runner avoids migration noise while still allowing a disciplined lane model.
  Date/Author: 2026-03-06, Codex planning round.
- Decision: use a TypeScript loader only as needed to enable source-level tests, not as a new testing framework.
  Rationale: source-level testing matters for fast lanes, but Jest/Vitest-style framework migration is unnecessary unless the current runtime proves insufficient.
  Date/Author: 2026-03-06, Codex planning round.
- Decision: treat `capture:tui` as a review-artifact workflow and acceptance aid, not as a blanket merge-gate command for every change.
  Rationale: it is high-value for TUI changes, but it should remain a scoped tool rather than inflating every test run.
  Date/Author: 2026-03-06, Codex planning round.
- Decision: the testing system will be organized around invariant ownership, not around current script names.
  Rationale: this is the only reliable way to remove redundancy without losing coverage.
  Date/Author: 2026-03-06, Codex planning round.

## Context and Orientation
Reviewed before writing this plan:

1. `AGENTS.md` for repository invariants, validation policy, and TUI workflow rules.
2. `docs/PLANS.md` and `docs/exec-plans/README.md` for ExecPlan contract and directory conventions.
3. `docs/DESIGN.md` for product model, CLI semantics, artifact semantics, and reproducibility invariants.
4. `docs/TUI-RUNTIME.md` for the runtime-layer testing contract and renderer ownership model.
5. `docs/exec-plans/2026-03-06-build-internal-tui-runtime-layer.md` for the TUI runtime hardening already in flight.
6. `README.md` for the existing operator-facing TUI capture workflow.
7. `package.json` for the current test command surface.
8. `scripts/architecture-guard.mjs` for static guard coverage.
9. `scripts/mock-run-smoke.mjs`, `scripts/verify-smoke.mjs`, `scripts/report-smoke.mjs`, `scripts/cli-output-contracts.mjs`, `scripts/tui-intent.mjs`, and `scripts/tui-headless.mjs` for the current implicit integration and CLI contract layers.
10. `test/unit/*.test.mjs` for current deterministic and fixture-style coverage.
11. `test/e2e/tui-pty.test.mjs` and `test/e2e/tui-visual-capture.test.mjs` for the current PTY and rendered-snapshot end-to-end layers.

Non-obvious terms used in this plan:

1. Lane: a named test command with a clear purpose and failure meaning.
2. Invariant owner: the primary test layer responsible for catching violations of a specific contract.
3. Shadow coverage: a second layer that incidentally or deliberately re-confirms a critical invariant without becoming its primary owner.
4. Source-level test: a test that imports from `src/*` rather than `dist/*`.
5. Render lane: deterministic screen/layout tests that use the real render functions without requiring a PTY.
6. Scenario matrix: a small fixed set of representative experiment and UI scenarios reused across layers.
7. Release lane: package/install/publish-surface checks that validate the shipped artifact rather than source behavior alone.

Current high-risk components for this plan:

1. `package.json` because the current lane taxonomy is encoded there and needs careful migration.
2. `scripts/` because it currently mixes true developer utilities with test-only smoke logic.
3. `test/unit/` because many files are build-backed and need a cleaner boundary.
4. `test/e2e/` because PTY tests should remain curated, not become the default owner of layout semantics.
5. `scripts/tui-visual-capture.mjs` because it is both a review workflow and a reusable testing primitive.
6. `docs/TUI-RUNTIME.md` and the active TUI runtime plan because the render-lane architecture depends on their seams stabilizing.

## Plan of Work
Ordering principle: define the testing charter and ownership model first, then make the fast path genuinely fast, then group the slower system tests into explicit lanes, then formalize the TUI render/visual model, and only then remove redundant tests and legacy script sprawl.

The target testing architecture is:

1. `test:static`
   - type, schema, and guard checks.
2. `test:unit`
   - fast deterministic source-level logic and render-fixture tests.
3. `test:integration`
   - subsystem and mock-run tests that validate artifacts and cross-module behavior.
4. `test:cli`
   - command-surface and non-TTY routing contracts.
5. `test:tui:render`
   - deterministic screen-contract tests for wizard, dashboard, receipt, and dimension variants.
6. `test:tui:e2e`
   - curated PTY tests for terminal lifecycle, key handling, resize behavior, stage transitions, and scrollback.
7. `test:release`
   - pack/install/bin validation.
8. `test:canary`
   - live/provider smoke and provenance checks when credentials exist.
9. `test:fast`
   - local developer confidence lane composed from static plus the fastest deterministic tests.
10. `test:merge`
   - standard pre-merge suite composed from the required non-live lanes.

`capture:tui` remains outside the numbered lanes as a review-artifact workflow used for TUI changes and failure inspection.

Target composed lanes:

1. `test:fast` = `test:static` + source-level `test:unit`
   - no full build step,
   - target local duration under 10 seconds on a warm workspace,
   - purpose: default developer confidence lane during active implementation.
2. `test:merge` = `test:static` + `test:unit` + `test:integration` + `test:cli` + `test:tui:render` + `test:tui:e2e` + `test:release`
   - excludes `test:canary`,
   - purpose: canonical non-live pre-merge gate.

Current M0 note:

1. `test:static`, `test:integration`, `test:cli`, `test:tui:render`, `test:tui:e2e`, `test:release`, `test:canary`, and `test:merge` may land first as non-destructive aliases over the current script surface.
2. `test:fast` should not be added until it is genuinely source-level and mostly no-build.

This plan should leave Arbiter with one unifying framework:

1. one primary runner family (`node:test`),
2. one directory model under `test/`,
3. one scenario matrix,
4. one coverage-ownership map,
5. a small number of named commands whose purpose is obvious.

## Milestones and Gates
### M0: Testing charter and coverage map
Outcome:

1. Arbiter has one durable testing-system document,
2. the lane model is explicit,
3. every major invariant has a primary owner,
4. deletions and consolidations are planned from evidence, not intuition.

Entry criteria:

1. current test surface has been audited,
2. current runtime and product docs have been reviewed.

Exit evidence:

1. `docs/TESTING.md` (or an equivalent canonical testing charter) exists and defines lane semantics, scenario matrix, invariant ownership, and command taxonomy,
2. current commands in `package.json` are mapped to the target lanes,
3. candidate redundant tests and scripts are listed with the invariant they currently own,
4. the exact intended composition of `test:fast` and `test:merge` is documented,
5. `AGENTS.md` and `README.md` point to the canonical testing doc rather than carrying partial testing doctrine alone.

Rollback boundary:

1. docs-only plus non-destructive script alias additions.

### M1: Fast-path foundation and source-level unit lane
Outcome:

1. fast tests are genuinely fast and do not rebuild `dist` unnecessarily,
2. deterministic logic and pure render fixtures primarily test source modules, not built output,
3. shared helpers and fixtures reduce test duplication.

Entry criteria:

1. M0 testing charter is checked in,
2. the chosen source-level test-loader approach is explicit.

Exit evidence:

1. `test:fast` exists and does not invoke the full build,
2. `test:unit` or a new source-level equivalent imports from `src/*` for the intended fast-path cases,
3. shared helpers and scenario fixtures exist under `test/helpers/` or `test/fixtures/`,
4. at least planner, event bus, formatter, and representative render-fixture tests are running against source-level seams,
5. remaining build-backed "unit" tests are either migrated or intentionally reclassified.

Rollback boundary:

1. the new source-level lane can coexist with the current build-backed lane until parity is proven.

### M2: Integration, CLI, and release lane rationalization
Outcome:

1. test-only smoke logic is no longer scattered arbitrarily under `scripts/`,
2. integration and CLI contracts are expressed through explicit test directories and commands,
3. release/package checks have a dedicated owner lane.

Entry criteria:

1. M1 fast lane is stable,
2. current smoke scripts have been classified as utility, integration, CLI, release, or live canary.

Exit evidence:

1. test-only scripts such as `scripts/mock-run-smoke.mjs`, `scripts/verify-smoke.mjs`, `scripts/report-smoke.mjs`, and `scripts/cli-output-contracts.mjs` are either migrated into `test/integration/`, `test/cli/`, or `test/release/`, or explicitly retained with rationale,
2. `test:integration`, `test:cli`, and `test:release` exist and have clear contracts,
3. each migrated test has access to shared scenario fixtures instead of ad hoc temp-config construction where reasonable,
4. package/install validation remains green through the dedicated release lane.

Rollback boundary:

1. legacy npm aliases remain until the new lanes have passed at least one full merge-gate run.

### M3: TUI render lane and visual-review architecture
Outcome:

1. the TUI has a dedicated render-contract lane separate from PTY end-to-end tests,
2. PTY tests are reserved for terminal behavior and interaction semantics,
3. visual artifact generation is machine-readable and easier to inspect.

Entry criteria:

1. the runtime-layer plan has stabilized the relevant render seams enough for fixture ownership,
2. M1 shared fixtures and helpers exist.

Exit evidence:

1. `test:tui:render` exists and owns layout/content contracts for Stage 0 through Stage 3 using real render functions,
2. `test:tui:e2e` is narrowed to PTY-only concerns such as resize behavior, escape/back handling, stage handoff ordering, scrollback, and terminal cleanup,
3. `capture:tui` emits structured metadata such as an `index.json` or equivalent machine-readable manifest in addition to human-readable output,
4. the render lane covers at least one standard width, one minimum-supported width, and one short-terminal path,
5. failure and warning states have at least curated fixture coverage where they are user-visible.

Rollback boundary:

1. render-lane additions can ship before PTY reductions, but PTY assertions should not be removed until the render lane proves coverage.

### M4: Merge path, redundancy pruning, and steady-state documentation
Outcome:

1. Arbiter's merge path is a small set of named commands,
2. redundant or arbitrary tests are removed with evidence,
3. contributors and agents have one coherent mental model for the suite.

Entry criteria:

1. M2 and M3 lanes are stable,
2. the invariant-owner map is current.

Exit evidence:

1. `test:merge` exists and is the canonical non-live merge gate,
2. `test:fast` exists and is the canonical local confidence lane,
3. obsolete aliases or redundant smoke scripts are removed or demoted to compatibility wrappers with a timed cleanup note,
4. `docs/TESTING.md`, `AGENTS.md`, `README.md`, `docs/DESIGN.md`, and `docs/TUI-RUNTIME.md` are consistent on testing responsibilities,
5. plan retrospective captures what was removed, what was added, and why the final system is lower-noise than before.

Rollback boundary:

1. command aliases should remain available long enough to back out naming churn if the new lanes prove confusing or incomplete.

## Concrete Steps
From `/Users/darylkang/Developer/arbiter`.

M0:

1. create `docs/TESTING.md` describing the lane model, scenario matrix, invariant-owner map, and the role of `capture:tui`,
2. inventory current commands in `package.json` and map each to `test:static`, `test:unit`, `test:integration`, `test:cli`, `test:tui:render`, `test:tui:e2e`, `test:release`, or `test:canary`,
3. define the exact intended composition of `test:fast` and `test:merge`,
4. list current `scripts/*.mjs` files as one of:
   - developer utility,
   - review artifact tool,
   - test-only smoke to migrate,
   - guard utility,
5. identify concrete pruning candidates where current scripts overlap materially,
6. update `AGENTS.md` and `README.md` so they point to the new testing charter and lane names.

M1:

1. choose the source-level test execution path; if needed, add a minimal loader dependency such as `tsx`,
2. introduce `test/helpers/` and `test/fixtures/` for shared scenario builders, temp-run helpers, artifact assertions, and TUI fixture builders,
3. migrate the fastest deterministic tests from `dist/*` imports toward `src/*` imports,
4. add `test:fast` and a source-level `test:unit` entrypoint that avoids `npm run build`,
5. keep a temporary compatibility lane for remaining build-backed tests until migration is complete.

M2:

1. create explicit directories such as `test/integration/`, `test/cli/`, and `test/release/`,
2. migrate test-only smoke scripts into those directories under the Node test runner where practical,
3. keep true developer utilities in `scripts/`, including `scripts/tui-visual-capture.mjs` and `scripts/tui-terminal-viewer.html`,
4. add package scripts for `test:integration`, `test:cli`, and `test:release`,
5. reduce script chaining in `package.json` so the lane names describe purpose rather than historical bundles.

M3:

1. define the render-lane contract against the stabilized runtime seams from `docs/TUI-RUNTIME.md`,
2. keep or expand plain/no-color formatter and view-model fixture coverage,
3. create `test:tui:render` for deterministic frame/layout validation,
4. move PTY tests toward true terminal-behavior assertions only,
5. extend `scripts/tui-visual-capture.mjs` to emit structured metadata if it does not already,
6. decide whether optional PNG screenshot export is worth the maintenance cost; if not, keep the HTML viewer plus rendered-text split as the canonical visual workflow.

M4:

1. add `test:merge` as the canonical non-live merge gate composed from the stable lanes,
2. add `test:canary` for live-provider smoke and provenance when credentials exist,
3. remove or alias-rewrite obsolete commands only after the invariant-owner map proves there is no coverage loss,
4. capture before/after timing, flake, and maintainability evidence in the plan retrospective,
5. update contributor docs and closure notes.

## Validation and Acceptance
Behavioral acceptance criteria:

1. Arbiter has a documented testing system whose lanes are explicit, ordered, and justified from first principles.
2. The default local confidence path is fast and mostly source-level.
3. Slower system tests are grouped by purpose, not by arbitrary script history.
4. The TUI has three clearly separated validation modes:
   - render-contract tests,
   - PTY end-to-end tests,
   - visual artifact capture and review.
5. Every critical invariant named in `AGENTS.md` has a primary lane owner and does not rely on accidental overlap alone.
6. Redundant tests are removed only when an equal-or-stronger replacement lane clearly exists.
7. Release/package confidence and live/provider confidence have dedicated lanes rather than piggybacking on unrelated suites.

Required validation during the migration:

1. keep the current merge-gate commands green while new lanes are introduced,
2. run old and new lane variants side by side where parity needs to be proven,
3. for TUI changes, continue using `npm run test:e2e:tui` and `npm run capture:tui` serially until the new lane structure fully replaces the old naming.

Required completion evidence before truthful closure:

1. `docs/TESTING.md` exists and is referenced from `README.md` and `AGENTS.md`,
2. `package.json` exposes the target lane model or a deliberate final approximation of it,
3. at least one representative source-level fast lane exists without a full build,
4. integration, CLI, release, and canary surfaces each have a named owner lane,
5. TUI render coverage exists separately from PTY end-to-end coverage,
6. an invariant-owner matrix has been recorded and used to justify removals,
7. the final `test:merge` command is materially simpler to reason about than the current merge checklist.

Fail-before/pass-after evidence expected from this plan:

1. current state: unit tests still require a build; target state: fast unit lane runs without a full build,
2. current state: many test-only smoke checks live under `scripts/`; target state: named test directories own them,
3. current state: TUI render and PTY ownership are partially entangled; target state: render lane owns layout/content while PTY owns terminal behavior,
4. current state: testing doctrine is spread across `AGENTS.md`, `README.md`, and script names; target state: one canonical testing charter exists.

Residual gaps that would block truthful completion:

1. if the runtime-layer seams remain too unstable to support a durable TUI render lane,
2. if `test:fast` still requires a full build for most deterministic tests,
3. if test-only smoke logic remains scattered in `scripts/` without a clear reason,
4. if lane names exist but invariant ownership is still ambiguous,
5. if `capture:tui` remains the only practical way to validate screen layout instead of a scoped review artifact layered on top of render tests.

## Idempotence and Recovery
This migration must remain reversible and interruption-safe.

1. Introduce new lanes before removing old aliases.
2. Keep legacy commands temporarily when they are still needed for parity comparison.
3. Record every deletion of a test or script alongside the new owner lane that replaces it.
4. If a source-level loader adds instability, keep the build-backed lane as fallback while narrowing its purpose explicitly.
5. Keep TUI visual artifacts disposable under `output/`; they are evidence for review, not canonical checked-in truth.
6. Prefer commit-bounded milestones so command-taxonomy churn, source-level test migration, TUI render-lane changes, and redundancy cleanup can be reverted separately if needed.

## Interfaces and Dependencies
Primary files this plan is expected to touch:

1. `package.json`
2. `docs/TESTING.md` (new)
3. `AGENTS.md`
4. `README.md`
5. `docs/TUI-RUNTIME.md`
6. `test/unit/`
7. `test/integration/` (new)
8. `test/cli/` (new)
9. `test/release/` (new)
10. `test/helpers/` and `test/fixtures/` (new)
11. `test/e2e/`
12. `scripts/tui-visual-capture.mjs`
13. `scripts/architecture-guard.mjs`

Expected dependencies and tool surfaces:

1. keep `node:test` and `node:assert/strict` as the primary test runner surface,
2. retain `@homebridge/node-pty-prebuilt-multiarch` for PTY E2E,
3. retain `@xterm/headless` for rendered terminal truth,
4. add a minimal TypeScript execution aid only if needed for source-level tests,
5. avoid adopting a second general-purpose test framework unless this plan uncovers a concrete blocker.

## Handoffs and Ownership
Role boundaries:

1. this plan owns testing taxonomy, lane design, fixture/scenario architecture, command restructuring, and redundancy cleanup,
2. `docs/exec-plans/2026-03-06-build-internal-tui-runtime-layer.md` owns the runtime-seam hardening already in progress,
3. runtime-seam extractions required only to make testing viable should be coordinated, not duplicated.

Required handoff artifacts before major pruning begins:

1. canonical testing charter draft,
2. invariant-owner matrix,
3. mapping from current commands/scripts to target lanes,
4. list of tests proposed for deletion or consolidation and the replacement owner lane for each.

Validation gate before pruning old tests:

1. new lane passes,
2. old lane or script still passes or is shown to be redundant,
3. parity evidence is recorded in the plan.

External review gate:

1. after this ExecPlan draft is reviewed locally, request an Opus review focused on:
   - lane taxonomy,
   - unnecessary versus missing coverage,
   - whether the TUI render/PTY split is correctly scoped,
   - whether the proposed minimal runner/tooling posture is sound.

Recommended next action after plan approval:

1. implement M0 first and do not start deleting or renaming tests until the charter and invariant-owner map are checked in.

## Artifacts and Notes
Initial migration map for current script surfaces:

1. likely retain as developer/review utilities:
   - `scripts/tui-visual-capture.mjs`
   - `scripts/tui-terminal-viewer.html`
2. likely retain as guard or support utilities:
   - `scripts/architecture-guard.mjs`
3. likely migrate to `test/unit/`:
   - `scripts/tui-intent.mjs`
   - `scripts/event-bus-safety.mjs`
4. likely migrate to `test/cli/`:
   - `scripts/cli-output-contracts.mjs`
   - `scripts/tui-command-smoke.mjs`
5. likely migrate to `test/integration/`:
   - `scripts/mock-run-smoke.mjs`
   - `scripts/verify-smoke.mjs`
   - `scripts/report-smoke.mjs`
   - `scripts/template-smoke.mjs`
   - `scripts/contract-fallback.mjs`
   - `scripts/contract-policy.mjs`
   - `scripts/clustering-determinism.mjs`
   - `scripts/clustering-limit.mjs`
   - `scripts/mock-run-interrupt.mjs`
   - `scripts/mock-run-debate.mjs`
   - `scripts/debate-empty.mjs`
   - `scripts/validate-embeddings-arrow.mjs`
   - `scripts/resolve-only.mjs`
   - `scripts/tui-warning-sink.mjs`
   - `scripts/signal-handlers.mjs`
   - `scripts/status-mapping.mjs`
   - `scripts/receipt-failure.mjs`
   - `scripts/zero-eligible.mjs`
   - `scripts/error-code-null.mjs`
   - `scripts/relative-config-path.mjs`
6. likely migrate to `test:release` ownership:
   - `scripts/test-pack-install.mjs`
7. likely migrate to `test:canary` ownership:
   - `scripts/openrouter-provenance.mjs`
   - `scripts/live-smoke.mjs`
8. concrete pruning candidate once lane parity is established:
   - `scripts/tui-headless.mjs` because `scripts/cli-output-contracts.mjs` already covers the same help-surface assertions more completely.

Candidate invariant-owner model to prove or revise in M0:

1. determinism -> unit primary, integration shadow
2. artifact pack correctness -> integration primary, release shadow
3. CLI routing/help/non-TTY behavior -> CLI primary
4. TUI layout/content -> TUI render primary, PTY shadow
5. TTY lifecycle/resize/scrollback -> TUI PTY primary
6. shipped tarball/install/bin correctness -> release primary
7. live-provider provenance correctness -> canary primary

## Plan Change Notes
- 2026-03-06 16:55Z: initial testing-system architecture plan drafted after a first-principles review of the current suite and its gaps.
- 2026-03-06 23:40Z: incorporated Opus review feedback by making `test:fast` and `test:merge` compositions explicit, correcting script-classification guidance, and recording the concrete `tui-headless` redundancy.
- 2026-03-06 23:40Z: M0 implementation added `docs/TESTING.md`, updated contributor docs, and introduced non-destructive lane aliases in `package.json` while intentionally deferring `test:fast`.
- 2026-03-07 02:55Z: M1 landed a real source-level fast path via `tsx`, moved unit tests off `dist/*`, and made `check:schemas` build-free.
- 2026-03-07 02:55Z: M2 landed explicit `test/cli/`, `test/integration/`, `test/release/`, `test/canary/`, and shared `test/helpers/` structure while retaining only a smaller script-backed smoke subset inside the integration lane.
- 2026-03-07 02:55Z: M3 moved render fixtures into `test/tui-render/` and extended `capture:tui` with machine-readable `index.json`.
- 2026-03-07 02:55Z: M4 pruned replaced smoke scripts, promoted `test:fast` and `test:merge` to canonical status in contributor docs, and aligned `AGENTS.md`, `README.md`, `docs/TESTING.md`, and `docs/TUI-RUNTIME.md`.
