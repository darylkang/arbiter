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
- **Embed text normalization**: newline normalization to `\n`, trim trailing whitespace, then deterministic truncation to `measurement.embedding_max_chars` (keep prefix).
- **Truncation metadata**: record `embed_text_truncated`, `embed_text_original_chars`, `embed_text_final_chars`, and `truncation_reason`.
- **Zero-eligible batches**: when no eligible embeddings, set `novelty_rate=null`, `mean_max_sim_to_prior=null`, and `has_eligible_in_batch=false`.
- **Graceful shutdown**: SIGINT/SIGTERM yields schema-valid partial artifacts with `incomplete=true` and `stop_reason=user_interrupt`.
- **Actual model logging**: record OpenRouter `x-model` response header per trial (requested vs actual may differ; if header is absent, `actual_model` is null).
- **Embedding model provenance**: record requested embedding model and `actual_embedding_model` from `x-model` when present (nullable if absent or inconsistent).
- **Prompt embedding**: `config.resolved.json` must include full prompt text used with IDs and sha256.
- **Parsed output semantics**:
  - `success`: usable canonical output exists.
  - `fallback`: structured extraction failed but a usable canonical output exists (e.g., debate raw fallback).
  - `failed`: no usable canonical output.

## Phase B v0 protocol: debate_v1
- **3-turn sequence**: proposer → critic → proposer final.
- **Persona composition**: system = `persona\n\n---\n\nrole_prompt` (persona first; role prompt second).
- **Extraction**: fenced JSON → unfenced JSON → raw fallback; valid JSON requires non-empty `decision`.
- **Timeout/retry defaults**: per-call timeout 90s, per-call max retries 2, total trial timeout 5m.
- **Deferrals**: no consensus/judge/router/refinement in v0.

## Baseline early stopping (Phase 0)
- **Batch-boundary only**: stop evaluation happens only after batch completion.
- **Metrics used**: non-structural metrics (`novelty_rate`, `mean_max_sim_to_prior`) only.
- **Eligibility**: applies only after `k_min` eligible trials (embedding_status = success).
- **Policy fields**: `execution.stop_policy` with `novelty_epsilon`, `similarity_threshold`, `patience`.
- **Modes**:
  - `stop_mode=advisor`: log `would_stop` in convergence trace but continue.
  - `stop_mode=enforcer`: stop when thresholds are met for `patience` consecutive batches; `stop_reason=converged`.
- **Heuristic**: stability indicator only (not a correctness guarantee).

## Phase C monitoring: online clustering (locked semantics)
- **Algorithm**: online leader clustering; default centroid update rule is `fixed_leader`.
- **Update timing**: apply updates only at batch boundaries in **trial_id ascending** order.
- **Cluster IDs**: sequential in discovery order (0,1,2,...) and never reused.
- **cluster_distribution**: dense **array** aligned to `cluster_id` (cumulative counts). Length must equal `cluster_count` (or empty when 0).
- **Jensen–Shannon divergence (js_divergence)**:
  - log base 2
  - between **current cumulative** distribution and **prior cumulative** distribution
  - no smoothing; missing clusters treated as zero
  - null when a prior distribution is undefined (first batch)
- **cluster_limit_hit**: true when `cluster_count == cluster_limit`.
- **forced assignment counters**: `forced_assignments_this_batch` and `forced_assignments_cumulative` count assignments made after the limit is hit.

## Artifact set
Run directory uses `runs/<run_id>/` with `run_id` format: `YYYYMMDDTHHMMSSZ_<random6>` (UTC).

Always produced (per run directory under `runs/<run_id>/`):
- `config.resolved.json`
- `manifest.json`
- `trial_plan.jsonl`
- `trials.jsonl`
- `parsed.jsonl`
- `embeddings.arrow` (primary finalized format)
- `embeddings.provenance.json`
- `convergence_trace.jsonl`
- `aggregates.json`
- `receipt.txt`

Conditional (if online clustering enabled):
- `clusters/online.state.json`
- `clusters/online.assignments.jsonl`

Debug-only (optional):
- `debug/embeddings.jsonl` (append-only, base64 float32le vectors)
- `execution.log` (TTY-only; short batch-level log)

Note: `embeddings.arrow` is written only when embeddings are actually produced; resolve-only runs do not create it.

## Statistical assumptions & limitations
- Monitoring metrics assume trials are i.i.d. under the configured sampling distribution and measurement procedure.
- Any confidence intervals (if used) inherit those assumptions; they are stability diagnostics, not guarantees.

## Schema versioning & type generation
- Current schema version: `1.0.0` (v1 catalog).
- Generate types: `npm run gen:types` (outputs to `src/generated/`).
- Verify generated types: `npm run check:types`.
