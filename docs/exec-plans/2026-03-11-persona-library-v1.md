# ExecPlan: Persona Library v1

Status: completed
Owner: Codex
Last updated: 2026-03-11

## Purpose / Big Picture

Arbiter's Personas step is now structurally ready for a richer catalog. The next problem is no longer form; it is substance.

This plan defines the first research-grade persona library for Arbiter as a controlled H2 heterogeneity axis. The goal is to ship a small, defensible set of reasoning-posture interventions that can be justified in a methodology section and exercised through the existing catalog/UI pipeline without turning the persona axis into roleplay, style tuning, or prompt fishing.

This is a research-significant change because persona definitions alter `Q(c)` and therefore alter the estimand. The plan must therefore freeze both the conceptual boundary and the concrete v1 set before code changes land.

## Scope Guardrails

In scope:

1. freeze the durable principle that Arbiter personas are reasoning-posture interventions, not characters or identities,
2. define the v1 persona set and the deferred set,
3. update persona catalog category vocabulary as needed,
4. revise persona prompt text, catalog copy, and manifest descriptions to match the v1 set,
5. preserve backward-usable configuration behavior where practical,
6. update research-facing docs where the persona axis is described as part of H2.

Out of scope:

1. expanding beyond the agreed v1 set,
2. introducing demographic, occupational, theatrical, or style-only personas,
3. changing protocol, decode, or model semantics to compensate for persona design,
4. adding grouped persona sections or further Personas-step UI redesign,
5. reworking paper-wide analysis methodology beyond the persona-specific H2 framing.

Sequencing constraints:

1. freeze the conceptual boundary first,
2. then freeze the concrete v1 set and category vocabulary,
3. then update schema/catalog/docs,
4. then update prompt content and compatibility behavior,
5. then validate that the revised catalog remains dynamic and the UI still renders cleanly.

## Progress

- [x] M0 — research boundary and v1 set frozen
- [x] M1 — schema, catalog, and doc contract updated
- [x] M2 — prompt/content migration and compatibility completed
- [x] M3 — validation, capture review, and closeout completed

## Surprises & Discoveries

1. The new Personas-step form work created the right substrate: adding or removing personas is now a catalog/manfiest change, not a UI rewrite.
2. Breezy and Opus independently converged on the same durable principle: personas should be reasoning postures, not characters.
3. The strongest disagreement was not about the principle but about granularity: Breezy proposed both `Formalist` and `Procedural Analyst`; Opus argued they overlap too much in practice.
4. The current category enum (`baseline`, `adversarial`, `analytical`, `divergent`) is already close to the likely v1 library, but a fifth value will be required if `Decisive` is added.
5. The prompt files are currently tiny, one-line posture injections. That is an advantage for interpretability, but it means substance changes will be highly legible and should therefore be treated as research-significant edits rather than casual prompt tuning.

## Decision Log

1. Decision: personas are prompt-level reasoning-posture interventions.
   Rationale: this keeps H2 interpretable and avoids confounding persona with style, identity, or protocol.

2. Decision: the v1 library should stay small.
   Rationale: five personas is enough to induce meaningful H2 heterogeneity while staying defensible in a methodology section.

3. Decision: the v1 library will use the following user-facing labels unless M0 overturns them with stronger evidence:
   - `Baseline`
   - `Skeptical`
   - `Analytical`
   - `Exploratory`
   - `Decisive`
   Rationale: these names are sharper and more methodologically defensible than the current placeholder set.

4. Decision: `Formalist` and `Procedural Analyst` are merged into `Analytical` for v1.
   Rationale: they are too overlapping to justify as separate H2 conditions in the first serious catalog.

5. Decision: `Counterfactual Stress-Tester` and `Integrative Synthesizer` are deferred.
   Rationale: both are legitimate postures, but neither is necessary to defend the first H2 library and both risk redundancy without task-specific evidence.

6. Decision: `Decisive` is included in v1 unless M0 rejects it.
   Rationale: it creates a clean contrast pair with `Exploratory` and sharpens the expected distributional differences within H2.

## Research Boundary

Durable persona principle:

1. a persona belongs in Arbiter only if it targets an articulable shift in reasoning behavior,
2. that shift must be expected to induce a measurably different outcome distribution,
3. the shift must not be more cleanly controlled by another axis such as decode, protocol, model choice, or formatting.

Boundary rules:

| Axis | What it controls | Not a persona concern |
|------|------------------|------------------------|
| Persona | epistemic posture, reasoning strategy, commitment style | — |
| Protocol | interaction structure, multi-turn role assignment | personas do not encode turn-taking |
| Decode | temperature, top-p, seed, sampling breadth | personas do not request randomness or determinism |
| Model | capability, training prior, architecture | personas do not simulate a different model |
| Output style | verbosity, bullets, JSON, tone polish | personas may incidentally affect style but do not target it |
| Domain role | professional identity or expertise posture | personas do not say "you are a lawyer" or similar |

## Recommended v1 Persona Set

### Core set

1. `Baseline`
   - posture: unframed default reasoning stance
   - expected role: H2 anchor condition
   - category: `baseline`

2. `Skeptical`
   - posture: strongest-objection framing
   - expected role: adversarial pressure against premature conclusions
   - category: `adversarial`

3. `Analytical`
   - posture: explicit terms, assumptions, constraints, and precondition checks
   - expected role: structured analytical rigor
   - category: `analytical`

4. `Exploratory`
   - posture: consider multiple distinct approaches before committing
   - expected role: broaden search before convergence
   - category: `divergent`

5. `Decisive`
   - posture: commit to a single best answer and justify why alternatives lose
   - expected role: narrow the distribution toward a clearer top choice
   - category: `decisive`

### Deferred set

1. `Counterfactual Stress-Tester`
2. `Integrative Synthesizer`
3. any domain-role, demographic, theatrical, or style-only personas

## Context and Orientation

Docs reviewed first:

1. `AGENTS.md`
2. `docs/PLANS.md`
3. `docs/DESIGN.md`
4. `docs/RESEARCH-METHOD.md`
5. `docs/product-specs/tui-copy-deck.md`
6. `docs/exec-plans/2026-03-11-personas-step-overhaul.md`

Relevant implementation/data files:

1. `resources/prompts/personas/catalog.json`
2. `resources/prompts/personas/*.txt`
3. `resources/prompts/manifest.json`
4. `schemas/persona-catalog.schema.json`
5. `src/ui/wizard/resources.ts`
6. `src/ui/wizard/types.ts`

Current state summary:

1. the catalog/UI layer can already render richer persona metadata cleanly,
2. the current substance set is still the old placeholder set (`Neutral`, `Skeptical`, `Precise`, `Exploratory`),
3. current category vocabulary does not yet include `decisive`,
4. prompt text is still one-line posture guidance and can be revised without UI architecture work.

## Milestones and Gates

### M0 — Research Boundary and v1 Set Freeze

Entry criteria:

1. current form/catalog implementation complete,
2. external reviews from Breezy and Opus considered.

Exit criteria:

1. the durable principle for personas is frozen,
2. the exact v1 set is frozen,
3. deferred personas are frozen,
4. category vocabulary is frozen,
5. a rename/migration table exists from the old set to the new set,
6. prompt-authoring rules are frozen.

Prompt-authoring rules to freeze:

1. one clear posture instruction per persona,
2. no roleplay, identity, or occupational framing,
3. no style-only instructions,
4. instructions should be concise enough to preserve interpretability,
5. `when_to_use` copy should remain researcher-facing and declarative.

### M1 — Schema, Catalog, and Doc Contract

Entry criteria:

1. M0 complete.

Exit criteria:

1. `schemas/persona-catalog.schema.json` category enum is updated if needed,
2. `resources/prompts/personas/catalog.json` reflects the frozen v1 set,
3. `resources/prompts/manifest.json` descriptions align with the new set,
4. `docs/RESEARCH-METHOD.md` records the persona principle and v1 H2 posture framing,
5. `docs/DESIGN.md` remains semantically aligned,
6. any UI-facing copy/spec references to persona names/categories are updated.

### M2 — Prompt and Compatibility Migration

Entry criteria:

1. M1 complete.

Exit criteria:

1. prompt files under `resources/prompts/personas/` match the frozen v1 set,
2. a compatibility strategy is implemented for existing configs where needed,
3. backward-compatibility decisions are explicit.

Compatibility decision to freeze in M0/M1:

- whether old persona IDs are preserved with renamed display labels, or whether IDs themselves change and require config migration.

Preferred bias:

1. preserve existing IDs where the semantic change is evolutionary rather than orthogonal,
2. add new IDs only when introducing a genuinely new condition such as `Decisive`.

### M3 — Validation and Closeout

Entry criteria:

1. M1 and M2 complete.

Exit criteria:

1. `npm run check:types` passes,
2. `npm run check:schemas` passes,
3. `npm run test:unit` passes,
4. `npm run test:ui` passes,
5. `npm run test:e2e:tui` passes,
6. `npm run test:guards` passes,
7. `npm run capture:tui` shows the updated persona labels and guidance cleanly,
8. residual open questions are limited to future persona expansion, not v1 definition.

## Concrete Steps

### M0 — Freeze the Substance Contract

1. Freeze the v1 set to:
   - `Baseline`
   - `Skeptical`
   - `Analytical`
   - `Exploratory`
   - `Decisive`
2. Freeze deferred personas.
3. Freeze the category vocabulary:
   - `baseline`
   - `adversarial`
   - `analytical`
   - `divergent`
   - `decisive`
4. Freeze the ID/display-name migration table.
5. Freeze prompt-authoring and `when_to_use` voice rules.

### M1 — Update Contracts and Data

1. Update `schemas/persona-catalog.schema.json` category enum.
2. Update `resources/prompts/personas/catalog.json` entries to the v1 set.
3. Update `resources/prompts/manifest.json` descriptions.
4. Update `docs/RESEARCH-METHOD.md` with the durable H2 posture principle.
5. Update any affected product-spec copy that names the personas.

### M2 — Update Prompt Files and Compatibility

1. Revise the existing persona prompt files to match the new v1 set.
2. Add the new `Decisive` prompt file and manifest entry.
3. If preserving IDs, map:
   - `persona_neutral` -> display `Baseline`
   - `persona_skeptical` -> display `Skeptical`
   - `persona_precise` -> display `Analytical`
   - `persona_exploratory` -> display `Exploratory`
4. Add `persona_decisive` as the new entry.
5. Update any tests or fixtures that assume the old display labels.

### M3 — Validate and Close

1. Run the required scope gate commands.
2. Review the Personas capture for premium presentation and clean guidance.
3. Confirm the step is still compact and guidance-rich.
4. Confirm the v1 set is now ready for research use.

## Validation and Acceptance

Required scope gate for the implementation round:

1. `npm run check:types`
2. `npm run check:schemas`
3. `npm run test:unit`
4. `npm run test:ui`
5. `npm run test:e2e:tui`
6. `npm run test:guards`
7. `npm run capture:tui`

Acceptance criteria:

1. the persona library reflects the frozen v1 set,
2. the category vocabulary is explicit and schema-validated,
3. the H2 persona axis is described as reasoning-posture heterogeneity rather than character/role prompting,
4. the TUI displays the new labels and guidance correctly,
5. the work does not blur persona with decode, protocol, model, or output-style axes.

## Idempotence and Recovery

1. this plan should be executable as a bounded content/schema migration without further UI architecture work,
2. preserving existing IDs where possible reduces config breakage,
3. if the new v1 set proves unsatisfactory, rollback is isolated to catalog/prompt/doc changes rather than UI structure.

## Interfaces and Dependencies

Primary dependencies:

1. `resources/prompts/personas/catalog.json`
2. `resources/prompts/manifest.json`
3. `resources/prompts/personas/*.txt`
4. `schemas/persona-catalog.schema.json`
5. `docs/RESEARCH-METHOD.md`
6. `docs/product-specs/tui-copy-deck.md`
7. `src/ui/wizard/resources.ts`

## Handoffs and Ownership

If handed off:

1. the next contributor should treat this as a research-significant content/schema migration,
2. any proposal to exceed five v1 personas should require a new plan or an explicit plan amendment,
3. any proposal to add expert-role or identity personas should be treated as a separate methodological question, not an extension of this plan.
