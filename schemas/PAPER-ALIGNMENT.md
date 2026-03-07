# Schema Alignment for Current Paper

This document maps the current paper's methodological contract onto the schema layer.

Use it when the question is:

1. which current schemas already support the paper's scientific contract,
2. which schemas are operational-first rather than paper-first,
3. which paper-facing objects are still missing from the schema layer,
4. what should be promoted into new schemas next.

This is a bridge document.

It does **not** replace:

1. `/Users/darylkang/Developer/arbiter/docs/RESEARCH-METHOD.md` for the scientific contract,
2. `/Users/darylkang/Developer/arbiter/docs/DESIGN.md` for durable harness semantics,
3. `/Users/darylkang/Developer/arbiter/schemas/README.md` for general schema workflow and policy.

## 1. Current Paper Contract

The current paper is centered on:

1. explicit `Q(c)` as estimand-defining,
2. free-form semantic outcome estimation under co-estimand-defining `M`,
3. labeled evaluation as the validation backbone for the strongest empirical claims,
4. primary reliability signals such as top-choice mass and top-two margin,
5. estimation uncertainty as a first-class output,
6. fixed-budget ladder comparisons across heterogeneity sources,
7. a strict boundary between Arbiter's raw artifact layer and downstream paper analysis.

The schema layer should therefore be judged not only on runtime validity, but on whether it preserves enough structure to make those claims reproducible and auditable.

## 2. What Is Already Well Covered

### 2.1 `Q(c)` Materialization and Trial Planning

Current schemas that already support this well:

- `config.schema.json`
- `trial-plan.schema.json`
- `trial.schema.json`

These collectively preserve:

1. weighted model, persona, and protocol pools,
2. decode settings,
3. protocol identity,
4. per-trial assigned configurations,
5. role assignments for interaction protocols.

This is the strongest part of the paper-facing contract today.

### 2.2 Raw Trial Evidence

Current schemas that already support this well:

- `trial.schema.json`
- `parsed-output.schema.json`

These preserve:

1. raw assistant text,
2. parsed outcome and rationale,
3. parse status and parser version,
4. request and response payloads,
5. call-level traces for multi-call protocols,
6. per-trial usage and latency evidence.

This is the second strongest part of the schema layer.

### 2.3 Measurement Inputs and Embedding Provenance

Current schemas that already support this well:

- `config.schema.json`
- `embedding.schema.json`
- `embeddings-provenance.schema.json`

These preserve:

1. requested embedding model,
2. actual embedding model when available,
3. embed-text strategy,
4. embedding success/failure/skip state,
5. vector encoding and dimensionality,
6. generation IDs and truncation evidence.

This makes the free-form semantic path auditable, even if it is not yet fully elevated into paper-facing output schemas.

## 3. What Is Operational-First Rather Than Paper-First

Current schemas in this category:

- `monitoring.schema.json`
- `aggregates.schema.json`
- `group-state.schema.json`
- `group-assignment.schema.json`

These are valid and useful.

They primarily support:

1. online stopping heuristics,
2. novelty tracking,
3. grouping-state persistence,
4. operational dashboards and receipts,
5. exploratory semantic-structure inspection.

They should **not** be mistaken for the paper's primary output layer.

The current paper says:

1. online monitoring is operational first,
2. semantic outcome estimation is scientific first,
3. grouping artifacts are measurement-defined and useful,
4. grouping artifacts are not automatically the paper's main object.

## 4. Where the Schema Layer Is Still Too Weak

### 4.1 Primary Scientific Outputs Are Still Missing

The current paper calls these first-class scientific objects:

1. per-instance semantic outcome distributions,
2. primary reliability signals,
3. estimation-uncertainty outputs,
4. rung-level paper comparison outputs.

Today, the schema layer does **not** yet contain dedicated artifact contracts for those objects.

The practical consequence is that:

1. raw experiment evidence is strongly typed,
2. operational summaries are strongly typed,
3. paper-facing analysis outputs are still mostly outside the schema layer.

### 4.2 `manifest.json` Is Too Open Where It Matters Most

`manifest.schema.json` still leaves:

1. `measurement`
2. `metrics`

as open objects.

That is acceptable as transitional infrastructure, but it is not the desired end state for paper-critical summaries.

### 4.3 `M` Is Only Partially Encoded as a Co-Estimand-Defining Contract

Today, parts of `M` live in:

1. `config.measurement`,
2. decision-contract resources,
3. runtime behavior,
4. downstream analysis assumptions.

That is too fragmented for a paper whose primary semantic path explicitly depends on `M`.

### 4.4 Labeled Validation Is Under-Contracted

The current paper treats labeled tasks as the empirical validation backbone.

But the current question contract is still too thin to preserve:

1. ground-truth label,
2. reference answer,
3. adjudication provenance,
4. dataset-level identity in a stable reproducible way.

That means correctness-based claims are not yet fully recoverable from run artifacts alone.

## 5. Promotion Rules for Future Schemas

Add a new paper-facing schema when all of the following are true:

1. the object is needed for the paper's primary claims or the canonical analysis path,
2. the object should be reproducible and machine-verifiable across runs,
3. the object has a stable enough meaning to deserve a long-lived contract,
4. leaving it as an untyped blob would weaken auditability or reproducibility.

Do **not** add a new schema just because a quantity is interesting once.

Operational heuristics, exploratory statistics, and unstable experimental diagnostics should remain outside the core schema set until they are promoted intentionally.

## 6. Likely Next Schema Additions

Ordered by dependency.

### 6.1 Analysis Artifact Schemas

Most likely additions:

1. a per-instance outcome-distribution artifact,
2. a primary reliability-signal artifact,
3. an estimation-uncertainty artifact,
4. an optional rung-comparison or dataset-summary artifact.

These should be added only after the analysis-pipeline contract is frozen enough to make them stable.

### 6.2 Stronger Measurement Contract

Likely evolution areas:

1. better normalization and extraction provenance,
2. clearer preprocessing and truncation policy fields,
3. more explicit semantic-grouping procedure configuration where that becomes stable.

### 6.3 Stronger Labeled-Evaluation Contract

Likely evolution areas:

1. stable label-bearing question or dataset-record schema,
2. explicit reference-answer or adjudication metadata,
3. enough information to reproduce correctness-based claims from artifacts alone.

## 7. What Should Not Be Promoted Prematurely

Do not prematurely freeze:

1. every monitoring field as a paper-facing analysis contract,
2. novelty saturation as a scientific guarantee,
3. online groups as semantic truth,
4. one clustering algorithm as the only valid meaning of `M`,
5. one provisional analysis feature set as the final paper feature set.

The schema layer should protect meaning, not overfit to transient analysis fashion.

## 8. Review Questions for Future Schema Changes

Before approving a research-significant schema change, ask:

1. does this change alter `Q(c)` or `M`?
2. does it affect what is reproducible from run artifacts alone?
3. is it operational-only or paper-facing?
4. is the new object stable enough to deserve a schema?
5. does the change belong in the harness contract, the paper contract, or the downstream analysis spec?

If those questions are not answered, the schema change is probably premature.
