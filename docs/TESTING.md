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

1. Arbiter now has explicit lane entrypoints in `package.json` for static, unit, integration, CLI, TUI render, TUI end-to-end, release, canary, fast, and merge validation.
2. The fast lane is real: `test:static` and `test:unit` both run without a full `dist/` build, and source-level tests import from `src/*`.
3. TUI render contracts now live in `test/tui-render/*.test.mjs`, separate from PTY end-to-end coverage in `test/e2e/*.test.mjs`.
4. Integration, CLI, release, and canary lanes now have explicit `test/` directories, and the old script-backed smokes have been migrated or deleted.
5. `test:merge` now builds `dist/` once and runs explicit no-build sublanes, so the merge gate reflects the lane model instead of recompiling at every stage.

Steady-state target:

1. a small set of named lanes with clear failure meaning,
2. one primary runner family (`node:test`),
3. a shared fixture and scenario vocabulary,
4. a documented invariant-owner map,
5. a TUI testing stack split into render-contract tests, PTY end-to-end tests, and review artifacts,
6. a canonical local confidence lane and a canonical non-live merge lane,
7. focused subsystem commands that are implemented as explicit test files rather than ad hoc wrapper scripts.

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
   - current characteristics:
     - source-level imports from `src/*`
     - no full build step for the common fast path

3. `test:integration`
  - purpose: subsystem and mock-run behavior, artifact correctness, protocol semantics, and cross-module workflows under non-live conditions
  - current owners:
     - `npm run test:integration`
     - `test/integration/*.test.mjs`

4. `test:cli`
  - purpose: public command surface, flag routing, help output, non-TTY behavior, and exit semantics
  - current owners:
     - `npm run test:cli`
     - `test/cli/*.test.mjs`

5. `test:tui:render`
  - purpose: deterministic screen/layout contracts using the real render functions with plain/no-color formatting
  - current owners:
     - `npm run test:tui:render`
     - `test/tui-render/*.test.mjs`
   - current scope:
     - Stage 0 through Stage 3 layout/content contracts
     - width-aware plain-text fixtures

6. `test:tui:e2e`
   - purpose: PTY lifecycle, key handling, resize behavior, stage handoff ordering, scrollback, and terminal cleanup
   - current owners:
     - `npm run test:e2e:tui`
     - `test/e2e/tui-pty.test.mjs`
     - `test/e2e/tui-visual-capture.test.mjs`

7. `test:release`
  - purpose: package/install/bin correctness for the shipped artifact
  - current owners:
     - `npm run test:release`
     - `test/release/*.test.mjs`

8. `test:canary`
   - purpose: live provider and provenance canary checks when credentials and explicit opt-in are available
   - current owners:
     - `npm run test:live-smoke`
     - `npm run test:provenance`
   - live-smoke contract:
     - requires `OPENROUTER_API_KEY`
     - requires `ARBITER_ENABLE_LIVE_SMOKE=1`
     - skips cleanly when either condition is absent
     - uses one-trial free-tier generation plus a free-tier embedding model to avoid spend

### 3.2) Composed lanes

1. `test:fast`
   - composition:
     - `test:static`
     - source-level `test:unit`
   - characteristics:
     - no full build step
     - default local confidence lane
     - target warm-run duration under 10 seconds
   - current status:
     - exists in `package.json`
     - is the canonical local confidence lane

2. `test:merge`
   - composition:
     - `test:static`
     - `test:unit`
     - one shared `npm run build`
     - `test:integration:nobuild`
     - `test:cli:nobuild`
     - `test:tui:render`
     - `test:e2e:tui:nobuild`
     - `test:release:nobuild`
   - excludes:
     - `test:canary`
   - current status:
     - exists in `package.json`
     - is the canonical non-live merge gate
     - intentionally retains build-backed CLI, PTY, and release stages while avoiding redundant rebuilds

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
9. live provider path with explicit opt-in only

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
4. raw transcript extraction from the final ANSI stream is required for run-path changes that affect scrollback or Stage 1 → Stage 2 → Stage 3 handoff behavior,
5. color and composition review still belongs in `/Users/darylkang/Developer/arbiter/scripts/tui-terminal-viewer.html`.

## 7) Script Classification Rules

The `scripts/` directory should contain only three kinds of files:

1. review or operator utilities,
2. guard utilities,
3. narrow canary support.

Current classification:

1. keep as developer or review utilities:
   - `scripts/tui-visual-capture.mjs`
   - `scripts/tui-terminal-viewer.html`

2. keep as guard utilities:
   - `scripts/architecture-guard.mjs`

3. keep as canary support:
   - `scripts/live-smoke.mjs`
   - it must remain skip-safe by default and use free-tier models only when enabled

Prohibition:

1. test-only smoke coverage must live under `test/`, not under `scripts/`,
2. new subsystem validation should be added as explicit tests wired into a lane or focused test command,
3. scripts may only remain when they are true utilities, guards, or canary support.

## 8) What To Run Today

Practical guidance:

1. fastest local confidence path:
   - `npm run test:fast`

2. TUI behavior or visual changes:
   - `npm run test:ui`
   - `npm run test:e2e:tui`
   - `npm run capture:tui`

3. schema, contract, or artifact-shape changes:
   - `npm run test:static`
   - plus the relevant subsystem suites from `AGENTS.md`

4. release or publish changes:
   - `npm run test:release`
   - `npm pack`

5. full pre-merge validation:
   - `npm run test:merge`

6. focused subsystem diagnosis:
   - focused commands such as `npm run test:mock-run`, `npm run test:contracts`, `npm run test:verify`, `npm run test:report`, and `npm run test:quickstart` exist for targeted diagnosis
   - they are implemented as explicit test files rather than script wrappers

7. live/provider changes:
   - `npm run test:provenance`
   - `npm run test:live-smoke`
   - remote calls happen only when both `OPENROUTER_API_KEY` and `ARBITER_ENABLE_LIVE_SMOKE=1` are set

## 9) Maintenance Discipline

When extending the suite:

1. add coverage at the lowest truthful owner lane,
2. do not introduce new wrapper scripts for tests,
3. prefer shared helpers and scenario fixtures over ad hoc temp-workspace setup,
4. keep changes coordinated with `docs/TUI-RUNTIME.md` when TUI render seams are involved,
5. preserve the build-once merge gate shape unless there is a clear countervailing reason.
