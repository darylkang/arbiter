# Harden CLI Surface to v1 Contract

This ExecPlan is a living document and must be updated as work proceeds.
This plan follows `docs/PLANS.md`.

## Purpose / Big Picture
Stabilize Arbiter's public CLI to the intentional v1 contract: exactly three primary entry points (`arbiter`, `arbiter init`, `arbiter run`) with a minimal, explicit flag surface and deterministic mode behavior.

Observable user outcomes:

1. `arbiter` launches wizard in TTY and prints help in non-TTY.
2. `arbiter init` writes deterministic collision-safe config filenames and never overwrites.
3. `arbiter run --config <path>` remains canonical headless execution path.
4. `arbiter run --dashboard` renders monitor only in TTY; non-TTY warns to stderr and continues headless.
5. Legacy flags and commands are absent from help and parser behavior.

## Progress
- [x] (2026-02-19 00:00Z) initial plan drafted (`proposed`)
- [x] (2026-02-20 00:00Z) milestone 0 complete: contract freeze on legacy command disposition
- [ ] (pending) BLOCKED: do not start Milestone 1 until wizard rewrite Milestone 6 (default-path cutover) is complete
- [ ] (pending) milestone 1 complete: parser/help grammar aligned
- [ ] (pending) milestone 2 complete: root `arbiter` TTY/non-TTY dispatch aligned
- [ ] (pending) milestone 3 complete: `arbiter init` naming/overwrite semantics aligned
- [ ] (pending) milestone 4 complete: `arbiter run` flag surface constrained and validated
- [ ] (pending) milestone 5 complete: script and test contract updates complete (`completed`)

## Surprises & Discoveries
- Observation: current CLI includes legacy commands and flags outside v1 contract.
  Evidence: `src/cli/index.ts`, `src/cli/commands.ts`, `src/cli/help.ts`.
- Observation: current mode resolver explicitly supports `--headless`, and tests assert that behavior.
  Evidence: `src/cli/intent.ts`, `scripts/tui-headless.mjs`, `scripts/tui-intent.mjs`.
- Observation: CLI output-contract tests currently depend on legacy commands (`report`, `verify`, `receipt`, `validate`, `resolve`).
  Evidence: `scripts/cli-output-contracts.mjs`.

## Decision Log
- Decision: CLI hardening is isolated from UI rewrite and artifact package stabilization.
  Rationale: public command surface is externally observable and benefits from independent acceptance and rollback.
  Date/Author: 2026-02-19, Codex thread.
- Decision: execute this plan after UI rewrite reaches default-path cutover milestone.
  Rationale: avoid double churn in root dispatch while stage architecture is still moving.
  Date/Author: 2026-02-19, Codex thread.
- Historical decision checkpoint (closed): disposition of existing inspection commands (`verify`, `report`, `receipt`, `validate`, `resolve`) in unreleased clean-cutover path.
  Rationale: tests/scripts currently rely on them; removal requires explicit replacement strategy.
  Date/Author: superseded by 2026-02-20 decision below.
- Decision: remove legacy inspection commands (`verify`, `report`, `receipt`, `validate`, `resolve`) from the public `arbiter` CLI surface in v1.
  Rationale: v1 contract fixes exactly three primary entry points; keeping extra commands would violate surface minimalism.
  Date/Author: 2026-02-20, Daryl direction + Codex consolidation.
- Decision: keep inspection capabilities available through internal modules and dedicated npm scripts during migration, not as public primary CLI commands.
  Rationale: preserves internal verification/report workflows while holding public contract line.
  Date/Author: 2026-02-20, Codex thread.

## Context and Orientation
Reviewed before plan finalization:

1. `AGENTS.md` for invariants and required validation gates.
2. `README.md` and `docs/DESIGN.md` CLI contract sections.
3. `docs/PLANS.md` for plan requirements.
4. `docs/product-specs/tui-wizard.md` command-surface section.
5. `src/cli/index.ts`, `src/cli/commands.ts`, `src/cli/help.ts`, `src/cli/intent.ts` for current behavior.
6. `scripts/tui-headless.mjs`, `scripts/tui-intent.mjs`, `scripts/cli-output-contracts.mjs` for regression scope.

Non-obvious terms:

1. Headless: non-interactive execution path.
2. Dashboard: Stage 2 + Stage 3 monitor rendering for humans.
3. Control-plane flags: `--out`, `--workers`, `--batch-size`, `--max-trials`, `--mode`, `--dashboard`.

High-risk components:

1. root dispatch behavior for non-TTY could silently regress user expectations.
2. removing legacy flags/commands can break scripts and tests if migration is not explicit.
3. help text drift can leave contract ambiguous even when behavior is correct.

## Plan of Work
Ordering principle: freeze command contract decisions first, then parser/runtime behavior, then test/doc synchronization.

1. Resolve milestone-0 decision on legacy command disposition and migration path.
2. Enforce exact command and flag grammar in parser and help output.
3. Enforce root invocation TTY/non-TTY contract (`arbiter` only).
4. Implement deterministic non-overwriting init naming behavior.
5. Constrain run flag surface and dashboard fallback behavior.
6. Update scripts/tests/docs to encode new contract as executable evidence.

Milestones:

1. Milestone 0: legacy command disposition freeze.
2. Milestone 1: parser/help contract alignment.
3. Milestone 2: root dispatch alignment.
4. Milestone 3: init semantics alignment.
5. Milestone 4: run flags and dashboard behavior alignment.
6. Milestone 5: script/test/doc synchronization and acceptance.

Milestone entry and exit gates:

1. Milestone 1 entry gate: wizard rewrite Milestone 6 (default-flow cutover) is complete.
2. Milestone 1 exit gate: help output and parser grammar expose only v1 commands/flags.
3. Milestone 2 exit gate: non-TTY root invocation prints help and exits `0`; TTY root launches wizard.
4. Milestone 3 exit gate: `arbiter init` deterministic naming is collision-safe and overwrite-free.
5. Milestone 4 exit gate: `arbiter run` accepts only contracted control-plane flags; dashboard fallback behavior is verified.
6. Milestone 5 exit gate: scripts/tests/docs all assert the same contract and no legacy surface remains referenced as public behavior.

## Concrete Steps
Working directory: repository root.

1. Remove legacy grammar from parser/help according to milestone-0 decision.
   Command: `rg -n "validate|verify|report|receipt|resolve|--headless|--verbose|--wizard|--live|--yes|--strict|--permissive|--allow-free|--allow-aliased|--contract-failure" src/cli -S`
   Expected evidence: parser and help expose only approved v1 contract.
2. Align root command dispatch behavior.
   Command: `rg -n "resolveCliMode|isTTY|noCommand|--help|--version" src/cli/index.ts src/cli/intent.ts -S`
   Expected evidence: `arbiter` TTY launches wizard; non-TTY prints help and exits `0`.
3. Implement init naming contract.
   Command: `rg -n "init|arbiter\.config|overwrite|force" src/cli src/config -S`
   Expected evidence: naming sequence `arbiter.config.json`, `.1`, `.2`, ... with no overwrite path.
4. Restrict run command flags.
   Command: `rg -n "--config|--out|--workers|--batch-size|--max-trials|--mode|--dashboard" src/cli -S`
   Expected evidence: run accepts only contracted flags and rejects removed ones.
5. Implement dashboard non-TTY fallback warning semantics.
   Command: `rg -n "dashboard|stderr|TTY|warn" src/cli src/ui -S`
   Expected evidence: warning to stderr only; execution continues headless.
6. Update and/or replace contract scripts and tests.
   Commands:
   - `rg -n "--headless|/run|/quit|resolveCliMode|verify|report|receipt|validate|resolve" scripts test -S`
   - `npm run test:ui`
   - `npm run test:cli-contracts`
   Expected evidence: tests assert v1 contract and no legacy behavior assumptions.
7. Sync docs with executable behavior.
   Command: `rg -n "headless|verbose|validate|verify|report|receipt|resolve" README.md docs -S`
   Expected evidence: user-facing docs match CLI implementation.

## Validation and Acceptance
Behavioral acceptance criteria:

1. `arbiter` launches wizard in TTY.
2. `arbiter` prints help and exits `0` in non-TTY.
3. `arbiter init` never overwrites and uses deterministic collision-safe naming.
4. Config discovery uses pattern equivalent to `^arbiter\.config(?:\.[1-9][0-9]*)?\.json$` and CWD scope only.
5. `arbiter init` prints created config path and suggested next commands (`arbiter`, `arbiter run --config <file>`).
6. `arbiter run --config <file>` executes headlessly.
7. `arbiter run --dashboard` renders in TTY only; non-TTY warns and proceeds headless.
8. Help output contains only contracted command surface.
9. `-h`/`--help` and `-V`/`--version` are supported.
10. Removed flags/commands are rejected or absent by design.
11. Public CLI help documents exactly three primary entry points and no others.

Validation commands:

1. `npm run check:types`
2. `npm run check:schemas`
3. `npm run test:ui`
4. `npm run test:cli-contracts`
5. `npm run test:mock-run`
6. `npm run test:pack`

Fail-before/pass-after evidence to capture:

1. old help output with legacy commands/flags (before).
2. v1-only help output (after).
3. non-TTY root invocation behavior (after).
4. init collision-safe naming behavior under pre-existing files (after).

## Idempotence and Recovery
1. Parser/help updates are deterministic and re-runnable.
2. Use milestone commits for rollback boundaries.
3. If root dispatch regresses, rollback milestone 2 while preserving parser cleanup.
4. If test migrations break unexpectedly, keep v1 parser and patch tests/scripts in a dedicated fix commit.

## Interfaces and Dependencies
1. CLI parser/dispatch: `src/cli/index.ts`, `src/cli/commands.ts`, `src/cli/intent.ts`, `src/cli/help.ts`.
2. UI entrypoint dependency: wizard launcher in `src/ui/`.
3. Contract scripts and tests: `scripts/tui-*.mjs`, `scripts/cli-output-contracts.mjs`, `test/e2e/*`.

## Artifacts and Notes
Cross-plan dependencies:

1. depends on wizard rewrite cutover in `docs/exec-plans/2026-02-19-strict-linear-wizard-ui-rewrite.md`.
2. artifact-shape decisions remain governed by `docs/exec-plans/2026-02-19-artifact-package-contract-alignment.md`.

## Plan Change Notes
- 2026-02-19 00:00Z: initial draft created.
- 2026-02-19 00:00Z: strengthened after self-audit with explicit legacy-command decision gate and script/test migration scope.
- 2026-02-20 00:00Z: milestone-0 legacy-command disposition finalized and explicit milestone exit gates added.
- 2026-02-20 00:00Z: added hard dependency gate on wizard Milestone 6 and expanded acceptance criteria for config discovery and `arbiter init` output contract.
