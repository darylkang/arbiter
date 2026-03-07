# Schemas

This directory is Arbiter's contract layer.

It defines the language-neutral shapes for:

1. input configuration,
2. run artifacts and per-trial records,
3. monitoring and grouping records,
4. resource manifests and contract metadata.

These schemas are authoritative for contract shape and field naming. If implementation, docs, and schemas disagree, the schemas win.

## File Families

1. Study and execution inputs
   - `config.schema.json`
   - `question.schema.json`
   - `protocol.schema.json`

2. Run artifacts and derived records
   - `manifest.schema.json`
   - `trial.schema.json`
   - `trial-plan.schema.json`
   - `parsed-output.schema.json`
   - `embedding.schema.json`
   - `embeddings-provenance.schema.json`

3. Monitoring and grouping
   - `monitoring.schema.json`
   - `aggregates.schema.json`
   - `group-state.schema.json`
   - `group-assignment.schema.json`

4. Resource manifests and decision contracts
   - `catalog.schema.json`
   - `prompt-manifest.schema.json`
   - `contract-manifest.schema.json`
   - `decision-contract.schema.json`
   - `debate-decision-contract.schema.json`

## Registry and Generation

The canonical schema registry lives at:

- `/Users/darylkang/Developer/arbiter/src/config/schema-registry.ts`

That registry is the single source of truth for:

1. which schema files are registered,
2. which generated type files they produce under `/Users/darylkang/Developer/arbiter/src/generated/`,
3. which validator exports are compiled in `/Users/darylkang/Developer/arbiter/src/config/schema-validation.ts`.

Do not add a new schema by editing only one of those downstream surfaces.

## Required Workflow

When changing schema contracts:

1. edit the schema file in this directory,
2. update `/Users/darylkang/Developer/arbiter/src/config/schema-registry.ts` if a schema is added, removed, or renamed,
3. regenerate generated types with `npm run gen:types`,
4. update implementation and docs that depend on the contract,
5. run:
   - `npm run check:types`
   - `npm run check:schemas`

## Contract Rules

1. Prefer `additionalProperties: false` for concrete record shapes.
2. Keep `$schema` on draft 2020-12.
3. Give every schema a unique, stable `$id`.
4. Keep version changes intentional. Schema version changes are contract changes, not formatting edits.
5. Reuse stable field names unless there is a clear migration reason.

## What `check:schemas` Enforces

`npm run check:schemas` verifies:

1. schema compilation succeeds under AJV strict mode,
2. every `*.schema.json` file is registered,
3. every registered schema has a matching generated type file target,
4. no orphan generated type files remain in `/Users/darylkang/Developer/arbiter/src/generated/`,
5. every registered schema declares draft 2020-12 and a unique `$id`.

This keeps the schema system cohesive instead of relying on manual synchronization.
