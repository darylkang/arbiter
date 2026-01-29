# Arbiter

Arbiter is a research-grade TypeScript/Node CLI for studying LLM behavior as a **distribution**, not correctness. It repeatedly samples heterogeneous configurations and measures outputs under a locked measurement procedure *M*; “convergence” means the empirical distribution stabilizes under that fixed instrument. Clusters are **measurement artifacts**, contingent on the embedding model, text strategy, and online clustering rules.

## What this repo contains / does not contain
- **Contains:** the TypeScript/Node CLI experiment harness, schemas, and auditable artifact pipeline.
- **Does not contain:** offline analysis (Python) or publication-grade visualization/statistics.

## How this repo works (high level)
- **Configuration → Execution → Receipt**: resolve config, run batched asynchronous trials, compute monitoring/convergence, emit a human-readable receipt.
- **Schemas first**: JSON Schemas are the source of truth; TypeScript types are generated from schemas.
- **Event-driven engine**: the engine emits typed events; UI and ArtifactWriter subscribe.
- **Audit-grade artifacts**: append-only streams during execution with atomic finalization.

## Architecture at a glance
- **Schema-first design** with generated types in `src/generated/`.
- **Engine emits events**; UI and artifacts are subscribers (engine never imports UI).
- **Append-only artifacts** during execution; finalization is atomic.

## Repo layout
- `docs/` — spec snapshot and design notes (see `docs/spec.md`)
- `schemas/` — JSON Schemas (source of truth)
- `src/` — TypeScript source
  - `cli/` `config/` `engine/` `openrouter/` `clustering/` `artifacts/` `events/` `ui/` `generated/`

## Status
Scaffolded. Schemas and implementation are forthcoming.
