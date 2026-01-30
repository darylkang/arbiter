# Arbiter Spec Snapshot (Repo-Local Contract)

## Purpose
Arbiter is a research-grade CLI for studying LLM behavior as a **distribution** under repeated heterogeneous sampling. It prioritizes determinism, auditability, and reproducibility. It does **not** make correctness claims.

## Non-goals
- No Python runtime in this repo.
- No offline clustering or heavy statistical inference.
- No publication-grade visualization.

## Locked architecture
- **Schemas are source of truth**: JSON Schemas in `schemas/` define configs and artifacts.
- **Generated types** are committed under `src/generated/` and never hand-edited.
- **Event-driven engine**: the engine emits typed events; UI and ArtifactWriter subscribe.
- **Engine/UI boundary**: engine must not import UI code.
- **Artifacts** are append-only during execution with atomic finalization.
- **Measurement procedure M** is locked per run and fully recorded in provenance.
- **Model Catalog + Prompt Bank** are repo-committed inputs; runs must record their versions and hashes.

## Determinism invariants
- `trial_id` is assigned deterministically *before* async execution (0..K_max-1 in scheduled order).
- Trial plan is sampled with a seeded PRNG and recorded (seed + plan details).
- Monitoring/clustering updates apply in `trial_id` order at batch boundaries (never completion order).

## P0 semantics highlights
- **Terminal trial statuses (exhaustive)**: `success`, `error`, `model_unavailable`, `timeout_exhausted`.
- **Embedding failures do not fail trials**: only `trial.status=success` is eligible; embedding status is separate.
- **Eligible trials**: default is `embedding_status=success` for monitoring/convergence.
- **Empty embed_text**: skip embedding; record `embedding_status=skipped` with reason `empty_embed_text`.
- **Deterministic truncation**: keep prefix; record original/final sizes and truncation flag.
- **Graceful shutdown**: SIGINT/SIGTERM yields schema-valid partial artifacts with `incomplete=true` and `stop_reason=user_interrupt`.
- **Actual model logging**: record OpenRouter `x-model` response header per trial (requested vs actual may differ).
- **Prompt embedding**: `config.resolved.json` must include full prompt text used with IDs and sha256.

## Artifact set
Always produced (per run directory under `runs/`):
- `config.resolved.json`
- `manifest.json`
- `question.json`
- `trials.jsonl`
- `parsed.jsonl`
- `embeddings.*` (reproducible format)
- `embeddings.provenance.json`
- `convergence_trace.jsonl`
- `aggregates.json`
- `catalog_snapshot.json`

Conditional (if online clustering enabled):
- `clusters_online.state.json`
- `clusters_online.assignments.jsonl`

## Schema versioning & type generation
- Current schema version: `1.0.0` (v1 catalog).
- Generate types: `npm run gen:types` (outputs to `src/generated/`).
- Verify generated types: `npm run check:types`.
