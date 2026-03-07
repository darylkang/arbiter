# Schema Substance Alignment With Research Method Contract

## Purpose / Big Picture

The schema system is now structurally strong, but its substance still lags the current paper contract.

Arbiter already captures raw trials, provenance, embeddings, and operational monitoring well. The remaining weakness is that paper-critical meaning is either under-constrained or left untyped in the highest-value contract surfaces.

This ExecPlan aligns the schema layer with the current research-method contract without prematurely freezing unstable downstream analysis details.

The core outcomes are:

1. `Q(c)` becomes harder to specify in a semantically invalid way.
2. labeled-path assumptions become explicit at the contract level.
3. manifest summaries stop using open blobs where the current implementation already has stable structure.
4. measurement-significant settings become more legible and auditable.
5. the schema layer stops over-weighting operational monitoring relative to the paper's primary outputs.

## Scope Guardrails

### In scope

1. tighten schema validity for `Q(c)` and decode ranges,
2. strengthen decision-contract and question contracts for labeled evaluation,
3. type the current stable `manifest.measurement` and `manifest.metrics` shapes,
4. add the smallest justified new paper-facing schema artifacts if they are stable enough,
5. update runtime validation or resolver code only where required by the schema changes,
6. regenerate generated types and update schema-facing docs when semantics shift.

### Out of scope

1. implementing the full downstream analysis pipeline,
2. inventing speculative paper metrics not already frozen in `docs/RESEARCH-METHOD.md`,
3. replacing the operational monitoring system,
4. changing the heterogeneity ladder or research-method contract,
5. broad refactors outside schema-related codepaths.

### Sequencing constraints

1. schema changes come first,
2. generated types are regenerated immediately after schema edits,
3. runtime resolver/parser/artifact code is updated only as needed to satisfy the new contracts,
4. validation runs after all schema and runtime surfaces are consistent.

## Progress

- [x] 2026-03-07 UTC: re-read planning contract, research-method contract, schema policy docs, and the relevant runtime/schema files.
- [x] 2026-03-07 UTC: implemented schema substance alignment across config, question, contract, manifest, and analysis artifact schemas.
- [x] 2026-03-07 UTC: regenerated generated types and ran schema/contract validation.
- [in_progress] 2026-03-07 UTC: finalize documentation sync and commit the round.

## Surprises & Discoveries

1. The repo still has no typed analysis artifact layer for paper-facing outputs; the only stable paper-adjacent summary currently emitted by runtime is the run manifest.
2. `manifest.measurement` and `manifest.metrics` already have a concrete runtime structure in `src/artifacts/artifact-writer.ts`, so leaving them open in schema is no longer justified.
3. The strongest labeled-path gap is not only the decision contract; `question.schema.json` is too thin to preserve reference labels or adjudication provenance.
4. The most general paper estimand now depends on `M`, but a large fraction of `M` is still intentionally exploratory. That means the plan should tighten what is already stable rather than over-spec analysis internals.

## Decision Log

1. Do not add broad new analysis-output schemas in this round unless they are already stable and minimally specified.
   - Reason: the analysis pipeline itself is still intentionally separate and not yet fully frozen.
2. Tighten manifest summaries now.
   - Reason: the runtime already emits stable structure, so schema openness here is pure contract debt.
3. Strengthen labeled-path contracts now even though the free-form semantic path is central.
   - Reason: discrete-label evaluation remains the validation backbone for the strongest paper claims.
4. Prefer semantic validation in schema where practical, but avoid fragile overfitting.
   - Reason: `Q(c)` should not be allowed to validate while clearly failing to define a usable sampling distribution.
5. Add minimal downstream analysis schemas in this round.
   - Reason: per-instance analysis and ladder-comparison outputs are now stable enough in the research-method contract to deserve explicit names, even though the analysis pipeline remains separate from the harness runtime.

## Outcomes & Retrospective

Delivered in this round:

1. `config.schema.json` now enforces semantically meaningful weighted pools, ordered decode ranges, explicit measurement normalization/similarity/order fields, and finite label-space metadata on resolved decision contracts.
2. `question.schema.json` now carries optional labeled-evaluation metadata for ground truth, dataset identity, and adjudication provenance.
3. `decision-contract.schema.json` now requires finite label-space metadata, and the shipped binary decision contract now declares it explicitly.
4. `manifest.schema.json` now types the stable runtime summary shapes for `measurement` and `metrics` instead of leaving them open.
5. new paper-facing schemas were added for per-instance analysis and ladder-comparison outputs.
6. runtime code now hydrates the stronger decision-contract and measurement defaults and emits manifest summaries that satisfy the stricter contract.
7. schema docs and research/design docs were synced to the promoted analysis-artifact boundary.

Remaining gap after this round:

1. the downstream analysis pipeline itself is still separate and not yet implemented against the new paper-facing schemas.

## Context and Orientation

Relevant sources reviewed before planning:

1. `AGENTS.md`
   - establishes schema-first workflow, research-significant handling of `Q(c)` and `M`, and required validation.
2. `docs/PLANS.md`
   - governs ExecPlan structure and completion gates.
3. `docs/RESEARCH-METHOD.md`
   - defines the current paper contract, including `P_(Q,M)(y | x)`, the labeled validation backbone, and the analysis boundary.
4. `schemas/README.md`
   - defines the schema layer's role and the policy for operational versus paper-facing contracts.
5. `schemas/PAPER-ALIGNMENT.md`
   - records the current substance gaps and promotion rules.
6. `schemas/config.schema.json`
   - current `Q(c)` and `M` contract surface.
7. `schemas/manifest.schema.json`
   - current open summary contract debt.
8. `schemas/question.schema.json`, `schemas/decision-contract.schema.json`, `schemas/debate-decision-contract.schema.json`
   - current labeled-path and decision normalization weaknesses.
9. `src/config/resolve-config.ts`
   - hydrates resolved config and enforces some semantics not currently guaranteed by schema.
10. `src/config/schema-validation.ts`
   - current AJV configuration and validator compilation surface.
11. `src/artifacts/artifact-writer.ts`
   - actual manifest summary shape emitted today.
12. `src/protocols/debate-v1/parser.ts`
   - debate decision contract expectations.

High-risk surfaces:

1. generated type changes from schema edits,
2. resolver/runtime code that assumes current decision-contract or manifest shapes,
3. AJV capabilities if range-order constraints require `$data` or custom validation,
4. contract tests and verify/report flows that consume manifest summaries.

Key entry points and commands:

1. `npm run gen:types`
2. `npm run check:types`
3. `npm run check:schemas`
4. `npm run test:contracts`
5. `npm run test:verify`

## Plan of Work

1. add a minimal shared schema vocabulary for bounded ranges, positive-weight pools, finite label-space metadata, and manifest summary shapes,
2. tighten `config.schema.json` so current resolved configs better reflect valid `Q(c)` and stable measurement semantics,
3. strengthen decision-contract and question schemas to make labeled evaluation contracts explicit,
4. type `manifest.measurement` and `manifest.metrics` to match the stable runtime shape,
5. add only the minimum new schema artifacts justified by the frozen paper contract,
6. update runtime code where the new contracts require additional fields or validator behavior,
7. regenerate types, validate, and sync docs if semantics moved.

## Milestones and Gates

Ordering principle: dependency order from core contract surfaces outward.

### M1: Tighten existing core contracts

Outcome:
- `config`, `decision-contract`, `question`, and `manifest` schemas better match the current paper contract.

Entry condition:
- current schema/runtime gaps confirmed.

Exit evidence:
- schema files updated,
- runtime updated if needed,
- generated types regenerate cleanly.

Rollback boundary:
- schema and directly-coupled runtime changes only.

### M2: Add minimal paper-facing contract surface

Outcome:
- any newly justified paper-facing schema artifacts exist and are registered.

Entry condition:
- M1 stable and no unnecessary speculative schema scope.

Exit evidence:
- registry updated,
- generated types exist,
- docs reflect the promoted objects.

Rollback boundary:
- newly added schema files and dependent docs only.

### M3: Validation and closure

Outcome:
- schema system and dependent contract tests pass,
- plan state and docs are current,
- changes committed.

Entry condition:
- all contract edits in place.

Exit evidence:
- `npm run gen:types`
- `npm run check:types`
- `npm run check:schemas`
- `npm run test:contracts`
- `npm run test:verify` if manifest or artifact semantics changed materially.

Rollback boundary:
- no additional schema semantics introduced after validation starts.

## Concrete Steps

1. update `schemas/config.schema.json` to:
   - enforce valid decode ranges,
   - require semantically meaningful weighted pools,
   - strengthen the measurement/decision-contract surface where stability already exists.
2. update `schemas/decision-contract.schema.json` and `schemas/debate-decision-contract.schema.json` to make finite label-space assumptions legible without breaking the free-form semantic path.
3. update `schemas/question.schema.json` to carry labeled-evaluation metadata in a stable optional structure.
4. update `schemas/manifest.schema.json` to replace open `measurement` and `metrics` blobs with explicit current shapes.
5. decide whether one minimal new paper-facing schema artifact should be introduced in this round; add it only if it has stable semantics now.
6. update `resources/contracts/binary_decision_v1.json` and any runtime code that hydrates or validates decision contracts.
7. update AJV configuration only if the chosen schema constraints require it.
8. regenerate generated types and fix downstream type/runtime issues.
9. update schema docs if the promoted contract boundary moved.

## Validation and Acceptance

Acceptance criteria:

1. schema-valid configs can no longer obviously fail to define a usable weighted sampling distribution.
2. labeled-path contracts make finite normalized label semantics explicit.
3. `manifest.measurement` and `manifest.metrics` are explicitly typed and validate against current runtime output.
4. any new stable paper-facing schema artifacts are registered and generated.
5. docs and runtime stay consistent with `docs/RESEARCH-METHOD.md`.

Validation commands:

1. `npm run gen:types`
2. `npm run check:types`
3. `npm run check:schemas`
4. `npm run test:contracts`
5. `npm run test:verify`

Expected evidence:

1. generated type files update only from schema changes,
2. AJV compilation succeeds in strict mode,
3. contract tests continue to pass,
4. verify/report flows do not fail on the tighter manifest contract.

## Idempotence and Recovery

1. schema edits are deterministic and can be re-applied safely.
2. generated files are reproducible via `npm run gen:types`.
3. if a schema tightening causes widespread runtime/test failure, first revert the specific contract addition that introduced the mismatch rather than loosening unrelated fields.
4. if new paper-facing schema additions prove premature, remove them and keep the current round focused on tightening existing stable surfaces.

## Interfaces and Dependencies

1. `schemas/*.schema.json`
2. `src/config/schema-registry.ts`
3. `src/config/schema-validation.ts`
4. `src/config/resolve-config.ts`
5. `src/artifacts/artifact-writer.ts`
6. `src/protocols/debate-v1/parser.ts`
7. `resources/contracts/binary_decision_v1.json`
8. `src/generated/*`

## Handoffs and Ownership

This round owns only schema-adjacent contract changes and minimal runtime updates required to satisfy them.

A follow-on round should own any broader analysis-pipeline or new artifact-production work if new paper-facing schemas are added but not yet emitted by the harness.

## Artifacts and Notes

Primary evidence files for this round:

1. `docs/RESEARCH-METHOD.md`
2. `schemas/README.md`
3. `schemas/PAPER-ALIGNMENT.md`
4. `src/artifacts/artifact-writer.ts`

## Plan Change Notes

- 2026-03-07 UTC: plan created after the research-method and schema-alignment docs were updated and the schema substance audit identified the remaining contract gaps.
- 2026-03-07 UTC: expanded scope to include the minimum stable paper-facing analysis schemas (`instance-analysis` and `ladder-comparison`) once it became clear that leaving all paper outputs outside the schema layer would preserve the main alignment gap.
