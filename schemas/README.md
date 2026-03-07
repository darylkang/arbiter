# Schemas

This directory is Arbiter's contract kernel.

It defines the schema-validated shapes for:

1. the estimand-defining experiment configuration,
2. the foundational run artifacts required to reconstruct results offline,
3. the operational monitoring and grouping records emitted during execution,
4. the resource and contract metadata that support parsing, prompting, and protocol resolution.

These schemas are authoritative for contract shape and field naming.
If implementation, docs, and schemas disagree on a field-level contract, the schemas win.

This directory does **not** by itself define the paper's full scientific meaning.
Use the surrounding docs in this order:

1. `/Users/darylkang/Developer/arbiter/schemas/` for contract shapes and field names,
2. `/Users/darylkang/Developer/arbiter/docs/DESIGN.md` for durable harness semantics,
3. `/Users/darylkang/Developer/arbiter/docs/RESEARCH-METHOD.md` for the current paper's estimand, analysis boundary, and first-class scientific outputs.

For the current paper-specific schema interpretation, also read:

4. `/Users/darylkang/Developer/arbiter/schemas/PAPER-ALIGNMENT.md`

## Current Paper Alignment

For the current paper, Arbiter is committed to:

1. treating `Q(c)` as estimand-defining,
2. treating `M` as co-estimand-defining on the free-form semantic path,
3. preserving enough raw trial data, provenance, and measurement settings to reconstruct `P_(Q,M)(y | x)` offline,
4. distinguishing operational monitoring from paper-facing scientific outputs.

That distinction matters here.

The current schemas are strongest around:

1. raw trial capture,
2. provenance,
3. embedding and grouping support artifacts,
4. operational monitoring.

The current paper's primary scientific outputs, such as per-instance outcome distributions, primary reliability signals, and estimation-uncertainty outputs, are governed methodologically by `/Users/darylkang/Developer/arbiter/docs/RESEARCH-METHOD.md` but are not yet fully represented as first-class analysis artifact schemas in this directory.

This is intentional current-state documentation, not a claim that the schema layer is already complete for the paper.

## Design Principles

Schema work in this directory should follow these principles:

1. **Raw over derived**
   - Preserve enough raw and provenance-rich data to support offline reconstruction.
   - Do not force paper-facing statistical conclusions into vague catch-all objects.

2. **Estimand-significant choices must be explicit**
   - Changes to `Q(c)` or `M` are research-significant.
   - If a field changes what is being estimated, it should be schema-visible and auditable.

3. **Operational and scientific layers must not be conflated**
   - Monitoring, novelty, and grouping records are operational-first unless explicitly promoted into the paper contract.
   - Do not let operational summaries silently stand in for paper-facing outputs.

4. **Label-path and free-form-path assumptions must be legible**
   - Labeled evaluation requires finite normalized label semantics.
   - Free-form semantic evaluation requires explicit measurement-procedure provenance.

5. **Schema validity should be semantically meaningful**
   - A config that is schema-valid should not be obviously invalid as an estimand definition.
   - Push research-significant validity rules into schemas where practical, not only into runtime exceptions.

## File Families

### 1. Estimand-Defining Inputs

These schemas define the experiment contract itself.

- `config.schema.json`
- `question.schema.json`
- `protocol.schema.json`

They govern:

1. the explicit `Q(c)` surface,
2. protocol and contract configuration,
3. measurement-related runtime settings,
4. question identity and source metadata.

These files deserve the highest scrutiny because they shape what the experiment is estimating.

### 2. Foundational Run Artifacts

These schemas define the records required to reconstruct a run offline.

- `manifest.schema.json`
- `trial.schema.json`
- `trial-plan.schema.json`
- `parsed-output.schema.json`
- `embedding.schema.json`
- `embeddings-provenance.schema.json`

These files should make it possible to recover:

1. what was planned,
2. what actually ran,
3. what raw outputs were observed,
4. how parsing and embedding behaved,
5. what provenance and budget evidence exists.

For the current paper, this family is more important than operational summaries.

### 3. Operational Monitoring and Grouping

These schemas capture execution-time heuristics and grouping state.

- `monitoring.schema.json`
- `aggregates.schema.json`
- `group-state.schema.json`
- `group-assignment.schema.json`

These are useful and justified, but they are not automatically the paper's primary outputs.

Treat them as:

1. operational execution records,
2. optional semantic-analysis support artifacts,
3. exploratory measurement outputs unless explicitly promoted into the scientific contract.

Do not treat online groups as semantic truth.

### 4. Resource and Contract Metadata

These schemas govern catalogs, prompt manifests, protocol resources, and decision-contract presets.

- `catalog.schema.json`
- `prompt-manifest.schema.json`
- `contract-manifest.schema.json`
- `decision-contract.schema.json`
- `debate-decision-contract.schema.json`

This family is where finite-label assumptions, contract normalization rules, and protocol-specific extraction surfaces should remain legible.

## Analysis Boundary

Arbiter's schema layer currently governs:

1. experiment setup,
2. raw run artifacts,
3. operational monitoring,
4. resource and parsing contracts.

The paper's downstream analysis layer is expected to compute:

1. per-instance semantic outcome distributions,
2. primary reliability signals such as top-choice mass and margin,
3. estimation-uncertainty outputs,
4. dataset-level AUROC, selective-prediction, calibration, and rung-comparison summaries.

If any of those downstream analysis objects become durable, reusable, or publication-critical enough to require stable machine-readable artifacts, they should be promoted into new explicit schemas here rather than buried in untyped blobs.

## Registry and Generation

The canonical schema registry lives at:

- `/Users/darylkang/Developer/arbiter/src/config/schema-registry.ts`

That registry is the single source of truth for:

1. which schema files are registered,
2. which generated type files they produce under `/Users/darylkang/Developer/arbiter/src/generated/`,
3. which validator exports are compiled in `/Users/darylkang/Developer/arbiter/src/config/schema-validation.ts`.

Do not add or rename a schema by editing only one downstream surface.

## Required Workflow

When changing schema contracts:

1. edit the schema file in this directory,
2. update `/Users/darylkang/Developer/arbiter/src/config/schema-registry.ts` if a schema is added, removed, or renamed,
3. regenerate generated types with `npm run gen:types`,
4. update implementation and docs that depend on the contract,
5. update `/Users/darylkang/Developer/arbiter/docs/DESIGN.md` and `/Users/darylkang/Developer/arbiter/docs/RESEARCH-METHOD.md` when the change alters durable semantics or paper-facing meaning,
6. run:
   - `npm run check:types`
   - `npm run check:schemas`

If a schema change alters `Q(c)`, `M`, labeled-path assumptions, or paper-facing artifact meaning, treat it as research-significant work rather than routine cleanup.

## Contract Rules

1. Prefer `additionalProperties: false` for concrete record shapes.
2. Keep `$schema` on draft 2020-12.
3. Give every schema a unique, stable `$id`.
4. Keep schema version changes intentional; version bumps are contract changes, not formatting edits.
5. Reuse stable field names unless there is a clear migration reason.
6. Prefer explicit machine-readable fields over burying research-significant semantics in free-form `metadata` or open `object` blobs.
7. If a schema is meant to support labeled evaluation, finite normalized label semantics should be clear at the contract layer.
8. If a schema is meant to support free-form semantic evaluation, measurement-procedure dependence should be visible and auditable.

## What `check:schemas` Enforces

`npm run check:schemas` verifies:

1. schema compilation succeeds under AJV strict mode,
2. every `*.schema.json` file is registered,
3. every registered schema has a matching generated type file target,
4. no orphan generated type files remain in `/Users/darylkang/Developer/arbiter/src/generated/`,
5. every registered schema declares draft 2020-12 and a unique `$id`.

This keeps the schema system cohesive.

It does **not** by itself prove that the schema substance is scientifically complete for the current paper.
That requires alignment with `/Users/darylkang/Developer/arbiter/docs/RESEARCH-METHOD.md`, `/Users/darylkang/Developer/arbiter/docs/DESIGN.md`, and the current research brief.
