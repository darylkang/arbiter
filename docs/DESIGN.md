# Arbiter Design

This document is the canonical technical design reference for Arbiter.

## Authority and Scope

1. JSON Schemas in `schemas/` are the source of truth for config and artifact shapes.
2. This document defines runtime semantics, architecture boundaries, and interpretation guardrails.
3. If this document diverges from schemas, schemas win.

Arbiter is a research-grade CLI for studying LLM behavior as a distribution under repeated controlled sampling. Arbiter prioritizes determinism, auditability, and reproducibility. It does not make correctness claims.

## System Map

Primary runtime surfaces:

- CLI and command routing: `src/cli/`
- Configuration loading and resolution: `src/config/`
- Run orchestration: `src/run/run-service.ts`
- Core execution engine and monitoring: `src/engine/`
- Protocol execution logic: `src/protocols/`
- OpenRouter integration: `src/openrouter/`
- Artifact writing and finalization: `src/artifacts/`
- Embeddings and finalization: `src/embeddings/`
- Online clustering: `src/clustering/`
- Verification and reporting: `src/tools/verify-run.ts`, `src/tools/report-run.ts`
- Transcript UI and reducers: `src/ui/`

Architecture boundary:

- Engine emits events.
- UI and ArtifactWriter subscribe to events.
- Engine must not import UI code.

## Run Lifecycle

1. Validate and resolve config.
2. Build deterministic trial plan using seeded RNG.
3. Assign deterministic `trial_id` values before async execution.
4. Execute trials and emit append-only JSONL artifacts.
5. Apply monitoring and optional clustering updates at batch boundaries in `trial_id` order.
6. Finalize run artifacts atomically and emit `manifest.json` and `receipt.txt`.
7. Verify artifacts and invariants with `arbiter verify`.

## Determinism and Ordering Invariants

- Trial planning is seeded and reproducible.
- `trial_id` is fixed before execution starts.
- Monitoring and clustering never update in completion order.
- Batch-boundary updates are applied in `trial_id` ascending order.

## Parse and Embedding Semantics

`parse_status` values:

- `success`: contract validated; structured output available.
- `fallback`: contract parse failed but usable text exists; deterministic raw fallback is used.
- `failed`: no usable text available; embedding is skipped.

`embed_text` rules:

- Normalize newlines to `\n`.
- Trim trailing whitespace.
- Deterministically truncate to `measurement.embedding_max_chars` by prefix.
- Skip embeddings when text is empty after normalization.

## Provenance Semantics

- Record requested model and actual model.
- Actual model must come from OpenRouter response body field `model` when available.
- Embedding provenance records requested embedding model and actual embedding model from response body `model` when available.
- Embeddings record `generation_id` when available in the provider response.

## Convergence-Aware Stopping

- Stopping is evaluated only at batch boundaries.
- Metrics are measurement metrics (`novelty_rate`, `mean_max_sim_to_prior`), not correctness metrics.
- Eligibility starts only after `k_min` successful embeddings.
- `advisor` mode logs stop suggestions but continues.
- `enforcer` mode stops when thresholds hold for configured patience.
- `converged` is a stability signal under the configured measurement procedure, not proof of truth.

## Online Clustering Semantics

- Online leader clustering semantics are deterministic at batch boundaries.
- Cluster IDs are assigned sequentially in discovery order and not reused.
- `cluster_distribution` is a dense array aligned by `cluster_id`.
- Jensen-Shannon divergence compares current cumulative and prior cumulative distributions.
- Cluster limit behavior is explicit via `cluster_limit_hit` and forced assignment counters.

## Artifact Contract

Run directory format:

- `runs/<run_id>/` where `run_id` is UTC timestamp plus random suffix.

Always produced for executed runs:

- `config.resolved.json`
- `manifest.json`
- `trial_plan.jsonl`
- `trials.jsonl`
- `parsed.jsonl`
- `convergence_trace.jsonl`
- `aggregates.json`
- `embeddings.provenance.json`
- `receipt.txt`

Produced when embeddings are generated:

- `embeddings.arrow`

Produced when clustering is enabled:

- `clusters/online.state.json`
- `clusters/online.assignments.jsonl`

Optional debug artifacts:

- `debug/embeddings.jsonl`
- `execution.log`

Artifact guarantees:

- JSONL artifacts are append-only during execution.
- Finalization is atomic via temporary file then rename.
- `config.resolved.json` is immutable after execution starts.

## Interpretation Guardrails

Safe claims:

- Stability or novelty behavior under a specific measurement setup.
- Distributional behavior under the observed sampling and model settings.

Unsafe claims:

- Correctness of model outputs.
- Ground-truth semantic categories from embedding clusters.
- Universal behavior claims across untested models or settings.

When reporting results, include:

- Prompt/question.
- Sampling configuration and protocol.
- Measurement configuration.
- Actual model identifiers.
- Stop policy and mode.

## Change Protocol

When changing behavior in core surfaces:

- Update schemas first when contracts change.
- Regenerate and commit generated types.
- Update this document for semantic behavior changes.
- Add or update tests for new invariants.
- Re-run quality gates in `AGENTS.md`.
