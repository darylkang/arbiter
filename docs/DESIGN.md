# Arbiter Design

`DESIGN.md` is Arbiter's canonical long-lived design document.

It has three jobs:

1. define Arbiter's durable system behavior,
2. define the interpretation boundaries for research claims and outputs,
3. prevent permanent design truth from drifting into transient plans or implementation-only code.

This document is intentionally narrower than the full documentation set. It owns durable semantics, invariants, and boundaries. It does not try to own every exact UI detail, copy string, or rollout step.

## 1) Authority and Document Boundaries

### 1.1) Source-of-Truth Order

For product and runtime behavior, Arbiter uses this authority order:

1. `schemas/` for contract shapes and field names,
2. this document for system semantics, invariants, and interpretation boundaries,
3. `docs/RESEARCH-METHOD.md` for the current paper's methodological contract and analysis boundary,
4. `docs/product-specs/` for exact Wizard, Dashboard, Receipt, copy, and visual contracts that refine this design,
5. `README.md` for operator-facing usage guidance,
6. `AGENTS.md` and `docs/PLANS.md` for contributor process, planning, and validation discipline.

If documents disagree:

1. schemas win on shape-level truth,
2. this document wins on durable system semantics,
3. product specs win only for exact human-facing interaction, copy, and visual details that do not conflict with schemas or this document.

### 1.2) What Belongs Where

This document owns:

- research framing and claims discipline,
- product model and control-plane boundaries,
- execution semantics,
- determinism, provenance, monitoring, grouping, and artifact contracts,
- durable compatibility exceptions and migration boundaries.

`docs/RESEARCH-METHOD.md` owns:

- the current paper's estimand definition,
- what counts as primary scientific output versus operational monitoring,
- the role of `Q(c)` and `M` in the paper's analysis contract,
- the boundary between harness artifacts and downstream analysis.

`docs/product-specs/` owns:

- exact Wizard step behavior and navigation details,
- exact Dashboard and Receipt presentation behavior,
- exact copy, glyph, palette, and layout contracts.

`docs/exec-plans/` is the rollout ledger, not the permanent source of durable truth.

If a completed ExecPlan introduces lasting behavior or semantics, that truth must be migrated into this document or the relevant product-spec doc. Completed plans may explain how Arbiter got here, but they must not remain the only place where permanent behavior is defined.

### 1.3) Drift Handling

Implementation drift from this document must be treated as one of:

1. a bug,
2. an intentional migration step recorded in an active ExecPlan.

When semantics change:

1. update schemas first if contract shapes changed,
2. regenerate and commit generated types,
3. update this document for durable semantic changes,
4. update product specs for exact human-facing behavior changes,
5. update tests and verification logic,
6. run the required quality gates from `AGENTS.md`.

## 2) Research Position

Arbiter is a measurement harness for studying reasoning as a distribution under heterogeneous, budget-matched sampling.

It is not an algorithmic claim of model correctness.

### 2.1) Core Objects and Terms

- `x`: input question or prompt.
- `c = (m, d, p, pi)`: configuration tuple:
  - `m`: participant model,
  - `d`: decode settings,
  - `p`: prompt or persona framing,
  - `pi`: protocol.
- `Q(c)`: explicit distribution over configurations.
- `K`: number of executed trials.
- `y`: measurement-defined outcome class for a trial, which may be a strict contract label or a semantic class induced by `M`.
- `hat(P)_Q(y | x)`: empirical distribution estimated from executed trials.
- `M`: measurement procedure, including extraction, embedding model, preprocessing, and any semantic-normalization or grouping settings.

Design commitments:

1. changing `Q(c)` changes the estimand,
2. changing `M` changes measured structure,
3. both must be recorded as first-class provenance.

### 2.2) Two Uncertainties

Arbiter must keep these distinct in docs, reporting, and implementation messaging:

1. decision uncertainty: dispersion of outcomes under `Q(c)`,
2. estimation uncertainty: finite-sample uncertainty in the estimated signals derived from those outcomes.

### 2.3) Heterogeneity Ladder Posture

Arbiter supports ladder-style heterogeneity studies:

1. H0: fixed single-shot baseline,
2. H1: decode heterogeneity,
3. H2: prompt or persona heterogeneity,
4. H3: cross-model heterogeneity,
5. H4: interaction heterogeneity.

Design posture:

1. interaction is one rung, not the centerpiece,
2. negative H4 results are still valid research outcomes,
3. budget matching is part of experimental discipline and Arbiter records the data needed for budget-aware comparison.

H2 design posture:

1. personas are reasoning-posture interventions, not characters,
2. personas must remain distinguishable from decode, protocol, model, and output-style controls,
3. expanding the persona catalog is research-significant because it changes `Q(c)`.

### 2.4) Claims and Non-Claims

Allowed claims:

1. distributional stability or novelty behavior under a specified `Q(c)` and `M`,
2. reliability-signal behavior under matched experimental conditions,
3. reproducibility, provenance, and auditability properties of the harness.

Disallowed claims:

1. convergence or stopping implies correctness,
2. embedding groups are semantic truth,
3. one protocol is inherently or universally superior,
4. findings under one `Q(c)` automatically generalize to another.

## 3) Product Model and Control Plane

### 3.1) Interaction Products

Arbiter exposes two user-facing interaction products:

1. Wizard TUI for humans in TTY environments,
2. Headless CLI for automation and scripting.

Headless CLI remains the canonical automation surface.

The TUI is a control-plane and monitoring product layered downstream of the run service, event bus, and artifact system. It does not redefine engine semantics.

### 3.2) Stabilized CLI Surface (v1)

Primary entry points:

1. `arbiter`
2. `arbiter init`
3. `arbiter run`

Global flags:

1. `--help`, `-h`
2. `--version`, `-V`

Not part of the public v1 contract:

1. no `--headless`,
2. no `--verbose`,
3. no wizard-only flag such as `--wizard`,
4. no experiment-variable CLI flags,
5. no redundant aliases beyond `-h` and `-V`,
6. no additional public primary commands for verify, report, receipt, resolve, or validate.

Command semantics:

1. `arbiter` launches the Wizard TUI when stdout is a TTY.
2. `arbiter` without TTY stdout prints help and exits `0`.
3. `arbiter init` writes a collision-safe config filename in the current working directory and never overwrites an existing file.
4. `arbiter run` is headless by default and requires `--config <path>`.
5. `arbiter run --dashboard` renders the Stage 2 and Stage 3 human monitor only when stdout is a TTY; otherwise it warns to stderr and continues headless.
6. `arbiter run` override flags are control-plane only: `--out`, `--workers`, `--batch-size`, `--max-trials`, `--mode`, `--dashboard`.
7. experiment variables remain config-defined and are not overridden through the CLI.

### 3.3) Config Discovery and Naming

Wizard config discovery:

1. scope is the current working directory only,
2. qualifying filenames match `^arbiter\\.config(?:\\.[1-9][0-9]*)?\\.json$`,
3. discovered configs are ordered lexicographically by filename,
4. discovery is filename-based; full validity is enforced at Review preflight.

Collision-safe config naming:

1. new config writes use this deterministic sequence:
   - `arbiter.config.json`
   - `arbiter.config.1.json`
   - `arbiter.config.2.json`
   - and so on
2. selection is the first available filename in sequence,
3. existing files are never overwritten.

`arbiter init` and Wizard save paths use the same naming policy.

### 3.4) Stage Model

Arbiter's human run path uses four stages:

1. Stage 0: status and identity context,
2. Stage 1: intake wizard and review,
3. Stage 2: run dashboard,
4. Stage 3: receipt and process exit.

Durable stage behavior:

1. Stage 1 is the only editable study-definition flow.
2. `Run now` converts Stage 1 from editable input into a frozen summary.
3. Stage 2 renders below the frozen Stage 1 summary in the Wizard run path.
4. Stage 2's final snapshot remains visible when Stage 3 renders below it.
5. `arbiter run --dashboard` renders Stage 2 and Stage 3 only; it does not synthesize Stage 1 context.
6. Stage 3 is terminal end state; there is no post-run action hub.
7. success paths exit `0`; non-zero exit is reserved for true run failure.
8. graceful user stop still produces a truthful Stage 3 receipt and partial artifacts.

Exact stage layout, copy, glyphs, and visual composition belong in `docs/product-specs/`.
Detailed internal TUI runtime architecture, render ownership, and migration constraints belong in `docs/TUI-RUNTIME.md`.

### 3.5) Study Definition vs Run Control

Arbiter draws a hard boundary between the study definition and the run control plane.

Study-definition semantics include:

1. question,
2. protocol,
3. model and persona sampling,
4. decode configuration,
5. measurement settings,
6. stop policy and execution policy encoded in the config.

Run-control semantics include:

1. whether the current execution uses `mock` or `live`,
2. whether a dashboard is rendered,
3. the output directory override,
4. worker, batch-size, and max-trials overrides passed at invocation time.

Non-negotiable control-plane rules:

1. `Live` vs `Mock` selects the runner implementation at runtime and does not redefine the study.
2. CLI overrides are execution controls, not changes to the estimand.
3. the source config file is never mutated during run execution.
4. `config.source.json` captures the exact input config as read.
5. `config.resolved.json` captures the exact resolved config used for execution.

### 3.6) Review and Commit Semantics

Review is the only config commit point in the Wizard path.

Commit rules:

1. config remains in memory until explicit commit action,
2. only `Run now` and `Save config and exit` may write a config file,
3. `Revise` returns to editable Wizard state with preserved in-memory selections,
4. `Quit without saving` writes nothing,
5. writes follow the deterministic collision-safe naming policy.

Existing-config path rules:

1. `Run now` executes the selected config and must not rewrite that source file,
2. `Save config and exit` behaves as save-copy and writes a new collision-safe file,
3. revising an existing config operates on an in-memory copy until an explicit commit action occurs.

These rules are control-plane correctness requirements, not mere UI preferences.

## 4) System Architecture and Execution Semantics

### 4.1) System Architecture Map

Primary modules:

- CLI and command flow: `src/cli/`
- config loading, resolution, and policy: `src/config/`
- run orchestration: `src/run/run-service.ts`
- execution engine: `src/engine/`
- protocols: `src/protocols/`
- OpenRouter integration: `src/openrouter/`
- event contracts and bus: `src/events/`
- artifact writing and finalization: `src/artifacts/`
- embeddings finalization: `src/embeddings/`
- monitoring and online grouping implementation: `src/clustering/`
- verify and report tooling: `src/tools/`
- Wizard, Dashboard, and Receipt UI: `src/ui/`

Hard architecture boundary:

1. the engine emits events,
2. UI and artifact writers subscribe to those events,
3. the engine must not import UI code.

### 4.2) Run Lifecycle

Executed runs follow this lifecycle:

1. validate and resolve config,
2. generate deterministic trial plan from seeded RNG,
3. assign deterministic `trial_id` before async execution starts,
4. execute trials and parse outputs,
5. derive embedding inputs and run embeddings when eligible,
6. update monitoring and optional grouping at batch boundaries in `trial_id` order,
7. finalize artifacts atomically and write manifest plus run outputs,
8. verify run integrity through schema and artifact validation.

### 4.3) Determinism and Reproducibility Invariants

Arbiter must preserve these invariants:

1. deterministic seeded trial planning,
2. deterministic `trial_id` assignment before execution,
3. no completion-order monitoring updates,
4. batch-boundary updates applied in ascending `trial_id` order,
5. append-only JSONL writes during execution,
6. atomic finalization for completed artifacts,
7. immutable `config.resolved.json` after execution start.

## 5) Protocol and Measurement Semantics

### 5.1) Independent Protocol

For Independent runs:

1. each trial produces one canonical final model output,
2. parsing and normalized decision output derive from that output,
3. embedding derivation uses that output or a contract-defined `embed_text_source` derived from it.

### 5.2) Debate Protocol

Generalized Debate is part of Arbiter's durable protocol contract.

For Debate runs:

1. `participants = P` with `P >= 2`,
2. `rounds = R` with `R >= 1`,
3. total turns per trial are `P * R + 1`,
4. turn order is slots `A..P` repeated for each round, then slot `A` final,
5. `debate_v1` is a judge-less lead/finalizer protocol; slot `A` is the lead and finalizer,
6. slot roles are fixed by position, not sampled:
   - `A = lead`
   - `B = challenger`
   - `C = counter`
   - `D = auditor`
   - `E+` cycle responder roles in the order challenger -> counter -> auditor,
7. slot assignments are sampled once per trial and remain fixed within that trial,
8. model, persona, and decode assignments are sampled per slot with replacement from the configured pools,
9. role prompts define what each slot is supposed to do; sampled personas modulate how that slot reasons while doing it,
10. role prompts precede persona prompts in prompt composition,
11. the final response from slot `A` is the canonical trial output,
12. parsing, normalized decision output, and embedding derivation apply to that final slot `A` output only,
13. intermediate turns must be preserved for auditability in per-trial `transcript` records with role and round metadata.

This final-output rule is a measurement semantic, not only a UI or reporting convention.

### 5.3) Parse Semantics

`parse_status` meanings:

1. `success`: contract-valid structured output,
2. `fallback`: contract parse failed but usable text exists,
3. `failed`: no usable text.

Default policy posture:

1. contract failures map to `fallback` when usable text exists,
2. silent parse failure must not be treated as success,
3. `failed` is reserved for cases with no usable text.

### 5.4) Embedding Semantics

Embedding eligibility requires non-empty normalized `embed_text`.

`embed_text` derivation rules:

1. normalize line endings to `\\n`,
2. trim trailing whitespace,
3. deterministically truncate by prefix using `measurement.embedding_max_chars`,
4. skip embeddings when text is empty after normalization.

### 5.5) Provenance Semantics

Per-trial provenance expectations:

1. log requested generation model,
2. log actual generation model from the OpenRouter response body `model` field when available,
3. for embeddings, log requested and actual embedding model,
4. record `generation_id` when the provider returns it.

Provenance is required for reproducibility, provider drift audit, and paper support.

## 6) Monitoring, Groups, and Stopping

### 6.1) Monitoring Semantics

Monitoring is evaluated only at batch boundaries.

Monitoring records:

1. describe batch-level novelty behavior under the configured measurement procedure,
2. may drive advisory or enforced stopping depending on stop mode,
3. are recorded in `monitoring.jsonl`.

### 6.2) Novelty-Saturation Stopping

Stopping semantics:

1. evaluate stop conditions only at batch boundaries,
2. rely on measurement signals such as `novelty_rate` and `mean_max_sim_to_prior`,
3. require eligible trials before stop logic activates through `k_min`,
4. `advisor` mode records would-stop state without ending the run,
5. `enforcer` mode may stop when configured novelty-saturation conditions are met.

Interpretation boundary:

1. stopping indicates diminishing novelty under configured measurement conditions,
2. stopping does not imply truth, correctness, or semantic convergence.

### 6.3) Online Grouping Semantics

When embedding grouping is enabled:

1. grouping updates occur at batch boundaries with deterministic ordering,
2. group IDs are sequential in discovery order and are not reused,
3. `group_distribution` is dense and aligned to `group_id`,
4. JS divergence measures cumulative distribution shift across batches,
5. group-limit behavior is surfaced through limit and forced-assignment counters.

### 6.4) Terminology and Compatibility Boundary

Runtime, artifact, event, dashboard, and receipt vocabulary uses:

1. `monitoring`, not `convergence`,
2. `group` or `groups`, not `cluster` or `clusters`.

Intentional compatibility exception:

1. config input still uses `measurement.clustering` and related clustering-shaped knobs,
2. that exception is deliberate compatibility policy, not accidental drift,
3. future cleanup must not opportunistically rename the config surface without an explicit schema migration plan.

## 7) Artifact Contract

### 7.1) Run Directory

Executed run directories live at:

- `runs/<run_id>/`

`run_id` format:

- `YYYYMMDDTHHMMSSZ_<random6>`

This section defines the v1 executed-run artifact contract.

### 7.2) Always-Produced Executed-Run Artifacts

Executed runs always produce:

1. `config.source.json`
2. `config.resolved.json`
3. `manifest.json`
4. `trial_plan.jsonl`
5. `trials.jsonl`
6. `monitoring.jsonl`
7. `receipt.txt`

### 7.3) Conditional Artifacts

Conditionally produced artifacts:

1. `embeddings.arrow` when at least one eligible embedding is successfully finalized,
2. `embeddings.jsonl` as fallback when Arrow is not generated, or when debug behavior explicitly retains JSONL embeddings,
3. `groups/assignments.jsonl` and `groups/state.json` when grouping artifacts are emitted,
4. debug artifacts such as `debug/events.jsonl` and `debug/execution.log` only when debug mode is enabled.

### 7.4) Consolidation Rules

Canonical artifact rules:

1. `trials.jsonl` is the canonical per-trial record and includes parse and embedding summaries,
2. Debate intermediate turns live inside per-trial `transcript` records in `trials.jsonl`,
3. final stable runtime summary metrics and embedding provenance summary live in `manifest.json`,
4. paper-facing downstream analysis artifacts are separate from `manifest.json` and may use dedicated schema-validated contracts,
5. this contract supersedes legacy names such as `parsed.jsonl`, `convergence_trace.jsonl`, `aggregates.json`, `embeddings.provenance.json`, and `clusters/*`.

### 7.5) Run Classes

Run-class interpretation rules:

1. executed runs follow the always-produced and conditional artifact contract above,
2. resolve-only runs are a separate run class and do not claim executed-run completeness,
3. resolve-only runs produce only `config.resolved.json` and `manifest.json`,
4. pre-start failures may emit partial diagnostics but must not be represented as completed executed runs,
5. planning-only workflows do not produce the full executed-run artifact set.

### 7.6) Receipt Semantics

Stage 3 Receipt is an artifact-backed summary surface.

Receipt rules:

1. executed runs produce `receipt.txt` regardless of whether the dashboard is rendered,
2. the terminal receipt lists only files that actually exist,
3. absence of embeddings due to zero eligible trials is reported as an explanatory condition, not as an execution error,
4. the receipt includes a reproducibility command anchored to the exact resolved run config so the executed run can be rerun faithfully,
5. receipt rendering must not destroy terminal scrollback of the completed run path.

## 8) Verification and Documentation Discipline

### 8.1) Before Trusting Results

Before trusting a run:

1. validate run artifacts and schema conformance,
2. inspect `manifest.json` for policy and provenance snapshot,
3. inspect `monitoring.jsonl` for stopping context,
4. confirm requested versus actual model identifiers,
5. distinguish measurement outcomes from correctness claims.

### 8.2) Before Merging Behavior Changes

Before merge for behavior changes:

1. use the quality gates from `AGENTS.md`,
2. update this document when durable semantics changed,
3. update product specs when exact human-facing behavior changed,
4. do not leave permanent truth only in a completed ExecPlan.

### 8.3) Scope Boundaries

In scope:

1. deterministic experiment execution,
2. artifact and provenance capture,
3. online monitoring and optional online grouping,
4. run verification and textual reporting,
5. the control-plane boundary between study definition and execution.

Out of scope:

1. offline heavy statistical inference pipelines,
2. publication-quality plotting and figure generation,
3. claims requiring semantic guarantees beyond the measurement contract,
4. using UI, stopping, or grouping outputs as proof of correctness.

## 9) Default When Uncertain

When uncertainty remains after consulting schemas and this document:

1. preserve determinism,
2. preserve provenance integrity,
3. preserve artifact auditability,
4. prefer conservative behavior over convenience,
5. record any remaining assumption in the implementation summary or active plan.
