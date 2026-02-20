# Rewrite Wizard UI Architecture to Strict Linear Flow

This ExecPlan is a living document and must be updated as work proceeds.
This plan follows `docs/PLANS.md`.

## Purpose / Big Picture
Deliver a clean-cutover Wizard TUI aligned with `docs/product-specs/tui-wizard.md`: strict linear Stage 1 intake, Stage 2 dashboard monitoring, and Stage 3 receipt printout with automatic exit.

This plan intentionally includes required contract-enabling backend changes where the current system cannot satisfy the UI contract without them, especially Debate parameterization (`participants`, `rounds`, final-output semantics).

Observable user outcomes:

1. `arbiter` in TTY launches a step-based wizard, not transcript/chat UI.
2. Stage 1 is one active step at a time with explicit Back/Next and hard validation gates.
3. Review is the only config commit point; no config writes before explicit commit action.
4. Stage 2 is a live dashboard with graceful `Ctrl+C` stop behavior.
5. Stage 3 prints receipt and exits automatically with no next-action menu.
6. Debate setup supports `P` participants and `R` rounds with trial-output semantics defined by final slot `A` turn.

Scope guardrails:

1. in scope: wizard architecture cutover, stage routing, and only the backend contract changes required for accepted wizard semantics.
2. out of scope: broad artifact-package redesign and independent CLI surface pruning beyond what is necessary for wizard default routing.
3. sequencing: this plan lands first; follow-on plans then harden CLI surface and artifact package contracts.

## Progress
- [x] (2026-02-19 00:00Z) initial plan drafted (`proposed`)
- [ ] (2026-02-19 00:00Z) milestone 0 complete: protocol/config contract deltas finalized
- [ ] (2026-02-19 00:00Z) milestone 1 complete: wizard shell + stage router scaffolded
- [ ] (2026-02-19 00:00Z) milestone 2 complete: Stage 1 strict linear flow implemented
- [ ] (2026-02-19 00:00Z) milestone 3 complete: debate execution semantics generalized for `P` and `R`
- [ ] (2026-02-19 00:00Z) milestone 4 complete: Stage 2 dashboard implemented with graceful interrupt
- [ ] (2026-02-19 00:00Z) milestone 5 complete: Stage 3 receipt auto-exit implemented
- [ ] (2026-02-19 00:00Z) milestone 6 complete: transcript-era default UX removed
- [ ] (2026-02-19 00:00Z) milestone 7 complete: tests and acceptance evidence captured (`completed`)

## Surprises & Discoveries
- Observation: current protocol implementation is `debate_v1` with fixed 3-turn proposer/critic/proposer flow; no generalized participants/rounds.
  Evidence: `schemas/config.schema.json`, `schemas/protocol.schema.json`, `src/planning/planner.ts`, `src/protocols/debate-v1/*`.
- Observation: current default TUI is transcript/slash-command driven and coupled to legacy command registry.
  Evidence: `src/ui/transcript/app.ts`, `src/ui/transcript/commands/*`, `scripts/tui-command-smoke.mjs`.
- Observation: current UI test scripts and e2e tests assert transcript semantics and overlay workflow.
  Evidence: `scripts/tui-intent.mjs`, `scripts/tui-headless.mjs`, `test/e2e/tui-pty.test.mjs`.
- Observation: UI routing and smoke coverage references were fragmented and required alignment to active script/test entrypoints.
  Evidence: `scripts/tui-*.mjs`, `test/e2e/tui-pty.test.mjs`.

## Decision Log
- Decision: this rewrite is a clean cutover, not dual-UX coexistence.
  Rationale: product direction requires strict linear wizard as default human path; transcript UX materially conflicts.
  Date/Author: 2026-02-19, Codex thread.
- Decision: Debate `P`/`R` contract support is in-scope for this plan because Step 2 contract cannot be satisfied otherwise.
  Rationale: implementing only front-end controls without protocol semantics would produce contract drift and misleading UX.
  Date/Author: 2026-02-19, Codex thread.
- Decision: run mode (`Live`/`Mock`) remains runtime runner choice and is not persisted as study-definition mutation.
  Rationale: aligns with product spec and avoids config semantic drift.
  Date/Author: 2026-02-19, Codex thread.

## Context and Orientation
Reviewed before plan finalization:

1. `AGENTS.md` for invariants (schema-first, determinism, artifacts, UI/engine boundary).
2. `README.md` for user-visible CLI and run behavior commitments.
3. `docs/DESIGN.md` for architecture and claims-discipline constraints.
4. `docs/PLANS.md` for required ExecPlan structure and evidence standards.
5. `docs/product-specs/tui-wizard.md` as canonical UX target.
6. `schemas/config.schema.json`, `schemas/protocol.schema.json`, `schemas/trial*.schema.json` for contract limits.
7. `src/cli/index.ts`, `src/cli/intent.ts` for current TTY/headless routing.
8. `src/ui/transcript/*` for legacy UX behavior.
9. `src/planning/planner.ts` and `src/protocols/*` for protocol execution semantics.
10. `src/run/run-service.ts`, `src/events/*`, `src/artifacts/*` for stage integration boundaries.
11. `scripts/tui-*.mjs`, `test/e2e/tui-pty.test.mjs` for regression surface.

Non-obvious terms:

1. Stage 1: intake wizard steps `0..7` producing an in-memory study definition.
2. Stage 2: run dashboard subscribed to run events.
3. Stage 3: terminal receipt printout with immediate exit.
4. Commit point: first config write to disk, only on Review commit actions.
5. Debate trial output: final slot `A` response after `P * R + 1` turns.

High-risk components:

1. Protocol/schema migration needed to support `P` and `R` while preserving determinism.
2. Cutover from transcript reducer/commands to step-state machine without breaking run orchestration.
3. Replacing transcript-oriented test expectations with new wizard contract tests.

## Plan of Work
Ordering principle: contract feasibility first, then UX cutover, then cleanup.

1. Finalize contract deltas where current schemas/protocol logic cannot satisfy accepted UX contract.
2. Build a new wizard-first state machine and stage router in parallel with existing code (temporary coexistence during migration).
3. Implement Stage 1 steps exactly as contract, including preflight and Review action matrix.
4. Generalize Debate runtime semantics (`P` participants, `R` rounds, final `A` output parse/embed semantics, persisted intermediate turns).
5. Implement Stage 2 dashboard mapping from existing event bus and worker status streams.
6. Implement Stage 3 receipt contract and auto-exit behavior with scrollback-safe output.
7. Switch CLI TTY default to new wizard, remove transcript-first default path, and update tests/docs.

Milestones:

1. Milestone 0: contract feasibility and schema/protocol migration design freeze.
2. Milestone 1: wizard architecture scaffold.
3. Milestone 2: Stage 1 strict flow and review commit logic.
4. Milestone 3: Debate `P`/`R` execution semantics.
5. Milestone 4: Stage 2 dashboard and graceful stop.
6. Milestone 5: Stage 3 receipt auto-exit.
7. Milestone 6: default-flow cutover and legacy transcript decoupling.
8. Milestone 7: validation and acceptance evidence.

Milestone entry and exit gates:

1. Milestone 0 exit gate: schema/protocol deltas for Debate `P`/`R` and final-output semantics are documented, reviewed, and test targets are defined.
2. Milestone 2 exit gate: Stage 1 flow enforces single active step, strict validation, and review-only commit behavior.
3. Milestone 3 exit gate: Debate trial output/parse/embed semantics match product spec and intermediate turns are auditable.
4. Milestone 4 exit gate: dashboard updates from runtime events only; `Ctrl+C` gracefully stops and transitions to receipt.
5. Milestone 6 exit gate: transcript/slash-command default path removed from root wizard flow.
6. Milestone 7 exit gate: acceptance criteria evidence captured and required test suite passes.

## Concrete Steps
Working directory: repository root.

1. Record a UI contract matrix mapping each accepted Step requirement to code ownership.
   Command: `rg -n "Step [0-7]|Stage 2|Stage 3|Input Contract|Config discovery|Debate output semantics" docs/product-specs/tui-wizard.md -S`
   Expected evidence: implementation checklist keyed to explicit spec clauses.
2. Implement required schema/protocol changes first where needed for Debate parameterization.
   Commands:
   - `rg -n "debate_v1|protocol\.type|role_assignments|turns" schemas src/planning src/protocols -S`
   - `npm run gen:types`
   - `npm run check:schemas`
   Expected evidence: contracts can represent `P`/`R` semantics and final-output rules.
3. Build wizard-first UI module and stage reducer.
   Commands:
   - `rg -n "transcript|overlay|slash|phase" src/ui -S`
   - `rg -n "wizard|step|review|preflight" src/ui -S`
   Expected evidence: dedicated step state machine with single active step and preserved back-navigation state.
4. Implement Step 0 config discovery and save naming behavior.
   Commands:
   - `rg -n "arbiter\.config|Run existing config|Create new study|collision" src/ui src/cli -S`
   Expected evidence: deterministic discovery/sorting and non-overwriting naming sequence.
5. Implement Review actions and commit-point semantics.
   Command: `rg -n "Run now|Save config|Revise|Quit without saving|preflight" src/ui -S`
   Expected evidence: no writes before commit; Revise preserves state and never mutates source file in place.
6. Implement Stage 2 dashboard and interrupt behavior.
   Command: `rg -n "worker\.status|batch\.completed|run\.completed|run\.failed|SIGINT" src/ui src/run src/engine -S`
   Expected evidence: graceful cancel path transitions to receipt with truthful stop reason.
7. Implement Stage 3 receipt and auto-exit.
   Command: `rg -n "receipt|auto-exit|scrollback|artifact\.written" src/ui -S`
   Expected evidence: receipt visible post-exit in terminal scrollback and no next-action menu.
8. Cut over CLI TTY default path and retire transcript-default tests.
   Commands:
   - `rg -n "launchTranscriptTUI|resolveCliMode|--headless|/run|/quit" src/cli scripts test -S`
   Expected evidence: wizard-first default behavior and updated tests/scripts aligned to new UX contract.
9. Run required quality gates for cross-cutting changes.
   Commands:
   - `npm run check:types`
   - `npm run check:schemas`
   - `npm run test:mock-run`
   - `npm run test:debate`
   - `npm run test:clustering`
   - `npm run test:embeddings`
   - `npm run test:verify`
   - `npm run test:ui`
   - `npm run test:pack`

## Validation and Acceptance
Behavioral acceptance criteria:

1. Stage order is exactly `0 Welcome -> 1 Question -> 2 Protocol -> 3 Models -> 4 Personas -> 5 Decode -> 6 Advanced -> 7 Review`.
2. Disabled options remain visible and unselectable (`Run existing config` with no configs; `Live` when key missing).
3. Input contract keybindings are implemented as specified (including multiline submission rule and Stage-specific `Ctrl+C` semantics).
4. Config discovery pattern and sort behavior match spec.
5. Review commit semantics are exact: config write only on `Run now` or `Save config and exit`.
6. `Revise` always returns to Step 1 with preserved state for both entry paths; never mutates selected source config in place.
7. Debate semantics: turns per trial are `P * R + 1`, slot assignment sampled per trial/slot with replacement, parse/embed apply to final slot `A` output, intermediate turns persisted for audit.
8. Stage 2 hides worker table when `workers == 1` and supports graceful `Ctrl+C` stop with partial artifacts.
9. Stage 3 prints receipt, has no interactive post-run menu, and exits automatically.
10. Run mode (`Live`/`Mock`) remains runtime runner selection and does not mutate study-definition semantics.
11. Stage 1 setup exposes no transcript overlays or slash-command interaction surface.

Validation commands:

1. `npm run check:types`
2. `npm run check:schemas`
3. `npm run test:mock-run`
4. `npm run test:debate`
5. `npm run test:clustering`
6. `npm run test:embeddings`
7. `npm run test:verify`
8. `npm run test:ui`
9. `npm run test:pack`

Fail-before/pass-after evidence to capture:

1. transcript/slash-command default behavior evidence (before).
2. wizard-first stage captures for all steps (after).
3. graceful `Ctrl+C` dashboard -> receipt evidence.
4. Debate `P`/`R` run artifact evidence showing final-output parse/embed semantics and intermediate turn persistence.

## Idempotence and Recovery
1. Migration proceeds in milestone commits; each milestone is independently reversible via `git revert <commit>`.
2. Temporary coexistence is allowed only during implementation; completion criteria require default-flow cutover.
3. If Debate migration destabilizes runtime, freeze wizard protocol controls behind implemented contract gates and rollback protocol changes to prior milestone.
4. If dashboard rendering regresses, disable only dashboard rendering path while preserving headless run integrity.

## Interfaces and Dependencies
1. CLI routing: `src/cli/index.ts`, `src/cli/intent.ts`, `src/cli/help.ts`.
2. UI architecture: `src/ui/transcript/*` (legacy), new wizard modules under `src/ui/`.
3. Protocol/planning contracts: `schemas/config.schema.json`, `schemas/protocol.schema.json`, `src/planning/planner.ts`, `src/protocols/*`.
4. Runtime integration: `src/run/run-service.ts`, `src/events/types.ts`, `src/artifacts/*`.
5. Test surface: `scripts/tui-*.mjs`, `test/e2e/tui-pty.test.mjs`.

## Artifacts and Notes
Primary contract authority:

1. `docs/product-specs/tui-wizard.md`.
2. `docs/DESIGN.md` for architecture and claims boundaries.
3. `AGENTS.md` invariants for determinism/provenance/artifacts.

## Plan Change Notes
- 2026-02-19 00:00Z: initial draft created.
- 2026-02-19 00:00Z: strengthened after self-audit to explicitly include Debate `P`/`R` contract migration, test-script migration surface, and cutover risk controls.
- 2026-02-20 00:00Z: hardened with scope guardrails, milestone exit gates, and explicit no-overlay/no-slash acceptance criterion.
