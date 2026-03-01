# Align Internal Terminology to Monitoring and Groups

This ExecPlan is a living document and must be updated as work proceeds.
This plan follows `docs/PLANS.md`.

## Purpose / Big Picture
Remove remaining internal terminology drift between old `convergence/cluster` names and the stabilized `monitoring/groups` contract.

Observable outcomes:

1. internal schema/type/event names align with `monitoring` and `groups`.
2. emitted monitoring/group artifacts and consumer expectations use the same vocabulary.
3. scripts/tests no longer assert legacy `cluster_*` or `convergence.*` field/event names.

Scope guardrails:

1. in scope: internal schema names, generated type names, event names, runtime consumers, scripts/tests.
2. out of scope: config input contract rename (`measurement.clustering`, `cluster_limit`) and module-folder renames.

## Progress
- [x] (2026-03-01 22:30Z) initial plan drafted (`proposed`)
- [x] (2026-03-01 22:31Z) milestone 1 complete: schema files and schema fields renamed
- [x] (2026-03-01 22:31Z) milestone 2 complete: generated types/imports/event contracts aligned
- [x] (2026-03-01 22:32Z) milestone 3 complete: runtime writer/monitor/report/receipt/verify alignment complete
- [x] (2026-03-01 22:32Z) milestone 4 complete: scripts/tests/docs aligned and quality gates passing (`completed`)

## Context and Orientation
Reviewed:

1. `AGENTS.md` invariants (schema-first, determinism, artifact guarantees).
2. `docs/DESIGN.md` and `README.md` artifact language.
3. `schemas/convergence-trace.schema.json`, `schemas/cluster-assignment.schema.json`, `schemas/cluster-state.schema.json`, `schemas/aggregates.schema.json`.
4. `src/events/types.ts`, `src/config/schema-validation.ts`, `src/clustering/monitor.ts`, `src/artifacts/artifact-writer.ts`, `src/tools/report-run.ts`, `src/tools/verify-run.ts`, `src/ui/receipt-model.ts`, `src/ui/run-lifecycle-hooks.ts`.
5. affected scripts/tests under `scripts/` and `test/`.

Non-obvious terms:

1. monitoring record: batch-boundary run monitoring snapshot written to `monitoring.jsonl`.
2. group state/assignment: optional online grouping outputs in `groups/`.

## Plan of Work
Ordering principle: schema/file truth first, then generated/types/events, then runtime consumers, then tests and docs.

Milestones:

1. Milestone 1: rename schemas and field vocabulary.
2. Milestone 2: regenerate types and align imports/event payload contracts.
3. Milestone 3: update runtime and consumer code paths.
4. Milestone 4: update scripts/tests/docs and validate.

Milestone exit gates:

1. Milestone 1 exit: old schema filenames are retired from `schemas/` and replacements validate.
2. Milestone 2 exit: no imports from `convergence-trace.types`, `cluster-assignment.types`, or `cluster-state.types` remain.
3. Milestone 3 exit: runtime writes/reads monitoring and groups using renamed record fields/events.
4. Milestone 4 exit: full quality gates pass and `rg` shows no active legacy term usage outside intentional historical notes.

## Concrete Steps
Working directory: repository root.

1. Rename schema files and field names to monitoring/groups terminology.
2. Update `package.json` `gen:types` targets and regenerate types.
3. Refactor event names/payload types:
   - `convergence.record` -> `monitoring.record`
   - `cluster.assigned` -> `group.assigned`
   - `clusters.state` -> `groups.state`
4. Refactor runtime references for renamed fields (`group_count`, `group_distribution`, etc.).
5. Update scripts/tests and docs references impacted by renamed fields/events.
6. Run quality gates:
   - `npm run check:types`
   - `npm run check:schemas`
   - `npm run test:mock-run`
   - `npm run test:verify`
   - `npm run test:clustering`
   - `npm run test:ui`
   - `npm run test:unit`
   - `npm run test:e2e:tui`

## Validation and Acceptance
Acceptance criteria:

1. monitoring schema/type/event terminology is consistent (`monitoring`, not `convergence`).
2. group schema/type/event terminology is consistent (`group(s)`, not `cluster(s)`).
3. `monitoring.jsonl` records validate under the renamed monitoring schema.
4. `groups/assignments.jsonl` and `groups/state.json` validate under renamed group schemas.
5. reporting, receipt, and dashboard consumers use renamed monitoring/group fields.
6. all listed validation commands pass.

## Idempotence and Recovery
1. Schema/type regeneration is deterministic and re-runnable.
2. If runtime refactor fails, rollback to the prior commit and reapply milestone-by-milestone.
3. Keep file rename and event rename changes in one atomic commit to avoid half-migrated states.

## Plan Change Notes
- 2026-03-01 22:30Z: initial plan created from post-rewrite repo audit findings.
- 2026-03-01 22:32Z: completed schema/type/event/runtime/test alignment; retained config input `measurement.clustering` as intentionally out of scope.
