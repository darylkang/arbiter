# Debate Protocol ID Rename

## Purpose / Big Picture

Rename the debate protocol's canonical identifier from `debate` to `debate` across Arbiter's schemas, assets, runtime code, templates, tests, and durable docs.

The goal is a clean canonical surface with no version suffix embedded in the protocol family name. This is a cross-cutting migration because the existing identifier is encoded in config schemas, prompt/template manifests, protocol assets, runtime checks, and paper-facing docs.

## Scope Guardrails

In scope:

1. protocol type/id rename from `debate` to `debate`,
2. protocol asset rename from `resources/prompts/protocols/debate` to `resources/prompts/protocols/debate`,
3. prompt/template manifest id and path updates tied to that rename,
4. runtime/tests/docs updates needed to make `debate` the only canonical identifier.

Out of scope:

1. changing debate semantics, role taxonomy, or UI behavior,
2. changing the D1..D4 experiment matrix,
3. changing unrelated parser or contract versions unless they are debate-protocol identifiers.

Sequencing constraint:

1. update schemas and assets first,
2. regenerate generated types,
3. update code/tests/docs,
4. run the merge gate.

## Progress

- [x] M0 Audit rename surface and confirm scope
- [x] M1 Rename canonical protocol/assets to `debate`
- [x] M2 Sync tests/docs and pass merge validation
- [x] Status: completed

## Decision Log

1. The migration removes `debate` rather than keeping it as a deprecated alias. The user asked to remove the versioning suffix wherever it is used, so the canonical repo surface now uses `debate`.
2. Parser version strings remain separate versioning concerns unless they are themselves protocol identifiers.

## Context and Orientation

Reviewed first:

1. `AGENTS.md` for repo workflow and validation rules.
2. `docs/PLANS.md` because this is a migration and cross-cutting rename.
3. `docs/DESIGN.md` and `docs/RESEARCH-METHOD.md` because the protocol family name is durable truth.
4. `schemas/config.schema.json` and `schemas/protocol.schema.json` because the protocol id is schema-owned.
5. `resources/prompts/manifest.json`, `resources/prompts/protocols/debate/protocol.json`, and `resources/templates/manifest.json` because the identifier is encoded in asset ids and paths.

High-risk surfaces:

1. config validation and resolution,
2. prompt/template manifest path/hash drift,
3. generated types and tests that hard-code protocol ids,
4. durable docs and product specs still naming `debate` as canonical.

## Plan of Work

1. Rename prompt/template/protocol assets and ids to `debate`.
2. Update schemas and generated types to make `debate` canonical.
3. Update runtime code, tests, and docs to remove stale `debate` references.
4. Validate with the full merge gate.

## Milestones and Gates

### M0 Audit

Entry:

1. existing `debate` references identified across code/assets/docs.

Exit:

1. canonical rename scope decided.

### M1 Rename

Entry:

1. audit complete.

Exit:

1. schemas, assets, runtime code, and tests no longer use `debate` as the protocol id.

### M2 Validation and Doc Sync

Entry:

1. implementation compiles locally.

Exit:

1. generated types regenerated,
2. durable docs updated,
3. `npm run test:merge` passes.

## Validation and Acceptance

Required:

1. `npm run gen:types`
2. `npm run check:types`
3. `npm run check:schemas`
4. `npm run test:merge`

Acceptance:

1. `debate` is no longer the canonical debate protocol id in schemas, runtime code, manifests, templates, and docs.
2. Prompt/template manifests resolve successfully after path/id changes.
3. Full merge gate passes.

## Idempotence and Recovery

1. Re-running type generation is safe.
2. Manifest path/id changes are deterministic and recoverable by checking out the previous commit.
3. If validation fails due to stale hashes or paths, regenerate/update the affected manifest entries before continuing.

## Plan Change Notes

- 2026-03-23: Plan created and completed in the same implementation round for the protocol-id migration.
