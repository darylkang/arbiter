# Align Run Artifact Package to Final Contract

This ExecPlan is a living document and must be updated as work proceeds.
This plan follows `docs/PLANS.md`.

## Purpose / Big Picture
Stabilize Arbiter's run artifact package so schemas, runtime writes, manifest listings, verifier checks, report tooling, and docs all describe the same truth.

Observable user outcomes:

1. artifact expectations in docs match files actually written.
2. verifier/report outputs are contract-consistent with runtime behavior.
3. edge cases (zero eligible, graceful interrupt, resolve-only, failures) are explicitly and truthfully represented.
4. no documented-but-missing or hidden-but-undocumented artifacts remain.

Scope guardrails:

1. in scope: artifact contracts, writer/finalizer behavior, verifier/report alignment, and documentation truthfulness.
2. out of scope: unrelated UI redesign and non-artifact CLI surface changes.

## Progress
- [x] (2026-02-19 00:00Z) initial plan drafted (`proposed`)
- [x] (2026-02-20 00:00Z) milestone 0 complete: decision log populated with final artifact matrix
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
- Decision: adopt a consolidated v1 artifact pack with seven always-produced executed-run artifacts:
  - `config.source.json`
  - `config.resolved.json`
  - `manifest.json`
  - `trial_plan.jsonl`
  - `trials.jsonl`
  - `monitoring.jsonl` (rename from `convergence_trace.jsonl`)
  - `receipt.txt`
  Rationale: preserves reproducibility/auditability while reducing contract sprawl.
  Date/Author: 2026-02-20, Daryl + Breezy synthesis captured by Codex.
- Decision: fold `parsed.jsonl` into canonical per-trial rows in `trials.jsonl`.
  Rationale: remove mandatory joins and keep one canonical per-trial record.
  Date/Author: 2026-02-20, Daryl + Breezy synthesis captured by Codex.
- Decision: fold run-level summary metrics and embedding provenance summary into `manifest.json`.
  Rationale: `aggregates.json` and `embeddings.provenance.json` are redundant as separate required artifacts.
  Date/Author: 2026-02-20, Daryl + Breezy synthesis captured by Codex.
- Decision: standardize embeddings fallback behavior at run root as `embeddings.jsonl`.
  Rationale: clearer fallback contract than conditional `debug/embeddings.jsonl` retention.
  Date/Author: 2026-02-20, Daryl + Breezy synthesis captured by Codex.
- Decision: prefer `groups/` and group terminology over `clusters/` in user-facing and artifact naming.
  Rationale: align language with interpretation boundaries and product copy rules.
  Date/Author: 2026-02-20, Daryl + Breezy synthesis captured by Codex.
- Decision: `execution.log` is debug-only and not part of the core scientific record.
  Rationale: preserve clean research-grade core pack; keep diagnostics optional.
  Date/Author: 2026-02-20, Daryl + Breezy synthesis captured by Codex.
- Decision: verifier and reporting logic must distinguish executed runs, resolve-only runs, and pre-start failures as separate run classes.
  Rationale: avoids false negatives from applying executed-run completeness checks to non-executed directories.
  Date/Author: 2026-02-20, Codex consolidation.

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

Milestone entry and exit gates:

1. Milestone 1 exit gate: schemas encode canonical artifact names and generated types are refreshed without drift.
2. Milestone 2 exit gate: runtime writes and manifest entries match contract for normal completion, graceful interrupt, and zero-eligible cases.
3. Milestone 3 exit gate: verifier/report semantics align with run classes and do not enforce executed-run completeness on resolve-only runs.
4. Milestone 4 exit gate: docs and regression tests assert the same artifact matrix and legacy required names are fully retired.

## Concrete Steps
Working directory: repository root.

1. Build and check in an artifact contract matrix document.
   Command: `rg -n "config\.source|config\.resolved|manifest|trial_plan|trials|monitoring|embeddings\.arrow|embeddings\.jsonl|groups/|receipt|debug/|resolve_only" src docs schemas -S`
   Expected evidence: one authoritative matrix (always/conditional/forbidden by run class).
2. Update schemas first and regenerate generated types.
   Commands:
   - `npm run gen:types`
   - `npm run check:schemas`
   Expected evidence: type generation is clean and schema validation passes.
3. Align runtime writer/finalizer behavior and manifest entry construction.
   Command: `rg -n "buildArtifactEntries|writeJsonAtomic|artifact\.written|cleanupDebugArtifacts|convergence_trace|monitoring|clusters/|groups/" src/artifacts src/embeddings src/run src/ui -S`
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
3. Zero-eligible runs still emit truthful embedding measurement notes in `manifest.json`.
4. Resolve-only runs emit only resolve-only artifacts.
5. `config.source.json` contract is explicitly and consistently implemented.
6. verify/report/receipt tooling no longer encodes stale artifact assumptions.
7. `trials.jsonl` includes parse and embedding summaries so `parsed.jsonl` is not required.
8. legacy artifact names are removed from required-file expectations (`convergence_trace.jsonl`, `aggregates.json`, `embeddings.provenance.json`, `clusters/*`).
9. run-class-specific verification rules do not produce false failures for resolve-only or pre-start-failure directories.

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

1. this plan should run after CLI contract and wizard cutover stabilize to avoid concurrent contract churn.
2. implementation remains paused until explicit execution instruction.

## Plan Change Notes
- 2026-02-19 00:00Z: initial draft created in blocked state.
- 2026-02-19 00:00Z: strengthened after self-audit with explicit decision checklist and run-class matrix approach.
- 2026-02-20 00:00Z: milestone-0 decisions recorded from Daryl/Breezy artifact consolidation direction; plan status moved from blocked to proposed.
- 2026-02-20 00:00Z: added explicit scope guardrails, run-class decision, and milestone exit gates.
