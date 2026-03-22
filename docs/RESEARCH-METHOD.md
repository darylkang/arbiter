# Arbiter Research Method Contract

`RESEARCH-METHOD.md` is the canonical repo-local bridge between the research briefs and the harness.

It has four jobs:

1. define the current paper's methodological contract in implementation-facing terms,
2. state what the paper's primary estimand and first-class outputs actually are,
3. separate durable harness infrastructure from paper-specific analysis commitments,
4. prevent the scientific core from drifting into Notion-only prose, ad hoc schemas, or implementation accidents.

This document is intentionally narrower than `docs/DESIGN.md`. `DESIGN.md` owns durable cross-project semantics for Arbiter as a harness. This document owns the current paper's research-method commitments.

## 1) Authority and Scope

### 1.1) Document Boundary

Use this document when the question is:

- what the current paper is actually estimating,
- what counts as a primary scientific output,
- what role `Q(c)` and `M` play in the estimand,
- how to separate online operational monitoring from paper-facing analysis,
- which methodological assumptions are frozen versus still exploratory.

This document does not own:

- raw schema shape details,
- CLI or TUI behavior contracts,
- general contributor workflow,
- rollout sequencing.

The Notion research brief defines the estimand as `P_Q(y | x)` with `Y` finite and task-given, and it positions discrete-label evaluation as the primary path for the paper's strongest claims. This document intentionally extends that framing by making `M` co-estimand-defining and by elevating free-form semantic outcome estimation as the most general estimand formalism that the harness must support. The brief remains the source for thesis, positioning, and related-work strategy. This document is the source for how that methodological contract is implemented in the repository.

### 1.2) Authority Order

For research-significant implementation work, use this order:

1. `schemas/` for contract shapes and field names,
2. `docs/DESIGN.md` for durable harness semantics and interpretation boundaries,
3. this document for the current paper's methodological contract and analysis boundary,
4. `README.md` for operator workflow,
5. `AGENTS.md` and `docs/PLANS.md` for contributor process.

The Notion research briefs remain important source material, but once a methodological commitment is recorded here, this file becomes the implementation-facing source of truth for that commitment.

## 2) Core Research Contract

Arbiter supports a methodology paper on reasoning as a distribution under heterogeneous, budget-matched sampling.

The paper's core claim is not that Arbiter discovers truth or improves correctness by itself. The paper's claim is that:

1. an explicit configuration distribution `Q(c)` induces a measurable distribution over outcomes,
2. different heterogeneity sources can be compared under matched budgets,
3. both decision uncertainty and estimation uncertainty should be reported as first-class outputs.

The heterogeneity ladder remains the central experimental structure:

1. `H0`: fixed single-shot baseline,
2. `H1`: decode heterogeneity,
3. `H2`: prompt/persona heterogeneity,
4. `H3`: cross-model heterogeneity,
5. `H4`: interaction heterogeneity.

Interaction is one rung in the ladder, not the entire thesis.

### 2.1) Persona Principle for H2

For the current paper, Arbiter personas are prompt-level reasoning-posture interventions.

They are included in the H2 axis only when all three conditions hold:

1. the persona targets an articulable shift in reasoning behavior,
2. that shift is expected to induce a measurably different outcome distribution under `Q(c)`,
3. the shift is not more cleanly controlled by another axis such as decode, protocol, model selection, or output formatting.

This means Arbiter personas are not:

1. characters or roleplay identities,
2. demographic or occupational framings,
3. verbosity or formatting controls,
4. substitutes for protocol or decode choices.

The current v1 H2 posture set is:

1. `Neutral`
2. `Skeptical`
3. `Analytical`
4. `Exploratory`
5. `Decisive`

These personas are intended to create a small, interpretable library of reasoning postures rather than a broad catalog of stylistic prompt variants.

Implementation note:

1. stable config/artifact IDs currently remain `persona_neutral` -> `Neutral` and `persona_precise` -> `Analytical` for backward-compatible v1 continuity,
2. display labels are the researcher-facing names and should be used in UI and analysis narration.

The expected distributional effects associated with these personas are design hypotheses, not guarantees. In particular, the v1 `Neutral` condition is a format-matched control: it adds a generic pre-conclusion review step without steering a specific reasoning posture.

Current v1 directional hypotheses:

1. `Neutral`: expected to absorb prompt-presence effects without steering answers toward a specific reasoning posture.
2. `Skeptical`: expected to widen the distribution by increasing objections, caveats, or reversals.
3. `Analytical`: expected to increase structured, decomposition-led answers and reduce leaps to conclusion.
4. `Exploratory`: expected to widen the distribution by surfacing more alternative framings or candidate conclusions.
5. `Decisive`: expected to tighten the distribution around clearer top-choice outputs.

Interpretation guidance:

1. `Neutral` provides a prompt-present control, so contrasts against the four treatment personas better isolate posture effects than the prior empty-baseline design.
2. The current 5-condition design no longer measures the effect of prompt presence alone; recovering that comparison would require a separate no-prompt control condition.
3. Debate-role interactions are not equally interpretable across slots: persona effects are easiest to interpret on proposer roles and more conflated on critic roles whose protocol prompt already demands objection-finding behavior.

## 3) Primary Estimand

### 3.1) Core Objects

- `x`: input instance.
- `c = (m, d, p, pi)`: configuration tuple:
  - `m`: model or provider identity,
  - `d`: decode settings,
  - `p`: prompt or persona framing,
  - `pi`: protocol.
- `Q(c)`: explicit user-specified distribution over configurations.
- `K`: number of executed trials.
- `s_k`: raw free-form model output observed on trial `k`.
- `M`: measurement procedure that maps raw outputs into measurement-defined outcome structure.

### 3.2) Primary Path: Free-Form Semantic Outcome Estimation

For the current paper, the primary path is not a fixed discrete task label supplied from outside the harness.

The primary path is:

1. run `K` trials under `Q(c)`,
2. collect free-form outputs,
3. apply a specified measurement procedure `M`,
4. induce measurement-defined semantic outcome classes,
5. estimate the resulting outcome distribution.

Formally, the paper's primary estimand is:

`P_(Q,M)(y | x)`

where `y` is a measurement-defined semantic outcome class produced by `M`.

This is a stronger commitment than treating semantic clustering as a secondary convenience. It means:

1. `Q(c)` remains estimand-defining,
2. `M` is also estimand-defining,
3. changing either `Q` or `M` changes what is being estimated.

This means that `P_(Q,M)(y | x)` is the paper's most general estimand formalism. It does not mean that discrete-label evaluation is deprioritized. The paper's strongest empirical claims, including AUROC, selective prediction, and calibration, still require tasks with known ground truth, where `y` may come from a task-defined label set. On those tasks, `M` reduces to a normalization layer and the estimand simplifies to `P_Q(y | x)`.

### 3.3) What `M` Includes

For this paper, `M` may include:

1. structured extraction or normalization from raw assistant text,
2. choice of source text used for semantic comparison,
3. preprocessing and truncation rules,
4. embedding model and embedding provider behavior,
5. similarity metric and normalization rules,
6. clustering or semantic grouping procedure,
7. thresholds, ordering rules, and any deterministic tie-breaking,
8. any optional mapping from groups to human-readable labels.

Because the primary path is semantic and free-form, these choices are not implementation detail. They are part of the measurement definition.

### 3.4) Discrete-Label Path

Discrete-label tasks remain essential even though they are not the most general formalization of the estimand.

In that case:

1. `y` may come directly from a task label set or a strict decision contract,
2. `M` reduces to a simpler normalization layer,
3. the same `Q(c)` framing still applies.

Free-form semantic outcome estimation under `M` is the paper's distinctive methodological contribution. Discrete-label evaluation is the paper's validation backbone. Both are essential.

## 4) First-Class Scientific Outputs

The harness must ultimately support these first-class outputs for the paper:

1. raw per-trial records sufficient to reconstruct trial conditions, outputs, provenance, and budgets,
2. per-instance semantic outcome distributions estimated under `Q(c)` and `M`,
3. decision-uncertainty features derived from those outcome distributions,
4. estimation-uncertainty outputs on those features,
5. rung-level comparisons under matched model-call budgets,
6. provenance and budget summaries sufficient to audit the experiment.

At minimum, decision-uncertainty reporting should support:

1. top-choice mass,
2. entropy or another dispersion statistic,
3. margin between leading outcomes when well-defined.

At minimum, estimation-uncertainty reporting should support:

1. interval estimates on the primary per-instance uncertainty quantities,
2. convergence or precision curves as `K` increases.

The exact estimator family for those intervals may vary by quantity, but it must be fixed in the experiment analysis specification before paper claims are made.

## 5) Analysis Boundary

Arbiter is primarily the experiment harness and data-collection layer.

The paper analysis is a downstream step.

### 5.1) Arbiter Owns

Arbiter is responsible for producing:

1. deterministic trial planning,
2. raw per-trial outputs and parsed records,
3. provenance and budget logging,
4. resolved configuration and measurement settings,
5. operational monitoring signals needed to manage execution safely.

### 5.2) Downstream Analysis Owns

The paper analysis layer is responsible for computing:

1. per-instance semantic outcome distributions,
2. decision-uncertainty features,
3. estimation-uncertainty intervals and convergence curves,
4. selective-prediction, calibration, AUROC, and other evaluation figures,
5. final rung-level comparison tables and plots.

This separation is intentional. It prevents operational execution logic from silently becoming the scientific contract.

When those downstream outputs are stabilized enough to deserve machine-readable persistence, they should use dedicated analysis artifact contracts rather than open manifest blobs.

The analysis-pipeline specification will live in a separate document. This document governs only the boundary between harness and analysis, not the analysis internals.

## 6) Online Monitoring Versus Paper Measurement

Arbiter currently emits online monitoring and grouping artifacts such as novelty, similarity, grouping, and saturation signals.

Those signals are useful, but they are not automatically the paper's primary outputs.

For the current paper:

1. online monitoring is operational first,
2. semantic outcome estimation is scientific first,
3. overlap between the two is allowed but must be explicit.

Important boundary:

1. current online groups are measurement-defined artifacts under the configured runtime procedure,
2. they are not ontological semantic truth,
3. they must not be treated as ground-truth categories simply because they are convenient to compute online.

If the paper uses semantic clustering as a primary path, that usage must still remain explicit about measurement dependence and approximation error.

## 7) Stopping Contract

Stopping must remain scientifically honest.

Current rule:

1. online stopping may use operational heuristics such as novelty or saturation under the configured runtime measurement,
2. online stopping does not imply correctness, semantic truth, or sufficient scientific certainty.

Paper-facing convergence claims should be based on downstream estimation-uncertainty analysis, not on the existence of an online stop event by itself.

If future work introduces CI-width-based or precision-target-based stopping, that change must be documented here before it is treated as canonical.

## 8) Budget-Matching Contract

Budget matching is part of the paper's discipline, not an optional reporting convenience.

The primary matched budget axis is:

1. model calls per instance per rung.

Secondary quantities must still be logged and reported:

1. tokens,
2. cost,
3. latency.

If two rung comparisons are call-matched but materially diverge on token or cost budgets, that sensitivity must be reported in the analysis.

## 9) Frozen Versus Exploratory

### 9.1) Frozen Now

The following are part of the current methodological contract:

1. explicit `Q(c)` is estimand-defining,
2. the primary paper path uses free-form semantic outcome estimation under `M`,
3. `M` is co-estimand-defining on that path,
4. decision uncertainty and estimation uncertainty are separate objects,
5. the harness must preserve enough raw data and provenance to support downstream uncertainty analysis,
6. interaction is one rung, not the whole thesis,
7. convergence does not imply correctness.

### 9.2) Exploratory or Still Adjustable

The following remain adjustable unless and until they are explicitly frozen by an experiment-specific analysis contract:

1. exact embedding model,
2. exact clustering algorithm and thresholds,
3. exact interval estimator and replicate count,
4. exact feature set beyond the baseline uncertainty quantities,
5. exact online stopping heuristic,
6. exact dataset mix and benchmark selection.

## 10) Implications for Schemas and Artifacts

This document implies the following for future schema and artifact work:

1. the schema layer must prioritize artifacts sufficient to reconstruct `P_(Q,M)(y | x)` offline,
2. raw trial artifacts are more foundational than online monitoring summaries,
3. primary scientific outputs must not remain implicit in untyped manifest blobs,
4. online monitoring artifacts may remain exploratory until they are explicitly promoted into the paper contract,
5. schema changes that alter `Q(c)` or `M` are research-significant and must be documented as such.

Current schema alignment is strongest in:

1. `Q(c)` materialization and deterministic trial planning,
2. raw trial evidence, parsing records, and provenance,
3. measurement inputs and embedding provenance,
4. minimal stable paper-facing analysis artifacts.

Current schema alignment remains thinner in:

1. richer downstream analysis provenance,
2. fuller end-to-end encoding of `M`,
3. labeled-evaluation metadata sufficient to reproduce correctness-based claims from artifacts alone.

This is intentional. The schema layer should freeze durable meaning, not every transient analysis choice.

## 11) Change Control

Update this document when any of the following change:

1. the definition of `y`,
2. the role of semantic clustering in the paper,
3. the boundary between Arbiter outputs and downstream analysis,
4. the set of first-class scientific outputs,
5. the interpretation of online stopping or convergence,
6. the meaning of budget matching.

When those changes also affect durable cross-project semantics, update `docs/DESIGN.md` as well.
