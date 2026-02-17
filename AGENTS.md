# AGENTS.md

Purpose: This file is the project-local operating contract for contributors and AI agents. It is intentionally substantial: it defines required behavior, routes to canonical docs, and keeps implementation aligned with Arbiter's research mission.

## Mission Alignment

Arbiter exists to support research on reasoning as a distribution under heterogeneous, budget-matched sampling.

Engineering decisions should preserve this posture:

- measure distributional behavior, not correctness,
- treat configuration distribution `Q(c)` as estimand-defining,
- report uncertainty and provenance rigorously,
- keep artifacts reproducible and auditable.

## Canonical References and Precedence

1. `schemas/` for config and artifact contracts (shape-level truth)
2. `docs/DESIGN.md` for semantics, architecture, and interpretation boundaries
3. `docs/PLANS.md` for ExecPlan contract
4. `README.md` for user-facing usage guidance

If docs disagree with schemas, schemas win. Update docs immediately after schema or semantic changes.

## Orientation Protocol (Required at Session Start)

Before major work:

1. read `AGENTS.md`,
2. read `README.md`,
3. read `docs/DESIGN.md`,
4. read `docs/PLANS.md` when planning/execution complexity warrants,
5. inspect touched modules and validation commands.

## Non-Negotiable Invariants

- **Schema-first workflow**: change schemas before code that depends on new contracts.
- **Generated types are read-only**: never hand-edit `src/generated/*`.
- **Determinism**:
  - `trial_id` assigned deterministically before async execution.
  - trial plan sampled with seeded RNG and recorded.
  - monitoring and clustering updates applied in `trial_id` order at batch boundaries.
- **Artifacts**:
  - JSONL outputs append-only during execution.
  - finalization atomic (tmp then rename).
  - `config.resolved.json` immutable once execution starts.
- **Architecture boundary**:
  - engine emits events, UI and ArtifactWriter subscribe.
  - engine must not import UI code.
- **Provenance**:
  - requested and actual model identifiers must be logged.
  - `actual_model` comes from OpenRouter response body `model` field when available.
  - embeddings store `generation_id` when provided.

## Research Claims Discipline

These guardrails are mandatory in docs, reporting, and implementation messaging:

- Do not claim convergence implies correctness.
- Do not claim embedding groups are semantic truth.
- Do not claim interaction protocols are inherently superior; interaction is one rung in a broader heterogeneity ladder.
- Distinguish clearly:
  - decision uncertainty (dispersion under `Q(c)`),
  - estimation uncertainty (finite-sample uncertainty in estimated signals).

## Schema Workflow (Required)

1. Edit schema(s) in `schemas/`.
2. Regenerate types: `npm run gen:types`.
3. Commit generated types in `src/generated/`.
4. Validate schemas: `npm run check:schemas`.

Versioning: keep schema version bumps intentional and minimal; avoid breaking changes unless explicitly required.

## Testing and Quality Gates

Run these locally before merging implementation changes:

- `npm run check:types`
- `npm run check:schemas`
- `npm run test:mock-run`
- `npm run test:templates`
- `npm run test:verify`
- `npm run test:debate`
- `npm run test:clustering`
- `npm run test:embeddings`
- `npm run test:pack`
- `npm run test:ui`

If OpenRouter integration or live behavior changed, also run:

- `npm run test:provenance`
- `npm run test:live-smoke` (when API key is present)

## Common Footguns

- `Math.random` in core execution paths (use seeded RNG utilities).
- completion-order monitoring or clustering updates.
- UI logic influencing scheduling or stop decisions.
- provenance sourced from headers instead of response body `model`.
- contract parse failures treated as silent success (expected default is `parse_status=fallback` when usable text exists).

## Stub Content Policy

- Catalog and prompt bank content may remain in `dev` stage during development.
- Examples may use current stub IDs but must state IDs can change.
- Do not treat stub IDs as canonical in tests or narrative.
- Tests should assert invariants (schema validity, non-empty content, hash/content consistency), not fixed IDs or prose.

## Change Mapping (When Changing X, Do Y First)

- **Stopping logic**: update `docs/DESIGN.md` stopping semantics and relevant schemas; add tests.
- **Provenance fields**: update schemas and generated types; verify `arbiter verify` invariants.
- **Contracts**: update `resources/contracts/` and resolver embedding behavior; add contract tests.
- **Artifacts**: update `docs/DESIGN.md` artifact contract and verify/report logic.
- **UI routing**: update `scripts/ui-routing.mjs` and headless smoke coverage.

## Release and Publish Checklist

- `npm run check:types`
- `npm run check:schemas`
- `npm run test:pack`
- `npm pack` and inspect tarball contents (exclude `runs/` and docs unless intentional)
- README accuracy check
- secret scan sanity check

## Session Closure Protocol

- Track touched files.
- Summarize what changed, what was validated, and residual risks.
- Commit at logical boundaries using Conventional Commits.
- Prefer one commit for tightly coupled changes; split only when independently verifiable.

Commit style:

- subject: `type(scope): description`
- body: bullet-only lines
- bullets start lowercase
- preserve natural capitalization for proper nouns/acronyms (`OpenRouter`, `JSONL`, `README`)

## When Uncertain

Consult in this order:

1. `docs/DESIGN.md`
2. `schemas/`
3. conservative behavior that preserves determinism, provenance, and auditability

Document assumptions in round closure summaries.
