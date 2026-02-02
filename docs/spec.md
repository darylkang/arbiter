# Arbiter Spec Snapshot (Repo‑Local Contract)

## Authority (what is canonical)

1) **JSON Schemas** in `schemas/` are the source of truth for configs and artifacts.
2) This document defines **semantic** and **determinism** contracts that code must follow.
3) If this spec diverges from schemas, **schemas win**; update this spec to match.

---

## Purpose

Arbiter is a research‑grade CLI for studying LLM behavior as a **distribution** under repeated heterogeneous sampling. It prioritizes determinism, auditability, and reproducibility. It does **not** make correctness claims.

## Non‑goals

- No Python runtime in this repo.
- No offline clustering or heavy statistical inference.
- No publication‑grade visualization.

---

## Locked architecture

- **Schemas are source of truth**: JSON Schemas in `schemas/` define configs and artifacts.
- **Generated types** are committed under `src/generated/` and never hand‑edited.
- **Event‑driven engine**: engine emits typed events; UI + ArtifactWriter subscribe.
- **Engine/UI boundary**: engine must not import UI code.
- **Artifacts** are append‑only during execution with atomic finalization.
- **Measurement procedure M** is locked per run and fully recorded in provenance.
- **Model Catalog + Prompt Bank** are repo‑committed inputs; runs record versions and hashes.

---

## Determinism invariants

- `trial_id` assigned deterministically **before** async execution (0..K_max‑1 in scheduled order).
- Trial plan sampled with seeded RNG and recorded (seed + plan details).
- Monitoring/clustering updates apply in `trial_id` order at **batch boundaries** (never completion order).

---

## Parse_status semantics (canonical)

- **success**: contract validated; structured fields populated.
- **fallback**: contract invalid/unparseable, but deterministic fallback output exists (raw text used for outcome/embed_text).
- **failed**: no usable text available (empty/missing); embed_text is empty and embeddings are skipped.

Contract failures generally map to **fallback**, not “no usable output.”

---

## Embed_text derivation & preprocessing

- **Normalization**: newline normalization to `\n`, trim trailing whitespace.
- **Truncation**: deterministic truncation to `measurement.embedding_max_chars` (keep prefix).
- **Empty handling**: if empty after normalization, skip embeddings with `embedding_status=skipped` and `skip_reason=empty_embed_text`.
- **Metadata**: record `embed_text_truncated`, `embed_text_original_chars`, `embed_text_final_chars`, `truncation_reason`.

---

## Provenance (OpenRouter‑aligned)

- **Actual model**: taken from OpenRouter response **body** `model` (nullable if missing).
- **Embeddings**: record requested embedding model and `actual_embedding_model` from response body `model` when present (nullable if absent).
- **Generation IDs**: store `generation_id` (response body `id`) for optional later audit (e.g., `/api/v1/generation?id=...`). No lookups are performed by default.

---

## Convergence‑aware stopping (baseline)

- **Batch‑boundary only**: stop evaluation happens only after batch completion.
- **Metrics used**: non‑structural metrics (`novelty_rate`, `mean_max_sim_to_prior`).
- **Eligibility**: applies only after `k_min` eligible trials (embedding_status = success).
- **Policy fields**: `execution.stop_policy` with `novelty_epsilon`, `similarity_threshold`, `patience`.
- **Modes**:
  - `stop_mode=advisor`: log `would_stop` in convergence trace but continue.
  - `stop_mode=enforcer`: stop when thresholds are met for `patience` consecutive batches; `stop_reason=converged`.
- **Heuristic**: stability indicator only (not a correctness guarantee).

---

## Phase B v1 protocol: debate_v1 (proposer–critic–revision)

- **3‑turn sequence**: proposer → critic → proposer final.
- **Persona composition**: system = `persona\n\n---\n\nrole_prompt` (persona first; role prompt second).
- **Decision contract (optional)**: when configured, append the contract clause to the final proposer system prompt.
- **Extraction**:
  - If contract configured: attempt fenced JSON → unfenced JSON; if validation fails but content is non‑empty, `parse_status=fallback` and embed raw content. If content is empty, `parse_status=failed`.
  - If no contract: fenced JSON → unfenced JSON → raw fallback.
- **Timeout/retry defaults**: per‑call timeout 90s, per‑call max retries 2, total trial timeout 5m.
- **Deferrals**: no consensus/judge/router/refinement in v1.

---

## Phase C monitoring: online clustering (locked semantics)

- **Algorithm**: online leader clustering; default centroid update rule is `fixed_leader`.
- **Update timing**: apply updates only at batch boundaries in **trial_id ascending** order.
- **Cluster IDs**: sequential in discovery order (0,1,2,…) and never reused.
- **cluster_distribution**: dense **array** aligned to `cluster_id` (cumulative counts). Length must equal `cluster_count` (or empty when 0).
- **Jensen–Shannon divergence (js_divergence)**:
  - log base 2
  - between **current cumulative** distribution and **prior cumulative** distribution
  - no smoothing; missing clusters treated as zero
  - null when a prior distribution is undefined (first batch)
- **cluster_limit_hit**: true when `cluster_count == cluster_limit`.
- **forced assignment counters**: `forced_assignments_this_batch` and `forced_assignments_cumulative` count assignments made after the limit is hit.

---

## Artifact set (per run)

Run directory uses `runs/<run_id>/` with `run_id` format: `YYYYMMDDTHHMMSSZ_<random6>` (UTC).

Always produced:
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

Conditional (if clustering enabled):
- `clusters/online.state.json`
- `clusters/online.assignments.jsonl`

Debug‑only (optional):
- `debug/embeddings.jsonl` (append‑only, base64 float32le vectors)
- `execution.log` (TTY‑only; short batch‑level log)

Note: `embeddings.arrow` is written only when embeddings are actually produced; resolve‑only runs do not create it.

---

## CLI workflows & guardrails (reference)

- `arbiter` (TTY) launches the premium wizard; use `--headless` for help‑only mode.
- `arbiter quickstart` creates `arbiter.config.json`, validates it, runs a mock execution by default, and optionally prompts for a live run.
- `arbiter validate --live` performs offline schema checks plus an OpenRouter connectivity probe.
- **Strict/permissive policy**: strict rejects free/aliased models unless explicitly allowed and records policy snapshot in `manifest.json`.
- `arbiter report runs/<run_id>` summarizes results without Python and links to core artifacts.
- Token usage is recorded when OpenRouter returns `usage` (prompt/completion/total).

---

## Statistical assumptions & limitations

- Monitoring metrics assume trials are i.i.d. under the configured sampling distribution and measurement procedure.
- Any confidence intervals (if used) inherit those assumptions; they are stability diagnostics, not guarantees.

---

## Schema versioning & type generation

- Current schema version: `1.0.0` (v1 catalog).
- Generate types: `npm run gen:types` (outputs to `src/generated/`).
- Verify generated types: `npm run check:types`.

---

## Notion drift notes (source of truth is this spec + schemas)

- Provenance uses OpenRouter response body `model` for `actual_model` (headers are optional metadata).
- `question.json` is **not** a default artifact; the question is embedded in `config.resolved.json`.
- Terminology: use **convergence‑aware stopping** / **budget‑adaptive sampling** and **debate protocol (proposer–critic–revision)**.
