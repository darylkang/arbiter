# Rewrite Wizard UI Architecture to Strict Linear Flow

This ExecPlan is a living document and must be updated as work proceeds.
This plan follows `docs/PLANS.md`.

## Purpose / Big Picture
Deliver a clean-cutover Wizard TUI that matches `docs/product-specs/tui-wizard.md`: strict linear Stage 1 intake, Stage 2 dashboard run monitoring, and Stage 3 receipt printout with automatic exit. The transcript-style interaction model, slash-command routing, and post-run menu are removed from the default human UX.

Observable user outcomes:

1. `arbiter` in TTY launches a step-based wizard, not a transcript shell.
2. Setup is single-active-step with explicit Back/Next behavior and validation gates.
3. Review is the only config commit point; config writes occur only on explicit commit actions.
4. Run monitoring is in-place dashboard UI with graceful `Ctrl+C` stop semantics.
5. Receipt prints once and the process exits without a next-action menu.

## Progress
- [x] (2026-02-19 00:00Z) initial plan drafted (`proposed`)
- [ ] (2026-02-19 00:00Z) milestone 1 complete: wizard shell + stage router scaffolded
- [ ] (2026-02-19 00:00Z) milestone 2 complete: Stage 1 strict linear intake implemented
- [ ] (2026-02-19 00:00Z) milestone 3 complete: Stage 2 dashboard implemented with graceful interrupt
- [ ] (2026-02-19 00:00Z) milestone 4 complete: Stage 3 receipt auto-exit implemented
- [ ] (2026-02-19 00:00Z) milestone 5 complete: transcript-era UX paths removed from default flow
- [ ] (2026-02-19 00:00Z) milestone 6 complete: tests and acceptance evidence captured (`completed`)

## Surprises & Discoveries
- Observation: current implementation still contains transcript/slash-command UI and command handlers in `src/ui/transcript/` and `src/cli/index.ts`.
  Evidence: `src/ui/transcript/commands/*`, `src/cli/index.ts`.
- Observation: docs specify `config.source.json`, but current artifact implementation does not produce it.
  Evidence: `src/artifacts/artifact-writer.ts`, `src/run/run-service.ts`.

## Decision Log
- Decision: implement a new wizard-first UI architecture instead of incrementally mutating transcript components.
  Rationale: transcript abstractions encode interaction assumptions (free-form command loop, overlays, post-run command menu) that conflict with strict linear UX and increase regression risk.
  Date/Author: 2026-02-19, Codex thread.
- Decision: retain engine/event/artifact boundaries and keep UI downstream-only.
  Rationale: preserves determinism/provenance invariants and limits semantic regression.
  Date/Author: 2026-02-19, Codex thread.

## Context and Orientation
Reviewed before plan finalization:

1. `AGENTS.md` for project invariants and planning workflow.
2. `README.md` for current CLI and run-directory contract language.
3. `docs/DESIGN.md` for architecture boundaries and semantics.
4. `docs/PLANS.md` for ExecPlan structure and requirements.
5. `docs/product-specs/tui-wizard.md` for accepted UX contract.
6. `src/cli/index.ts` and `src/cli/commands.ts` for entrypoint behavior.
7. `src/ui/transcript/*` for current TUI flow.
8. `src/run/run-service.ts`, `src/engine/*`, `src/artifacts/*` for run lifecycle coupling points.

Non-obvious terms used in this plan:

1. Stage 1: intake wizard (steps 0-7) that produces an in-memory study config.
2. Stage 2: live run dashboard that subscribes to run events and surfaces progress.
3. Stage 3: final receipt printout with immediate process exit.
4. Commit point: the first write of wizard-generated config to disk, only at Review action.

Entry points and high-risk components:

1. `src/cli/index.ts` default `arbiter` dispatch logic.
2. `src/ui/transcript/app.ts` and transcript command registry (legacy flow to remove from default path).
3. `src/ui/run-lifecycle-hooks.ts` receipt/log behavior, currently tied to lifecycle hooks.
4. `src/run/run-service.ts` signal handling and graceful-stop plumbing.

## Plan of Work
Ordering principle: architectural dependency and blast-radius control.

1. Establish new wizard shell and stage router before touching deep step logic.
2. Implement Stage 1 strict-linear state machine and validation rules before Review commit behaviors.
3. Implement Stage 2 dashboard against existing bus events without engine semantic changes.
4. Implement Stage 3 receipt rendering and auto-exit contract.
5. Cut default CLI routing over to new wizard path and retire transcript defaults.
6. Add focused tests at each layer before broad cleanup.

Milestones:

1. Milestone 1: Wizard architecture scaffold.
2. Milestone 2: Stage 1 step contracts and Review commit semantics.
3. Milestone 3: Stage 2 dashboard and graceful stop behavior.
4. Milestone 4: Stage 3 receipt contract and exit semantics.
5. Milestone 5: Legacy transcript decoupling from default UX.
6. Milestone 6: Validation, regression tests, and acceptance capture.

## Concrete Steps
Working directory: repository root.

1. Create wizard UI module structure and state-machine core.
   Command: `mkdir -p src/ui/wizard/{core,steps,components,state}`
   Expected evidence: new files under `src/ui/wizard/` with stage reducer and typed state.
2. Add explicit keybinding and focus contract implementation for Stage 1.
   Command: `rg -n "key|focus|step|validation" src/ui/wizard -S`
   Expected evidence: single authoritative input map and per-step validation gates.
3. Implement Step 0-7 flows including entry-path split and Review action matrix.
   Command: `rg -n "Run existing config|Create new study|Review|Revise|Save config" src/ui/wizard -S`
   Expected evidence: deterministic routing for both entry paths and preserved in-memory state.
4. Integrate Stage 2 dashboard rendering from run events.
   Command: `rg -n "worker\.status|batch\.completed|run\.completed|run\.failed" src/ui -S`
   Expected evidence: dashboard regions map to existing event payloads without engine modifications.
5. Implement Stage 3 receipt print and auto-exit behavior.
   Command: `rg -n "receipt|auto-exit|scrollback|process\.exit" src/ui -S`
   Expected evidence: receipt visible in terminal output, no post-run menu interaction.
6. Rewire CLI default TTY path to new wizard and remove transcript-first default behavior.
   Command: `rg -n "launchTranscriptTUI|wizard" src/cli -S`
   Expected evidence: default `arbiter` TTY dispatch goes to new wizard entry.
7. Add and run tests.
   Commands:
   - `npm run check:types`
   - `npm run test:ui`
   - `npm run test:mock-run`
   - `npm run test:debate`
   Expected evidence: passing suite plus new tests asserting strict step order and receipt auto-exit.

## Validation and Acceptance
Behavioral acceptance criteria:

1. Wizard step order is exactly `0->1->2->3->4->5->6->7` with one active step at a time.
2. Disabled options remain visible and unselectable (`Run existing config` with no configs, `Live` without key).
3. Keybindings satisfy input contract from `docs/product-specs/tui-wizard.md`.
4. Review writes config only on explicit commit actions.
5. Existing-config `Run now` does not mutate source file in place.
6. Stage 2 `Ctrl+C` triggers graceful stop and still reaches receipt output.
7. Stage 3 has no next-action menu and exits automatically after receipt.
8. Engine determinism/provenance/artifact semantics remain unchanged except UI-driven wiring needed for contracts.

Validation commands:

1. `npm run check:types`
2. `npm run check:schemas`
3. `npm run test:ui`
4. `npm run test:mock-run`
5. `npm run test:debate`
6. `npm run test:verify`

Fail-before/pass-after evidence to capture:

1. prior transcript default launch evidence (before).
2. wizard-first launch evidence with step captures (after).
3. `Ctrl+C` dashboard stop -> receipt evidence.

## Idempotence and Recovery
1. Wizard scaffolding and step modules are safe to re-run and refine without touching engine semantics.
2. Recovery point after each milestone commit; rollback is `git revert <commit>` at milestone boundaries.
3. If stage routing regresses, restore previous milestone commit and re-apply incrementally.
4. If event mapping causes UI instability, disable dashboard rendering path while preserving headless run path.

## Interfaces and Dependencies
1. Run orchestration interface: `src/run/run-service.ts` (`runMockService`, `runLiveService`, lifecycle hooks).
2. Event interface: `src/events/types.ts`, bus subscribers for progress and receipt.
3. Artifact side effects: `src/ui/run-lifecycle-hooks.ts`, `src/ui/receipt-writer.ts`, `src/ui/execution-log.ts`.
4. CLI routing: `src/cli/index.ts`, `src/cli/help.ts`.

## Artifacts and Notes
Primary spec authority for UX behavior:

1. `docs/product-specs/tui-wizard.md`.
2. `docs/DESIGN.md` sections on boundaries and claims discipline.

## Plan Change Notes
- 2026-02-19 00:00Z: initial draft created; sequenced ahead of CLI and artifact hardening due to largest architecture shift.
