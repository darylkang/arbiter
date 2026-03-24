# Independent Prompt ID Rename

## Purpose / Big Picture

Remove the remaining `independent` / `independent` suffixes from the independent protocol assets and related references so the repo no longer carries version-suffixed canonical names for the current protocol family.

This is narrower than the debate rename because `protocol.type` is already `independent`; the remaining suffixes live in prompt asset ids/paths, parser-version strings, templates, tests, and docs.

## Scope Guardrails

In scope:

1. rename the independent prompt asset id/path surface from `independent` to `independent`,
2. remove `independent` parser-version strings where they are protocol-family identifiers rather than schema versions,
3. sync templates, tests, and docs that still reference the suffixed name.

Out of scope:

1. changing independent protocol semantics,
2. changing decision-contract ids like `binary_decision_v1`,
3. changing unrelated schema or artifact versions.

## Progress

- [x] M0 Audit remaining independent suffix usage
- [x] M1 Rename canonical independent asset identifiers
- [x] M2 Sync docs/tests and pass merge validation
- [x] Status: completed

## Context and Orientation

Reviewed first:

1. `AGENTS.md` for required validation and schema-first discipline.
2. `docs/PLANS.md` because this is a cross-cutting rename.
3. `resources/prompts/manifest.json` and `resources/prompts/protocols/independent/system.md` because the suffix still appeared there.
4. `src/protocols/independent/*` and `src/ui/wizard/draft.ts` because they still referenced the old asset id or parser version.

## Plan of Work

1. rename the independent prompt asset path and manifest id,
2. update templates/tests/runtime references,
3. remove stale `independent` parser-version strings,
4. run the merge gate.

## Validation and Acceptance

Required:

1. `npm run gen:types`
2. `npm run check:types`
3. `npm run check:schemas`
4. `npm run test:merge`

Acceptance:

1. no remaining `independent` or `independent` protocol-family references remain in the repo,
2. prompt/template assets resolve correctly,
3. the full merge gate passes.

## Idempotence and Recovery

1. Prompt manifest updates are deterministic and recoverable by reverting the commit.
2. Re-running type generation is safe.

## Plan Change Notes

- 2026-03-23: Plan created and completed in the same migration round.
