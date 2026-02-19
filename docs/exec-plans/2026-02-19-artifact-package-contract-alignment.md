# Align Run Artifact Package to Final Contract

This ExecPlan is a living document and must be updated as work proceeds.
This plan follows `docs/PLANS.md`.

## Purpose / Big Picture
Stabilize Arbiter's run artifact package so schemas, runtime writes, manifest listings, verifier checks, report tooling, and docs all describe the same truth.

This plan remains blocked until product decisions from the ongoing artifact-package design pass are finalized.

Observable user outcomes:

1. artifact expectations in docs match files actually written.
2. verifier/report outputs are contract-consistent with runtime behavior.
3. edge cases (zero eligible, graceful interrupt, resolve-only, failures) are explicitly and truthfully represented.
4. no documented-but-missing or hidden-but-undocumented artifacts remain.

## Progress
- [x] (2026-02-19 00:00Z) initial plan drafted (`blocked`, pending artifact package decisions)
- [ ] (2026-02-19 00:00Z) milestone 0 complete: decision log populated with final artifact matrix
- [ ] (2026-02-19 00:00Z) milestone 1 complete: schemas and generated types aligned
- [ ] (2026-02-19 00:00Z) milestone 2 complete: writer/finalizer behavior aligned
- [ ] (2026-02-19 00:00Z) milestone 3 complete: manifest/verifier/report alignment complete
- [ ] (2026-02-19 00:00Z) milestone 4 complete: docs and acceptance evidence captured (`completed`)

## Surprises & Discoveries
- Observation: `config.source.json` is currently documented as required but is not emitted by runtime.
  Evidence: `README.md`, `docs/DESIGN.md`, `src/artifacts/artifact-writer.ts`, `src/run/run-service.ts`.
- Observation: some artifacts are generated through lifecycle hooks (`receipt.txt`, `execution.log`) and vary by TTY/quiet/receipt mode.
  Evidence: `src/ui/run-lifecycle-hooks.ts`.
- Observation: resolve-only artifact semantics are already enforced in verifier but differ from executed-run contract.
  Evidence: `src/tools/verify-run.ts`, `src/artifacts/resolve-artifacts.ts`.

## Decision Log
- Decision: keep this plan blocked until artifact package decisions from design review are finalized.
  Rationale: avoids churn across schema/writer/verifier/docs with unstable requirements.
  Date/Author: 2026-02-19, Codex thread.
- Pending decisions required before implementation:
  1. whether `config.source.json` is mandatory and exact semantics.
  2. mandatory vs conditional status for `receipt.txt` and `execution.log`.
  3. canonical artifact list by run class (success, interrupt, failure, resolve-only).
  4. zero-eligible embeddings contract details and explanatory notes.

## Context and Orientation
Reviewed before plan finalization:

1. `AGENTS.md` for artifact invariants and schema-first workflow.
2. `README.md` and `docs/DESIGN.md` artifact contracts.
3. `schemas/manifest.schema.json` and related artifact schemas.
4. `src/artifacts/artifact-writer.ts`, `src/artifacts/manifest-builder.ts`, `src/embeddings/finalize.ts`.
5. `src/run/run-service.ts` and `src/engine/run-orchestrator.ts` lifecycle behavior.
6. `src/tools/verify-run.ts`, `src/tools/report-run.ts`, `src/ui/receipt-model.ts`.
7. run directories under `runs/` for empirical artifact shape checks.

Non-obvious terms:

1. always artifact: required for executed runs regardless of stop reason.
2. conditional artifact: emitted only under specific runtime conditions.
3. resolve-only run: run directory created from config resolution without execution artifacts.

High-risk components:

1. schema/writer/verifier drift causing false verification failures or silent contract breakage.
2. partial/interrupt runs producing inconsistent or misleading artifact sets.
3. cleanup paths (debug embeddings jsonl retention/removal) diverging from manifest listing rules.

## Plan of Work
Ordering principle: decision freeze, then schema truth, then runtime behavior, then consumer alignment.

1. Finalize artifact matrix by run class and lifecycle condition.
2. Apply schema-first updates and regenerate types.
3. Align writers/finalizers and manifest entries to schema contract.
4. Align verifier/report/receipt consumers.
5. Align docs and tests with fail-before/pass-after evidence.

Milestones:

1. Milestone 0: artifact policy matrix frozen.
2. Milestone 1: schema/type alignment.
3. Milestone 2: writer/finalizer alignment.
4. Milestone 3: manifest/verifier/report alignment.
5. Milestone 4: docs/tests acceptance alignment.

## Concrete Steps
Working directory: repository root.

1. Build and check in an artifact contract matrix document.
   Command: `rg -n "config\.source|config\.resolved|manifest|trial_plan|trials|parsed|convergence_trace|aggregates|embeddings|receipt|execution\.log|resolve_only" src docs schemas -S`
   Expected evidence: one authoritative matrix (always/conditional/forbidden by run class).
2. Update schemas first and regenerate generated types.
   Commands:
   - `npm run gen:types`
   - `npm run check:schemas`
   Expected evidence: type generation is clean and schema validation passes.
3. Align runtime writer/finalizer behavior and manifest entry construction.
   Command: `rg -n "buildArtifactEntries|writeJsonAtomic|ensureEmbeddingsProvenance|artifact\.written|cleanupDebugArtifacts" src/artifacts src/embeddings src/run src/ui -S`
   Expected evidence: actual files + manifest entries match matrix in all run classes.
4. Align verifier and report logic.
   Command: `rg -n "verifyResolveOnlySemantics|artifact exists|allowedArtifacts|buildReportModel|buildReceiptModel" src/tools src/ui -S`
   Expected evidence: verifier and report expectations match runtime truth.
5. Add or update tests for normal, zero-eligible, graceful interrupt, run failure, and resolve-only.
   Commands:
   - `npm run test:verify`
   - `npm run test:mock-run`
   - `npm run test:embeddings`
   - `npm run test:clustering`
   - `npm run test:unit`
   Expected evidence: deterministic passing coverage for all artifact classes.

## Validation and Acceptance
Behavioral acceptance criteria:

1. Each run class emits exactly the documented artifact set.
2. Manifest artifact entries correspond to files that exist on disk.
3. Zero-eligible runs still emit valid embeddings provenance and truthful explanatory metadata.
4. Resolve-only runs emit only resolve-only artifacts.
5. `config.source.json` contract is explicitly and consistently implemented or explicitly removed from docs/spec.
6. verify/report/receipt tooling no longer encodes stale artifact assumptions.

Validation commands:

1. `npm run check:types`
2. `npm run check:schemas`
3. `npm run test:mock-run`
4. `npm run test:verify`
5. `npm run test:embeddings`
6. `npm run test:clustering`
7. `npm run test:unit`

Fail-before/pass-after evidence to capture:

1. existing mismatch examples (before).
2. matrix-compliant run directories and verifier output (after).

## Idempotence and Recovery
1. Schema and generated-type updates are deterministic and re-runnable.
2. Milestone commits provide rollback boundaries.
3. If writer changes regress, rollback runtime milestone and retain schema/doc updates only if still truthful.
4. If verifier strictness regresses, freeze writer behavior and patch verifier against explicit fixtures.

## Interfaces and Dependencies
1. Schemas: `schemas/*.schema.json`.
2. Generated types: `src/generated/*`.
3. Runtime writers: `src/artifacts/*`, `src/embeddings/finalize.ts`, `src/run/run-service.ts`.
4. Consumers: `src/tools/verify-run.ts`, `src/tools/report-run.ts`, `src/ui/receipt-model.ts`.

## Artifacts and Notes
Dependency note:

1. Do not start implementation until milestone-0 decisions are entered in Decision Log.
2. This plan should run after CLI contract and wizard cutover stabilize to avoid concurrent contract churn.

## Plan Change Notes
- 2026-02-19 00:00Z: initial draft created in blocked state.
- 2026-02-19 00:00Z: strengthened after self-audit with explicit decision checklist and run-class matrix approach.
