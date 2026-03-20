# Model Catalog Retiering and Metadata Enrichment

## Purpose / Big Picture

The current model catalog foundation is usable, but it is not yet rigorous enough for the next phase.

Two things need to happen together:

1. the catalog needs to be **retiered from first principles** using Anthropic's clean provider ladder as the calibration anchor,
2. the catalog needs to preserve **more factual OpenRouter-backed metadata** in the backend layer so future UI, refresh, and provenance work does not depend on repeated re-fetching or ad hoc schema growth.

This work is not just catalog cleanup. It is the point where Arbiter's model axis becomes a more serious research artifact.

The current catalog already has a good presentation layer for the Stage 1 Models step. What is still missing is a stronger factual substrate and a more defensible tiering and curation contract.

This plan addresses:

1. metadata storage design,
2. tier calibration,
3. provider and family curation logic,
4. ordering rules,
5. committed-catalog versus candidate-pool discipline.

It intentionally does **not** redesign the Models-step UI again in this round. The UI should consume the improved catalog, not drive catalog truth.

## Scope Guardrails

### In scope

1. freezing the backend metadata contract for the model catalog,
2. deciding which OpenRouter API fields should be preserved in the committed catalog,
3. retiering the model families using a first-principles calibration anchor,
4. defining provider-ordering and within-tier ordering rules,
5. defining the difference between:
   - candidate pool,
   - committed curated set,
   - deferred models,
6. freezing a principled expansion rule for greater provider variety,
7. defining what is authoritative versus derived in the catalog layer.

### Out of scope

1. redesigning the Stage 1 Models-step UI beyond later selective use of richer metadata,
2. implementing a refresh-on-demand script,
3. changing the current reasoning-model exclusion rule,
4. adding popularity or website-scraped ranking as authoritative catalog input,
5. changing run-time sampling semantics,
6. changing the Personas axis,
7. changing Stage 2 or Stage 3 rendering.

### Sequencing constraints

1. Freeze the metadata contract before changing the catalog schema.
2. Freeze tier calibration before rewriting tier assignments.
3. Freeze ordering rules before assigning `sort_order`.
4. Preserve a clean separation between:
   - human-curated fields,
   - machine-refreshable fields,
   - UI-only derived labels.
5. Do not present OpenRouter's `created` field as a vendor release date.
6. Do not allow provider familiarity or popularity alone to determine inclusion.

## Progress

- [ ] `M0` Metadata and tiering contract frozen.
- [ ] `M1` Schema and catalog shape updated.
- [ ] `M2` Curated candidate pool and committed set frozen.
- [ ] `M3` Catalog rewrite and validation completed.

## Surprises & Discoveries

1. OpenRouter's official API provides more useful factual metadata than the current catalog stores today, including:
   - `canonical_slug`
   - `created`
   - `context_length`
   - `pricing`
   - `top_provider`
   - `architecture`
   - `expiration_date`
2. The API does **not** expose a stable popularity rank. Website ordering should not be treated as authoritative.
3. Anthropic remains the cleanest tiering anchor in 2026:
   - `Opus` = flagship
   - `Sonnet` = mid
   - `Haiku` = budget
4. The current catalog is mis-tiered relative to that anchor:
   - Sonnet should not be a flagship
   - Haiku should not be a mid-tier model
5. Chinese-family representation is now strong enough that excluding it by default would artificially flatten H3 variation.
6. `created` from OpenRouter is useful as a backend field, but it must be labeled as **added to OpenRouter**, not **released**.

## Decision Log

1. Anthropic's provider ladder is the calibration anchor for model tiering.
2. Provider-first ordering within each tier is allowed as a product-facing rule, but must be documented as UX ordering rather than scientific ranking.
3. The committed catalog should preserve more OpenRouter metadata than the UI currently displays.
4. The backend catalog should store factual metadata broadly and expose it selectively to the UI.
5. The committed catalog should distinguish between:
   - the final curated set,
   - the larger candidate pool used during curation.
6. The catalog should not be forced to exactly 6 entries per tier if a tier cannot support that many strong entries without lowering the bar.
7. Chinese-family representation should be increased deliberately and explicitly, not as a side effect of popularity.

## Context and Orientation

### Relevant files reviewed

- `resources/models/catalog.json`
- `schemas/catalog.schema.json`
- `src/ui/wizard/resources.ts`
- `src/ui/wizard/steps.ts`
- `docs/exec-plans/2026-03-12-model-catalog-curation-policy.md`
- `docs/exec-plans/2026-03-12-models-step-overhaul.md`
- `docs/product-specs/tui-copy-deck.md`
- `docs/product-specs/tui-visual-screen-deck.md`

### OpenRouter source of truth

Official API endpoint used for current-state reality:

- `GET https://openrouter.ai/api/v1/models`

Stable docs:

- `https://openrouter.ai/docs/api-reference/models/get-models`
- `https://openrouter.ai/docs/docs/overview/models`

### Useful OpenRouter fields currently exposed

Per current API inspection, each model currently exposes:

- `id`
- `canonical_slug`
- `name`
- `created`
- `description`
- `context_length`
- `architecture`
- `pricing`
- `top_provider`
- `per_request_limits`
- `supported_parameters`
- `default_parameters`
- `expiration_date`
- `hugging_face_id`

### Terms used in this plan

- **calibration anchor**: the provider ladder used to define what `flagship`, `mid`, and `budget` should mean
- **candidate pool**: the larger, justified shortlist of models considered eligible for the committed catalog
- **committed set**: the subset actually shipped in `resources/models/catalog.json`
- **machine-refreshable fields**: OpenRouter-backed factual fields that can be refreshed later without changing the curation judgment
- **human-curated fields**: fields that reflect research/product judgment and must not be auto-generated or auto-updated

## Plan of Work

This work should happen in dependency order:

1. freeze the metadata contract,
2. freeze the tiering calibration,
3. freeze provider/tier ordering rules,
4. define the candidate-pool logic,
5. define the committed-set rules,
6. then implement schema and catalog changes.

## Milestones and Gates

### `M0` Metadata and tiering contract frozen

Outcome:

- the exact backend metadata policy is explicit,
- the exact tier-calibration rule is explicit,
- the catalog no longer risks arbitrary field growth.

Exit evidence:

1. this plan records the retained OpenRouter-backed fields,
2. this plan records the human-curated versus machine-refreshable split,
3. this plan records how `created` must be interpreted,
4. this plan records the Anthropic calibration anchor,
5. this plan records provider-first ordering as a UX rule rather than a scientific ranking.

### `M1` Schema and catalog shape updated

Outcome:

- the catalog schema can carry the richer backend metadata without conflating it with UI-only fields.

Exit evidence:

1. `schemas/catalog.schema.json` reflects the frozen metadata contract,
2. generated types are updated,
3. the schema keeps curated versus factual fields distinct in meaning,
4. schema wording does not imply that `created` is a release date.

### `M2` Candidate pool and committed set frozen

Outcome:

- the catalog rewrite is guided by a defensible shortlist rather than improvisation.

Exit evidence:

1. each tier has an explicit candidate pool,
2. each candidate has a one-sentence inclusion rationale,
3. the committed set is a deliberate subset of the candidate pool,
4. deferred models are named explicitly and not silently dropped.

### `M3` Catalog rewrite and validation completed

Outcome:

- the committed catalog uses the new metadata shape,
- the tier assignments and ordering are coherent,
- tests and captures pass.

Exit evidence:

1. catalog and schema validate,
2. product-spec docs remain consistent with the current UI surface,
3. targeted tests pass,
4. the round closes with a clean commit and explicit residual risks.

## Concrete Steps

### `M0` Freeze the backend metadata contract

Recommended retained factual fields from OpenRouter:

1. `canonical_slug`
2. `context_length`
3. `pricing.prompt`
4. `pricing.completion`
5. `top_provider.max_completion_tokens`
6. `top_provider.is_moderated`
7. `architecture.modality`
8. `architecture.input_modalities`
9. `architecture.output_modalities`
10. `architecture.tokenizer`
11. `architecture.instruct_type`
12. `created`
13. `expiration_date`
14. `description` (optional, backend-facing only)

Human-curated fields should remain:

1. `display_name`
2. `tier`
3. `summary_line`
4. `research_note`
5. `risk_note`
6. `default`
7. `sort_order`
8. optional free-form `notes`

Interpretation rules:

- `created` is **added to OpenRouter at**, not **release date**
- `canonical_slug` is factual provenance metadata
- `pricing` should remain exact as delivered by OpenRouter rather than prematurely rounded in the backend catalog
- the UI may later derive `$ / 1M` display strings from the stored pricing values

### `M0` Freeze the tiering calibration

Anchor:

- Anthropic Opus = `flagship`
- Anthropic Sonnet = `mid`
- Anthropic Haiku = `budget`

Mapping rule:

- for every other provider, map the provider's family into the Anthropic ladder by intended product position and cost-capability stratum, not by brand prestige alone

Implications:

- `Claude Sonnet` must be `mid`, not `flagship`
- `Claude Haiku` must be `budget`, not `mid`
- flagship should be reserved for a provider's premium top-end general-purpose family

### `M0` Freeze the ordering rule

Within each tier, use provider-first ordering as a product-facing rule.

Recommended provider precedence:

1. OpenAI
2. Anthropic
3. Google
4. xAI
5. Meta
6. DeepSeek
7. Qwen
8. Mistral
9. MiniMax
10. MoonshotAI

This is a UX-ordering rule only.
It must not be described as scientific ranking or quality ranking.

### `M0` Freeze the candidate-pool principle

The candidate pool should be broader than the committed catalog.

Rule:

- target roughly 6 strong candidates per tier when the market supports it,
- but do not force weak inclusions just to hit a quota,
- commit only the strongest subset that preserves variety and scanability.

### `M1` Update the schema shape

The schema should gain a clear nested section for factual metadata, for example:

- `openrouter.canonical_slug`
- `openrouter.created`
- `openrouter.description`
- `openrouter.context_length`
- `openrouter.pricing`
- `openrouter.top_provider`
- `openrouter.architecture`
- `openrouter.expiration_date`

Do not overload the top-level catalog entry with too many raw API keys if namespacing can keep the distinction clearer.

### `M2` Define the candidate pool

Expected first-pass candidate-pool bias:

- `flagship`: 4-6 strong entries
- `mid`: 6-8 strong entries
- `budget`: 5-7 strong entries
- `free`: 4-6 strong entries

Chinese-family representation should be deliberate in `mid` and `budget`, not incidental.

Strong likely candidate families:

- OpenAI
- Anthropic
- Google
- xAI
- Meta
- DeepSeek
- Qwen
- Mistral
- MiniMax
- MoonshotAI/Kimi

### `M2` Freeze the committed set

Committed set rule:

- one default-visible catalog that stays elegant in the wizard,
- no provider dominates every tier,
- no tier becomes a dumping ground for every interesting budget model,
- use a reserve list for strong-but-deferred candidates.

### `M3` Implement and validate

Expected validations:

- `npm run check:types`
- `npm run check:schemas`
- `npm run test:unit`
- `npm run test:ui`
- `npm run test:e2e:tui`
- `npm run test:guards`
- `npm run capture:tui`
- `npm run test:merge`

## Validation and Acceptance

Acceptance criteria:

1. the catalog stores richer factual metadata from OpenRouter without conflating it with UI-only prose,
2. tier assignments are coherent under the Anthropic calibration rule,
3. provider-first ordering within tiers is explicit and non-arbitrary,
4. the committed set reflects deliberate variety rather than placeholder inertia,
5. the Models-step UI still renders cleanly against the committed set size,
6. no new schema ambiguity or hidden field semantics are introduced.

## Idempotence and Recovery

- rerunning the schema generation should be stable,
- catalog rewrites should be reversible by commit boundary,
- if the richer metadata proves too heavy, the UI can ignore fields without losing catalog truth,
- if the candidate pool grows too large, reduce the committed set without changing the metadata contract.

## Interfaces and Dependencies

Depends on:

- OpenRouter official models API for factual field shape,
- current curation policy docs,
- current Models-step form contract,
- schema generation pipeline.

## Handoffs and Ownership

If this work is handed off mid-round, the handoff must state:

1. the frozen metadata shape,
2. the frozen tiering rules,
3. the current candidate pool,
4. the remaining unresolved provider/family calls,
5. the exact validation already run.

## Plan Change Notes

- drafted after independent review of the current OpenRouter 2026 inventory and the latest model-catalog discussion
- explicitly separates candidate pool design from committed wizard catalog design
- uses Anthropic as the calibration anchor rather than provider-specific ad hoc tiering
