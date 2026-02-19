# Harden CLI Surface to v1 Contract

This ExecPlan is a living document and must be updated as work proceeds.
This plan follows `docs/PLANS.md`.

## Purpose / Big Picture
Stabilize Arbiter's public command surface to the intentional v1 contract: exactly three primary entry points (`arbiter`, `arbiter init`, `arbiter run`) with minimal, explicit flag behavior. This prevents UX drift, keeps automation stable, and ensures the wizard/headless split remains simple and predictable.

Observable user outcomes:

1. `arbiter` launches wizard in TTY and prints help in non-TTY.
2. `arbiter init` writes collision-safe config names and never overwrites.
3. `arbiter run --config <path>` is the canonical headless path.
4. `arbiter run --dashboard` is TTY-only visualization; non-TTY warns and continues headless.
5. Legacy/extra flags and commands are removed from help and parser behavior.

## Progress
- [x] (2026-02-19 00:00Z) initial plan drafted (`proposed`)
- [ ] (2026-02-19 00:00Z) milestone 1 complete: command parser + help contract aligned
- [ ] (2026-02-19 00:00Z) milestone 2 complete: `arbiter` TTY/non-TTY dispatch enforced
- [ ] (2026-02-19 00:00Z) milestone 3 complete: `arbiter init` naming/overwrite semantics enforced
- [ ] (2026-02-19 00:00Z) milestone 4 complete: `arbiter run` flag surface constrained and validated
- [ ] (2026-02-19 00:00Z) milestone 5 complete: integration tests and docs synchronized (`completed`)

## Surprises & Discoveries
- Observation: current CLI code still exposes legacy commands and flags (`validate`, `verify`, `report`, `resolve`, transcript-oriented behavior).
  Evidence: `src/cli/index.ts`, `src/cli/commands.ts`, `src/cli/help.ts`.
- Observation: docs already state a simplified CLI contract, but implementation does not fully match.
  Evidence: `README.md`, `docs/DESIGN.md`, `src/cli/*`.

## Decision Log
- Decision: contract hardening is isolated in its own plan from UI rewrite.
  Rationale: command-surface stability is externally observable and benefits from independent verification and rollback.
  Date/Author: 2026-02-19, Codex thread.
- Decision: keep run execution semantics untouched except where required to satisfy command-surface contract.
  Rationale: reduces risk of accidental engine/artifact regressions while stabilizing interface behavior.
  Date/Author: 2026-02-19, Codex thread.

## Context and Orientation
Reviewed before plan finalization:

1. `AGENTS.md` for invariants and validation gates.
2. `README.md` CLI contract section.
3. `docs/DESIGN.md` CLI surface contract section.
4. `docs/PLANS.md` for required plan structure.
5. `docs/product-specs/tui-wizard.md` command-surface and mode behavior section.
6. `src/cli/index.ts`, `src/cli/commands.ts`, `src/cli/help.ts` for current parser/dispatch/help implementation.

Non-obvious terms:

1. Headless: non-interactive run path without Stage 1 wizard setup.
2. Dashboard: Stage 2 + Stage 3 monitor/receipt rendering for humans.
3. Control-plane flags: execution controls (`--out`, `--workers`, `--batch-size`, `--max-trials`, `--mode`, `--dashboard`) only.

High-risk components:

1. parser normalization and short flag handling in `src/cli/commands.ts`.
2. root command dispatch and TTY detection in `src/cli/index.ts`.
3. help text drift in `src/cli/help.ts`.

## Plan of Work
Ordering principle: external API stability first, implementation cleanup second.

1. Define and enforce exact command/flag grammar in parser and help.
2. Enforce root command dispatch behavior for TTY and non-TTY.
3. Rework `init` for collision-safe deterministic naming with no overwrite.
4. Constrain `run` to minimal flag set and validate runtime behavior for dashboard/TTY.
5. Remove legacy entrypoints from parser/help routing.
6. Add regression tests and update docs in lockstep.

Milestones:

1. Milestone 1: command grammar and help contract.
2. Milestone 2: root `arbiter` mode-dispatch semantics.
3. Milestone 3: `init` naming and write safety.
4. Milestone 4: `run` flag constraints and dashboard fallback behavior.
5. Milestone 5: cleanup, tests, and docs synchronization.

## Concrete Steps
Working directory: repository root.

1. Refactor CLI parser and command table to admit only v1 commands.
   Command: `rg -n "validate|verify|report|resolve|--headless|--verbose|--wizard" src/cli -S`
   Expected evidence: no command dispatch paths for removed contract surface.
2. Update root dispatch (`arbiter`) TTY handling.
   Command: `rg -n "isTTY|launch.*wizard|help" src/cli/index.ts -S`
   Expected evidence: non-TTY root path prints help and exits `0`; TTY path launches wizard.
3. Implement deterministic non-overwrite naming for `arbiter init`.
   Command: `rg -n "init|arbiter\.config" src/cli src/config src/run -S`
   Expected evidence: filename sequence `arbiter.config.json`, `.1`, `.2`, ... used consistently.
4. Restrict `run` flags and enforce `--dashboard` non-TTY fallback warning behavior.
   Command: `rg -n "dashboard|mode|max-trials|workers|batch-size|out" src/cli -S`
   Expected evidence: unknown/legacy flags rejected or absent; dashboard warning on non-TTY.
5. Align help text and README examples to implementation.
   Command: `rg -n "--headless|--verbose|validate|verify|report|resolve" README.md docs src/cli/help.ts -S`
   Expected evidence: no stale flag/command references in user-facing CLI docs.
6. Add contract tests for parser, help, and dispatch behavior.
   Commands:
   - `npm run check:types`
   - `npm run test:ui`
   - `npm run test:mock-run`
   - `npm run test:pack`
   Expected evidence: new tests assert only v1 surface appears and behaves as contracted.

## Validation and Acceptance
Behavioral acceptance criteria:

1. `arbiter` in TTY launches wizard.
2. `arbiter` in non-TTY prints help and exits `0`.
3. `arbiter init` never overwrites existing configs and follows deterministic collision-safe naming.
4. `arbiter run --config <file>` executes headless.
5. `arbiter run --config <file> --dashboard` renders monitor only in TTY; non-TTY warns and runs headless.
6. Only v1 commands appear in help output.
7. `-h` and `--help` both work.
8. `-V` and `--version` both work.

Validation commands:

1. `npm run check:types`
2. `npm run check:schemas`
3. `npm run test:ui`
4. `npm run test:mock-run`
5. `npm run test:pack`

Fail-before/pass-after evidence to capture:

1. legacy commands present in old help output (before).
2. v1-only help output snapshot (after).
3. non-TTY root invocation help behavior (after).
4. `init` naming sequence behavior when files already exist (after).

## Idempotence and Recovery
1. CLI hardening changes are deterministic and safe to re-run; parser/help updates are text-idempotent.
2. Rollback boundary after each milestone commit.
3. If CLI parsing regresses, restore previous milestone and replay one constrained change at a time.
4. If `run` behavior regresses, keep parser hardening and temporarily restore prior run dispatch while tests are fixed.

## Interfaces and Dependencies
1. `src/cli/index.ts` root dispatch and command execution.
2. `src/cli/commands.ts` argument parsing and run/init execution helpers.
3. `src/cli/help.ts` generated help text contract.
4. `src/run/run-service.ts` integration boundary for execution.

## Artifacts and Notes
Cross-plan dependency:

1. This plan should execute after foundational wizard architecture decisions in `docs/exec-plans/2026-02-19-strict-linear-wizard-ui-rewrite.md`.
2. Artifact contract details (`config.source.json`, run output set) are handled in the artifact-specific plan.

## Plan Change Notes
- 2026-02-19 00:00Z: initial draft created; scoped to command-surface hardening only, independent from artifact contract finalization.
