# Arbiter Design

This is Arbiter's canonical technical design document.

It has two jobs:

1. define how the current system must behave,
2. keep implementation aligned with the paper direction: reasoning as a distribution under heterogeneous, budget-matched sampling.

## 1) Authority and Precedence

1. `schemas/` defines contract shapes (config and artifacts).
2. this document defines semantics, invariants, and interpretation boundaries.
3. `AGENTS.md` defines contributor and agent operating rules.

If this document conflicts with schemas, schemas win and this doc must be updated immediately.

## 1.1) CLI Surface Contract (v1)

Arbiter's stabilized v1 CLI surface is intentionally minimal.

Primary entry points:

1. `arbiter`
2. `arbiter init`
3. `arbiter run`

Global flags:

1. `--help`, `-h`
2. `--version`, `-V`

Contract boundaries:

1. no `--headless`,
2. no `--verbose`,
3. no wizard-only flags (`--wizard`),
4. no redundant aliases beyond `-h` and `-V`.

Command semantics:

1. `arbiter` launches Wizard TUI when stdout is TTY; otherwise prints help and exits `0`.
2. `arbiter init` writes collision-safe config filenames (`arbiter.config.json`, `arbiter.config.1.json`, and so on) without overwrite.
3. `arbiter run` is headless by default and requires `--config <path>`.
4. `arbiter run --dashboard` renders Stage 2 and Stage 3 only in TTY; in non-TTY it warns to stderr and continues headless.
5. `arbiter run` override flags are control-plane only: `--out`, `--workers`, `--batch-size`, `--max-trials`, `--mode`, `--dashboard`.
6. experiment variables are config-defined and not overridden via CLI flags.
7. wizard config discovery in CWD matches `^arbiter\.config(?:\.[1-9][0-9]*)?\.json$` and is ordered lexicographically by filename.
8. `arbiter init` prints the created config path plus suggested next commands (`arbiter`, `arbiter run --config <file>`).

## 1.2) Contract Maturity and Drift Handling

This document is normative for Arbiter's stabilized behavior.

During implementation migrations, `docs/exec-plans/` is the rollout ledger for interim states and sequencing.
If implementation diverges from this document and schemas, that divergence must be treated as either:

1. a bug to fix, or
2. an explicit migration step tracked in an active ExecPlan.

## 2) Research Alignment (Paper North Star)

Arbiter supports the research framing that a single LLM answer is one sample from a stochastic process.

For input `x`, sampling configurations `c` from an explicit configuration distribution `Q(c)` induces an output distribution that can be estimated via repeated trials. The harness exists to estimate, audit, and compare these distributions under controlled budgets.

Arbiter is a measurement harness, not an algorithmic claim of model correctness.

## 3) Core Objects and Terms

- `x`: input question or prompt.
- `c = (m, d, p, pi)`: configuration tuple:
  - `m`: participant model,
  - `d`: decode settings,
  - `p`: prompt/persona framing,
  - `pi`: protocol.
- `Q(c)`: explicit distribution over configurations.
- `K`: number of executed trials.
- `y`: normalized decision output (contract-derived or canonical parsed output).
- `hat(P)_Q(y | x)`: empirical distribution estimated from trials.
- `M`: measurement procedure (embedding model + preprocessing + optional grouping settings).

Design commitment:

- changing `Q(c)` changes the estimand,
- changing `M` changes measured structure.

Both must be recorded and treated as first-class provenance.

## 4) Two Uncertainties (Do Not Conflate)

- Decision uncertainty: dispersion of estimated outcomes under `Q(c)`.
- Estimation uncertainty: finite-sample uncertainty in the estimated decision uncertainty or derived reliability signals.

Paper-facing and harness-facing reporting must keep this distinction explicit.

## 5) Heterogeneity Ladder Posture

Arbiter is designed to support ladder-style heterogeneity studies:

- H0: fixed single-shot baseline,
- H1: decode heterogeneity,
- H2: prompt/persona heterogeneity,
- H3: cross-model heterogeneity,
- H4: interaction heterogeneity.

Implementation posture:

- interaction is one rung, not the centerpiece,
- negative H4 results are still valid outcomes,
- budget matching is part of experimental design discipline, and Arbiter logs the data needed for budget-aware comparisons.

## 6) Claims and Non-Claims (Hard Boundaries)

Allowed claims:

- distributional stability/novelty behavior under a specified `Q(c)` and `M`,
- reliability-signal behavior under matched experimental conditions,
- reproducibility and provenance properties of the harness.

Disallowed claims:

- convergence implies correctness,
- embedding groups are semantic truth,
- one protocol (including interaction) is universally superior,
- findings under one `Q(c)` automatically generalize to other `Q(c)` choices.

## 7) System Architecture Map

Primary modules:

- CLI and command flow: `src/cli/`
- config loading/resolution/policy: `src/config/`
- run orchestration: `src/run/run-service.ts`
- execution engine: `src/engine/`
- protocols: `src/protocols/`
- OpenRouter client/integration: `src/openrouter/`
- event contracts/bus: `src/events/`
- artifact writing/finalization: `src/artifacts/`
- embeddings finalization: `src/embeddings/`
- grouping monitor (implemented in clustering module): `src/clustering/`
- verify/report tooling: `src/tools/`
- wizard and dashboard UI: `src/ui/`

Architecture boundary:

- engine emits events,
- UI and ArtifactWriter subscribe,
- engine must not import UI code.

## 8) Run Lifecycle

1. validate and resolve config,
2. generate deterministic trial plan from seeded RNG,
3. assign deterministic `trial_id` before async work,
4. execute trials and parse outputs,
5. derive embedding inputs and run embeddings when eligible,
6. update monitoring/grouping at batch boundaries in `trial_id` order,
7. finalize artifacts atomically and write manifest and run outputs,
8. verify run integrity through artifact/schema validation checks.

## 9) Determinism and Reproducibility Invariants

- deterministic seeded trial planning,
- deterministic `trial_id` assignment pre-execution,
- no completion-order monitoring updates,
- batch-boundary updates applied in `trial_id` ascending order,
- append-only JSONL during execution,
- atomic finalization for completed artifacts,
- immutable `config.resolved.json` after execution start.

## 10) Parse and Embedding Semantics

`parse_status` meanings:

- `success`: contract-valid structured output,
- `fallback`: contract parse failed but usable text exists,
- `failed`: no usable text.

Default policy posture:

- contract failures should map to `fallback` when text is usable,
- embedding eligibility requires non-empty normalized `embed_text`.

`embed_text` derivation:

- normalize line endings to `\n`,
- trim trailing whitespace,
- deterministic max-char truncation by prefix using `measurement.embedding_max_chars`,
- skip embeddings when text is empty after normalization.

## 11) Provenance Semantics

Per trial/provenance expectations:

- log requested model,
- log actual model from OpenRouter response body `model` when available,
- for embeddings, log requested and actual embedding model,
- record `generation_id` when provider response includes it.

Provenance is required for reproducibility and drift audit.

## 12) Novelty-Saturation Stopping Semantics

- evaluate stop conditions only at batch boundaries,
- rely on measurement metrics (for example `novelty_rate`, `mean_max_sim_to_prior`),
- require eligible trials before stop logic activates (`k_min` semantics),
- `advisor` mode logs would-stop state,
- `enforcer` mode can stop when novelty-saturation thresholds are met.
- batch-level monitoring snapshots are recorded in `monitoring.jsonl`.

Interpretation boundary:

- stopping indicates diminishing novelty under configured measurement conditions, not truth or correctness.

## 13) Online Grouping Semantics

When embedding grouping is enabled:

- updates occur at batch boundaries with deterministic ordering,
- group IDs are sequential in discovery order and not reused,
- `group_distribution` is dense and aligned to `group_id`,
- JS divergence compares cumulative distribution shift across batches,
- group-limit behavior is surfaced through limit/forced-assignment counters.

## 14) Artifact Contract

Run directory:

- `runs/<run_id>/`
- `run_id` format: `YYYYMMDDTHHMMSSZ_<random6>` (UTC timestamp + suffix)

This section defines the v1 target artifact contract.

Always-produced executed-run artifacts:

- `config.source.json`
- `config.resolved.json`
- `manifest.json`
- `trial_plan.jsonl`
- `trials.jsonl`
- `monitoring.jsonl`
- `receipt.txt`

Conditionally produced:

- `embeddings.arrow` when at least one eligible embedding is successfully finalized,
- `embeddings.jsonl` as fallback when Arrow is not generated, or when debug mode explicitly retains JSONL embeddings,
- `groups/assignments.jsonl` and `groups/state.json` when grouping artifacts are emitted,
- debug artifacts such as `debug/events.jsonl` and `debug/execution.log` only when debug mode is enabled.

Consolidation rules:

- `trials.jsonl` is the canonical per-trial record and includes parse and embedding summaries.
- for Debate protocol runs, intermediate turns are persisted inside per-trial `transcript` records in `trials.jsonl`.
- final run-level summary metrics and embedding provenance summary live in `manifest.json` under run-level fields.
- this contract supersedes legacy file names (`parsed.jsonl`, `convergence_trace.jsonl`, `aggregates.json`, `embeddings.provenance.json`, `clusters/*`).

Run-class interpretation rules:

- Executed runs follow the always/conditional artifact contract above.
- Resolve-only runs are a separate run class and do not claim executed-run artifact completeness.
- Resolve-only runs produce only `config.resolved.json` and `manifest.json`.
- Pre-start failures may emit partial diagnostics; they must not be represented as completed executed runs.

Planning-only workflows do not produce a full execution artifact set.

## 15) Verification and Quality Expectations

Before trusting results:

- validate run artifacts and schema conformance,
- inspect `manifest.json` for policy/provenance snapshot,
- inspect `monitoring.jsonl` for stopping context,
- confirm requested vs actual model identifiers.

Before merge for behavior changes, use quality gates from `AGENTS.md`.

## 16) Scope Boundaries

In scope:

- deterministic experiment execution,
- artifact and provenance capture,
- online monitoring and optional online grouping,
- run verification and textual reporting.

Out of scope:

- offline heavy statistical inference pipelines,
- publication-quality plotting and figure generation,
- claims that require semantic guarantees beyond measurement contracts.

## 17) Change Protocol

When semantics change:

1. update schemas first if contract shapes changed,
2. regenerate and commit generated types,
3. update this design document for semantic changes,
4. update tests and verification logic,
5. run required quality gates.

When uncertain, prefer conservative behavior that preserves determinism, provenance integrity, and auditability.
