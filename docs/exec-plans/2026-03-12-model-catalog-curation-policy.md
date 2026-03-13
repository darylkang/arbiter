# Model Catalog Curation Policy

## Purpose / Big Picture

The current checked-in model catalog should be treated as scaffolding, not canon.

Arbiter needs a research-facing model catalog that is:

1. small enough to scan and justify,
2. broad enough to represent major mainstream providers and cost-capability strata,
3. grounded in models that are actually available through OpenRouter,
4. stable enough to support reproducible studies,
5. refreshable enough that it does not drift into irrelevance.

This plan freezes the **curation policy** for the model catalog before the catalog itself is rewritten.

It is separate from the `Models`-step form plan. The form plan defines how models render in the TUI. This plan defines which models deserve inclusion and how the catalog should evolve over time.

## Scope Guardrails

### In scope

1. defining the authoritative curation principle for the checked-in model catalog,
2. freezing provider-coverage rules,
3. freezing tier-coverage rules,
4. freezing default inclusion rules for model families,
5. freezing alias-versus-pinned policy,
6. freezing the relationship between the committed catalog and OpenRouter live inventory,
7. defining the future refresh-on-demand workflow at a policy level,
8. deciding what should be automatic versus human-curated in future refreshes.

### Out of scope

1. implementing the refresh script,
2. rewriting the catalog entries in this round,
3. changing the Stage 1 `Models` step UI,
4. adding grouped layouts or weighting controls,
5. committing the final curated set in this round,
6. provider-specific pricing logic beyond what is needed for tier assignment.

## Progress

- [ ] `M0` Curation principles frozen.
- [ ] `M1` Policy and maintenance contract documented.
- [ ] `M2` Closeout and handoff to catalog implementation.

## Current-State Inputs

Authoritative source of candidate availability:

- official OpenRouter Models API: [`GET /api/v1/models`](https://openrouter.ai/docs/api-reference/api-reference/models/get-models)
- overview documentation: [OpenRouter Models](https://openrouter.ai/docs/docs/overview/models)

Important current facts:

1. OpenRouter exposes a very large and volatile inventory.
2. Anthropic maps cleanly to a recognizable family ladder (`Haiku`, `Sonnet`, `Opus`).
3. OpenAI, Google, and Meta are materially messier and require human curation rather than blind family mirroring.
4. A research-grade catalog cannot simply mirror the full OpenRouter inventory.

## Decision Log

1. The committed catalog is the authoritative research-facing set.
2. OpenRouter live inventory is the authoritative source of candidate availability and refreshable factual metadata, not the source of truth for what Arbiter should present by default.
3. The catalog may be rewritten from first principles; the current placeholder set does not carry preservation weight.
4. The default family rule is **latest stable version only per family**.
5. Distinct provider-defined families at different strata (for example `Haiku`, `Sonnet`, `Opus`) count as different models, not different versions.
6. The catalog should prefer pinned/versioned slugs over aliases when both are available and viable.
7. Free-tier representation is mandatory because it serves a distinct product and research function.
8. Popularity may be used as a candidate-ranking signal in a future refresh workflow, but not as the authoritative inclusion rule.

## Curation Principles

### 1. Research-facing inclusion rule

A model belongs in the committed catalog only if it can be justified in one sentence as a meaningful research-facing or operator-facing inclusion.

Acceptable justification shapes:

- represents a major provider at a meaningful cost-capability stratum,
- represents a distinct family or architecture likely to matter for H3 heterogeneity,
- provides free-tier access for pilot studies and zero-budget exploration,
- serves as a reproducible pinned reference for a mainstream family.

Insufficient justification:

- it exists on OpenRouter,
- it is new,
- it is popular,
- it is a minor older variant of a family already represented.

### 2. Family rule

Default rule:

- include only the **latest stable version** of a given model family.

Examples of what this means:

- keep the latest pinned `GPT-4o` version rather than multiple older pinned `GPT-4o` versions,
- keep the latest stable `Gemini Flash` rather than multiple stale Flash versions,
- keep the latest stable `Claude Sonnet` rather than multiple older Sonnet revisions.

Exceptions are allowed only when:

1. two slugs represent genuinely different provider-defined families or strata rather than stale revisions,
2. or an older pinned slug must remain temporarily for reproducibility during an active research transition.

### 3. Provider coverage rule

The eventual curated set should represent the major mainstream provider families available through OpenRouter.

Default target providers:

- Anthropic
- OpenAI
- Google
- Meta

Secondary providers may be included when they fill a meaningful gap in a stratum or provide a scientifically interesting open-weight comparison, but they are not required in the first-pass curated set.

### 4. Tier coverage rule

The visible tier vocabulary is:

- `flagship`
- `mid`
- `budget`
- `free`

Curation rule:

- every visible tier should have meaningful representation,
- free must remain explicitly represented,
- no provider is guaranteed presence in every tier,
- tiers describe **cost-capability strata**, not quality rankings.

### 5. Alias versus pinned rule

Default rule:

- prefer pinned/versioned slugs when a stable pinned slug exists.

Allow aliases only when:

1. the provider's alias is the practical public entry point,
2. or no stable pinned equivalent is yet viable,
3. and the reproducibility risk is explicitly surfaced in the catalog via `is_aliased` and `risk_note`.

### 6. Exclusion rule

Do not include models by default when they are primarily:

- preview or unstable variants,
- multimodal/image/audio specialist variants outside the current text-first workflow,
- reasoning-specialist models whose behavior would require a separate protocol or evaluation contract,
- stale older revisions of a family already represented,
- narrow domain-specialist variants unless the study explicitly needs them.

## Maintenance Model

### Authoritative artifacts

The future maintenance model is hybrid:

1. the committed catalog remains authoritative,
2. OpenRouter API data provides candidate factual updates,
3. a future refresh-on-demand script proposes updates,
4. a human reviews and commits them.

### Future refresh workflow shape

A future refresh workflow should:

1. call the official OpenRouter Models API,
2. evaluate candidate models against a checked-in policy/recipe,
3. flag catalog entries that no longer exist or have changed materially,
4. propose candidate additions for human review,
5. never auto-commit or silently mutate the authoritative catalog.

### Policy / recipe inputs the refresh workflow should eventually support

The checked-in policy should be able to express things like:

1. major providers to represent,
2. whether to include only the latest stable model per family,
3. whether preview models are allowed,
4. required free-tier representation,
5. pinned-over-alias preference,
6. optional popularity or usage signals as candidate-ranking tie-breakers,
7. exclusions for modalities or specialist families that do not fit the current research posture.

### Human-curated vs machine-refreshable responsibility

Human-curated decisions:

- whether a model is in the catalog,
- displayed `display_name` when override is needed,
- `tier`,
- `default`,
- `sort_order`,
- `summary_line`,
- `research_note`,
- `risk_note`,
- any free-form `notes`.

Machine-refreshable facts:

- whether the slug currently exists on OpenRouter,
- provider identity,
- context window,
- raw OpenRouter family/version metadata that can support review.

## Milestones and Gates

### `M0` Freeze the curation principles

Outcome:

- the catalog selection rules are explicit and no longer implicit in the placeholder set.

Exit evidence:

1. this plan records the provider-coverage rule,
2. this plan records the tier-coverage rule,
3. this plan records the family/latest-version rule,
4. this plan records the alias-versus-pinned rule,
5. this plan records the exclusion rule.

### `M1` Freeze the maintenance contract

Outcome:

- the project has a clear future policy for keeping the catalog fresh without giving up reproducibility.

Exit evidence:

1. the role of OpenRouter API versus committed catalog is explicit,
2. the future refresh-on-demand workflow is described,
3. human-curated vs machine-refreshable fields are explicitly separated,
4. the expected policy/recipe inputs are recorded.

### `M2` Closeout and handoff to catalog implementation

Outcome:

- the policy layer is finished and ready to drive the actual catalog rewrite.

Exit evidence:

1. this plan is marked complete,
2. a subsequent implementation round can rewrite the catalog from first principles without ambiguity,
3. the `Models`-step form plan remains compatible with the policy frozen here.

## Acceptance Criteria

This policy round is complete when all of the following are true:

1. The project has an explicit answer to whether catalog freshness is manual, automatic, or hybrid.
2. The project has an explicit answer to whether latest-version-only per family is the default rule.
3. The project has an explicit answer to how providers and tiers should be represented.
4. The project has an explicit answer to when aliases are acceptable.
5. The project has an explicit answer to how OpenRouter data should inform, but not silently redefine, the curated catalog.

## Idempotence and Recovery

1. This plan is docs-only and reversible.
2. If later empirical or product constraints require a broader or narrower curated set, update the policy deliberately rather than encoding the change ad hoc in the catalog.
3. If a future refresh workflow proves too noisy, keep the policy but postpone the automation; the committed catalog remains sufficient.

## Interfaces and Dependencies

Depends on:

- `/Users/darylkang/Developer/arbiter/docs/exec-plans/2026-03-12-models-step-overhaul.md`
- `/Users/darylkang/Developer/arbiter/resources/models/catalog.json`
- official OpenRouter Models API documentation

Likely future dependents:

- `/Users/darylkang/Developer/arbiter/schemas/catalog.schema.json`
- `/Users/darylkang/Developer/arbiter/resources/models/catalog.json`
- a future refresh script and policy file
- TUI Step 3 implementation work

## Plan Change Notes

- 2026-03-12: Initial curation-policy plan drafted from current OpenRouter inventory shape, the current placeholder catalog, and the refined Models-step form contract.
