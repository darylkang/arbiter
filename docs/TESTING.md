# Arbiter Testing System

Purpose: define Arbiter's durable testing architecture, lane model, invariant ownership, and review workflow.

This document is operational truth for how Arbiter is tested.
It does not replace product or schema truth.

For semantic truth, use this order:

1. `schemas/`
2. `docs/DESIGN.md`
3. `docs/product-specs/`
4. `docs/TUI-RUNTIME.md`
5. this document for testing architecture and lane ownership

## 1) Testing Principles

Arbiter is a research harness, not a generic web app.

The testing system exists to protect:

1. contract integrity,
2. reproducibility and determinism,
3. artifact correctness,
4. public CLI behavior,
5. end-user TUI behavior,
6. release and package correctness,
7. provider-facing provenance behavior.

The suite follows these principles:

1. test by invariant family, not by historical file placement,
2. keep the fast local loop genuinely fast,
3. use the lowest layer that can truthfully own an invariant,
4. reserve PTY and package-level tests for behaviors that truly require them,
5. let higher layers confirm wiring, not duplicate lower-layer logic,
6. keep visual TUI review first-class without forcing every change through a screenshot-heavy workflow,
7. remove tests only when a replacement owner lane is explicit and at least as strong.

## 2) Current State and Target State

Current state:

1. Arbiter already has strong coverage across unit tests, PTY end-to-end tests, smoke scripts, architecture guards, and package/install checks.
2. The main weakness is taxonomy: the testing system is encoded in `package.json` and ad hoc `scripts/*.mjs` names rather than a durable architecture.
3. Many current "unit" tests still import from `dist/*`, which makes the fast loop slower and more build-coupled than intended.
4. TUI visual review is already credible through `capture:tui`, but the render-contract lane is only beginning to emerge.
5. Transitional named lanes now exist in `package.json`, but they still wrap the current build-backed and script-heavy implementation.

Target state:

1. a small set of named lanes with clear failure meaning,
2. one primary runner family (`node:test`),
3. a shared fixture and scenario vocabulary,
4. a documented invariant-owner map,
5. a TUI testing stack split into render-contract tests, PTY end-to-end tests, and review artifacts,
6. a canonical local confidence lane and a canonical non-live merge lane.

Until the migration finishes, the current commands in `package.json` remain operationally canonical.
This document defines the target architecture and the migration map from the current aliases toward the final system.

## 3) Lane Model

### 3.1) Concrete lanes

1. `test:static`
   - purpose: type, schema, and architecture guard checks
   - current owners:
     - `npm run typecheck`
     - `npm run check:types`
     - `npm run check:schemas`
     - `npm run test:guards`

2. `test:unit`
   - purpose: fast deterministic logic and pure render-fixture checks
   - current owners:
     - `npm run test:unit`
     - `test/unit/*.test.mjs`
   - migration target:
     - primarily source-level imports from `src/*`
     - no full build step for the common fast path

3. `test:integration`
   - purpose: subsystem and mock-run behavior, artifact correctness, protocol semantics, and cross-module workflows under non-live conditions
   - current owners:
     - `npm run test:mock-run`
     - `npm run test:verify`
     - `npm run test:contracts`
     - `npm run test:templates`
     - `npm run test:report`
     - `npm run test:debate`
     - `npm run test:clustering`
     - `npm run test:embeddings`

4. `test:cli`
   - purpose: public command surface, flag routing, help output, non-TTY behavior, and exit semantics
   - current owners:
     - `npm run test:cli-contracts`
     - CLI-focused portions of `npm run test:ui`

5. `test:tui:render`
   - purpose: deterministic screen/layout contracts using the real render functions with plain/no-color formatting
   - current owners:
     - emerging fixture coverage in `test/unit/tui-runtime-fixtures.test.mjs`
     - render-oriented portions of `test/unit/fmt.test.mjs`
   - migration target:
     - own Stage 0 through Stage 3 layout/content contracts

6. `test:tui:e2e`
   - purpose: PTY lifecycle, key handling, resize behavior, stage handoff ordering, scrollback, and terminal cleanup
   - current owners:
     - `npm run test:e2e:tui`
     - `test/e2e/tui-pty.test.mjs`
     - `test/e2e/tui-visual-capture.test.mjs`

7. `test:release`
   - purpose: package/install/bin correctness for the shipped artifact
   - current owners:
     - `npm run test:pack`
     - `npm pack`

8. `test:canary`
   - purpose: live provider and provenance canary checks when credentials are available
   - current owners:
     - `npm run test:live-smoke`
     - `npm run test:provenance`

### 3.2) Composed lanes

1. `test:fast`
   - target composition:
     - `test:static`
     - source-level `test:unit`
   - target characteristics:
     - no full build step
     - default local confidence lane
     - target warm-run duration under 10 seconds
   - current status:
     - intentionally not added yet
     - the nearest approximation is `npm run typecheck && npm run test:guards && npm run test:unit`

2. `test:merge`
   - target composition:
     - `test:static`
     - `test:unit`
     - `test:integration`
     - `test:cli`
     - `test:tui:render`
     - `test:tui:e2e`
     - `test:release`
   - excludes:
     - `test:canary`
   - current status:
     - exists as a transitional alias in `package.json`
     - still resolves to the current build-backed lane composition rather than the final streamlined system

## 4) Invariant Ownership

Each invariant should have one primary owner lane.
Shadow coverage is allowed, but it must remain deliberate.

1. type, generated-type, schema, and architecture-guard correctness
   - primary owner: `test:static`
   - shadow: none by default

2. deterministic core logic
   - primary owner: `test:unit`
   - shadow: `test:integration`

3. artifact pack correctness and non-live run-service behavior
   - primary owner: `test:integration`
   - shadow: `test:release`

4. public CLI routing and command contract
   - primary owner: `test:cli`
   - shadow: none by default

5. TUI layout and content contracts
   - primary owner: `test:tui:render`
   - shadow: `test:tui:e2e`
   - review aid: `capture:tui`

6. TTY lifecycle, resize, scrollback, and interactive behavior
   - primary owner: `test:tui:e2e`
   - shadow: none by default

7. shipped tarball, installed bin, and publish-surface correctness
   - primary owner: `test:release`
   - shadow: none by default

8. live provider and provenance behavior
   - primary owner: `test:canary`
   - shadow: none by default

If two lanes appear to own the same invariant, the duplication must be justified or removed.

## 5) Canonical Scenario Matrix

The suite should converge on a small shared scenario vocabulary.
Not every lane must exercise every scenario, but the names and fixtures should be reused across layers.

Core non-live scenarios:

1. independent protocol, mock run, grouping disabled
2. independent protocol, mock run, grouping enabled
3. debate protocol, mock run
4. contract parse fallback with usable text
5. graceful stop / interrupt path
6. report and verify path over a generated run
7. pack/install surface

CLI and terminal scenarios:

1. root invocation with TTY
2. root invocation without TTY
3. `arbiter run --dashboard` without TTY
4. missing config path
5. standard TUI terminal size such as `120x40`
6. short but supported TUI size such as `120x24`
7. minimum supported width or height path such as `60x18` and `60x24`
8. undersized terminal rejection path

Visual and render scenarios:

1. Stage 0 entry
2. Stage 1 review
3. Stage 2 progress
4. Stage 3 receipt
5. representative warning or failure surface when user-visible

## 6) TUI Testing Model

Arbiter's TUI requires three distinct validation modes.

### 6.1) Render-contract tests

Use `test:tui:render` for:

1. layout,
2. content,
3. width-dependent composition,
4. deterministic frame fixtures,
5. warning and receipt composition.

These tests should call the real render functions with plain/no-color formatting and typed view-model fixtures.
They should not require a PTY.

### 6.2) PTY end-to-end tests

Use `test:tui:e2e` for:

1. raw key handling,
2. alternate-screen and terminal lifecycle behavior,
3. resize re-render behavior,
4. stage handoff ordering,
5. scrollback preservation,
6. cleanup and exit behavior.

PTY tests should be curated and relatively few.
They are not the primary owner of layout/content assertions.

### 6.3) Review-artifact workflow

Use `npm run capture:tui` for:

1. generating `.ansi` files for human review,
2. generating rendered `.txt` files for agent review,
3. collecting evidence when diagnosing TUI regressions,
4. supporting visual QA during TUI-focused work.

Operational rules:

1. `capture:tui` is a scoped review workflow, not a mandatory gate for every code change,
2. build-backed TUI commands must run serially, not in parallel,
3. rendered `*.txt` snapshots are structural truth for layout/content review,
4. color and composition review still belongs in `/Users/darylkang/Developer/arbiter/scripts/tui-terminal-viewer.html`.

## 7) Script Classification and Pruning Rules

The current `scripts/` directory mixes three different things:

1. true developer or review utilities,
2. static guard utilities,
3. test-only smoke logic.

Target classification:

1. keep as developer or review utilities:
   - `scripts/tui-visual-capture.mjs`
   - `scripts/tui-terminal-viewer.html`

2. keep as guard utilities:
   - `scripts/architecture-guard.mjs`

3. migrate toward `test/unit/` ownership:
   - `scripts/tui-intent.mjs`
   - `scripts/event-bus-safety.mjs`

4. migrate toward `test/cli/` ownership:
   - `scripts/cli-output-contracts.mjs`
   - `scripts/tui-command-smoke.mjs`

5. migrate toward `test/integration/` ownership:
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

6. migrate toward `test:release` ownership:
   - `scripts/test-pack-install.mjs`

7. migrate toward `test:canary` ownership:
   - `scripts/live-smoke.mjs`
   - `scripts/openrouter-provenance.mjs`

Concrete redundancy already identified:

1. `scripts/tui-headless.mjs` is a pruning candidate because it tests a strict subset of the help and headless-routing assertions already covered more thoroughly by `scripts/cli-output-contracts.mjs`.

Pruning rule:

1. no test or script is deleted until its replacement owner lane is named and parity evidence is recorded.

## 8) What To Run Today

Until the lane migration lands, use the current command surface in `package.json`.

Practical guidance:

1. TUI behavior or visual changes:
   - `npm run test:ui`
   - `npm run test:e2e:tui`
   - `npm run test:unit`
   - `npm run test:guards`
   - `npm run capture:tui`

2. schema, contract, or artifact-shape changes:
   - `npm run check:types`
   - `npm run check:schemas`
   - plus the relevant subsystem suites from `AGENTS.md`

3. release or publish changes:
   - `npm run test:pack`
   - `npm pack`

4. full pre-merge validation:
   - prefer `npm run test:merge`
   - use the merge-gate list in `AGENTS.md` as the fallback source of truth if `test:merge` is being debugged or changed

## 9) Migration Discipline

While the testing-system redesign is in progress:

1. prefer additive lane aliases and new docs before deleting old commands,
2. keep old and new surfaces side by side until parity is demonstrated,
3. do not claim a lane exists in contributor guidance until it exists in `package.json`,
4. record every deletion alongside the invariant and replacement owner lane,
5. keep changes coordinated with `docs/TUI-RUNTIME.md` and the active TUI runtime hardening plan when TUI render seams are involved.
