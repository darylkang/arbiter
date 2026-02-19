# Align Run Artifact Package to Final Contract

This ExecPlan is a living document and must be updated as work proceeds.
This plan follows `docs/PLANS.md`.

## Purpose / Big Picture
Stabilize Arbiter's run artifact package so it is internally consistent across schemas, writer behavior, verify/report tools, and user-facing docs. The end state is a single truthful contract for what is always emitted, conditionally emitted, and never emitted, including zero-eligible and interrupted runs.

Observable user outcomes:

1. artifact expectations in docs match files actually written by runtime.
2. verify/report tools enforce the same contract used by writer and schemas.
3. provenance and reproducibility guarantees are explicit and test-backed.
4. no ambiguous or stale artifact references remain (for example documented-but-missing files).

## Progress
- [x] (2026-02-19 00:00Z) initial plan drafted (`blocked`, pending artifact package decisions)
- [ ] (2026-02-19 00:00Z) milestone 1 complete: final artifact policy decisions captured
- [ ] (2026-02-19 00:00Z) milestone 2 complete: schemas and generated types aligned
- [ ] (2026-02-19 00:00Z) milestone 3 complete: writer/finalizer behavior aligned
- [ ] (2026-02-19 00:00Z) milestone 4 complete: verify/report/lifecycle hooks aligned
- [ ] (2026-02-19 00:00Z) milestone 5 complete: docs/tests acceptance evidence captured (`completed`)

## Surprises & Discoveries
- Observation: `config.source.json` is documented but currently not written by implementation.
  Evidence: `README.md`, `docs/DESIGN.md`, `src/artifacts/artifact-writer.ts`, `src/run/run-service.ts`.
- Observation: some artifact writes are lifecycle-hook driven (`receipt.txt`, `execution.log`) and may vary by run mode/TTY.
  Evidence: `src/ui/run-lifecycle-hooks.ts`.

## Decision Log
- Decision: keep this plan blocked until Breezy-led artifact package decisions are finalized.
  Rationale: prevents premature code churn and schema changes against unsettled contract boundaries.
  Date/Author: 2026-02-19, Codex thread.

## Context and Orientation
Reviewed before plan draft:

1. `AGENTS.md` for artifact invariants and schema-first workflow.
2. `README.md` and `docs/DESIGN.md` for stated run-directory contract.
3. `src/artifacts/artifact-writer.ts` and `src/artifacts/manifest-builder.ts` for actual writes/listing.
4. `src/run/run-service.ts` and `src/engine/run-orchestrator.ts` for lifecycle finalization paths.
5. `src/tools/verify-run.ts` and `src/tools/report-run.ts` for downstream contract enforcement.
6. artifact schemas in `schemas/` for shape-level truth.

Non-obvious terms:

1. Always artifact: required for executed runs irrespective of mode/result class.
2. Conditional artifact: emitted only when specific runtime conditions hold.
3. Resolve-only run: planning/resolve mode that intentionally omits execution artifacts.

High-risk components:

1. schema-writer-verifier mismatch causing false positives/false negatives.
2. partial-run and interrupt semantics creating inconsistent artifact sets.
3. debug artifact retention/cleanup affecting provenance expectations.

## Plan of Work
Ordering principle: decision freeze first, then schema and implementation convergence.

1. Capture final artifact package decisions and edge-case rules.
2. Align schemas and generated types first.
3. Align runtime writers/finalizers and manifest entries.
4. Align verify/report tools and receipt/lifecycle outputs.
5. Align docs and tests with fail-before/pass-after evidence.

Milestones:

1. Milestone 1: artifact contract freeze.
2. Milestone 2: schema/type alignment.
3. Milestone 3: writer and finalization alignment.
4. Milestone 4: verifier/reporter alignment.
5. Milestone 5: documentation and acceptance evidence.

## Concrete Steps
Working directory: repository root.

1. Record final artifact policy matrix (always/conditional/prohibited; by mode and stop reason).
   Command: `rg -n "config\.source|config\.resolved|manifest|trial_plan|trials|parsed|convergence_trace|aggregates|embeddings|receipt|execution\.log" src docs schemas -S`
   Expected evidence: explicit contract matrix checked into docs.
2. Update schemas first and regenerate types.
   Commands:
   - `npm run gen:types`
   - `npm run check:schemas`
   Expected evidence: `schemas/*` and `src/generated/*` are consistent.
3. Update artifact writer/finalization paths and manifest entry construction.
   Command: `rg -n "buildArtifactEntries|writeJsonAtomic|createJsonlWriter|embeddings\.finalized|artifact\.written" src/artifacts src/run src/ui -S`
   Expected evidence: emitted files and manifest entries match contract matrix.
4. Update verification/reporting logic to same contract.
   Command: `rg -n "verifyRunDir|allowedArtifacts|artifact exists|report" src/tools -S`
   Expected evidence: verifier checks precisely enforce finalized contract.
5. Add or update artifact-focused tests for normal, zero-eligible, interrupted, and resolve-only runs.
   Commands:
   - `npm run test:verify`
   - `npm run test:mock-run`
   - `npm run test:embeddings`
   - `npm run test:clustering`
   Expected evidence: deterministic pass across artifact scenarios.

## Validation and Acceptance
Behavioral acceptance criteria:

1. Each run mode/stop class emits exactly the documented artifact set.
2. Manifest artifact entries match actual files on disk.
3. Zero-eligible runs still emit valid embeddings provenance and truthful notes.
4. Resolve-only runs emit only resolve-only artifacts.
5. `config.source.json` behavior is explicitly decided and implemented/documented consistently.
6. Verify/report tools agree with writer semantics (no contract drift).

Validation commands:

1. `npm run check:types`
2. `npm run check:schemas`
3. `npm run test:mock-run`
4. `npm run test:verify`
5. `npm run test:embeddings`
6. `npm run test:clustering`

Fail-before/pass-after evidence to capture:

1. mismatch examples (before).
2. matching manifest/files/verifier status (after).

## Idempotence and Recovery
1. Schema-first edits are repeatable and regenerate deterministically.
2. Use milestone commits for safe rollback.
3. If writer changes regress, rollback to previous milestone and re-apply with targeted tests.
4. If verifier becomes too strict/loose, keep writer semantics stable and patch verifier with explicit fixtures.

## Interfaces and Dependencies
1. Schemas: `schemas/*.schema.json`.
2. Generated types: `src/generated/*` (generated-only).
3. Writers/finalizers: `src/artifacts/*`, `src/embeddings/finalize.ts`, `src/run/run-service.ts`.
4. Consumers: `src/tools/verify-run.ts`, `src/tools/report-run.ts`, `src/ui/receipt-model.ts`.

## Artifacts and Notes
Dependency note:

1. This plan intentionally follows artifact package decisions from ongoing design discussions.
2. Do not begin implementation until contract decisions are captured in this plan's Decision Log.

## Plan Change Notes
- 2026-02-19 00:00Z: initial draft created in `blocked` state pending final artifact-package decisions.
