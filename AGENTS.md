# AGENTS.md

Purpose: This file defines mandatory rules for AI coding agents working in this repo. Follow these instructions to keep Arbiter aligned with its research posture and determinism guarantees.

## Non-negotiable rules
- **Schema-first workflow**: define or modify JSON Schemas in `schemas/` before writing code that depends on them.
- **Generated types are read-only**: never hand-edit `src/generated/*`.
- **Determinism + auditability invariants**:
  - Assign `trial_id` deterministically before async execution begins.
  - Sample the trial plan with seeded randomness and record the plan/seed.
  - Apply monitoring/clustering updates in `trial_id` order at batch boundaries.
  - Artifacts are append-only during execution; finalization is atomic.
  - Graceful shutdown produces schema-valid partial artifacts.
- **Architecture boundary**: the engine emits events; UI and ArtifactWriter subscribe; the engine must not import UI code.
- **Conventional commits**: `type(scope): description` with bullet-only body (one bullet per line).
- **Main branch** only.
- **Commit at end of each session**.

## When uncertain
Consult in this order: `docs/spec.md` → `schemas/` → conservative behavior. Document assumptions in your end-of-round summary.

## Stub content policy
- Catalog/prompt bank content may be in **dev** stage during development.
- **Examples may reference current stub IDs**, but must include a disclaimer that IDs can change as curated content lands.
- Do **not** treat stub IDs as canonical in docs narrative or tests.
- Tests must assert invariants (schema validity, non-empty prompt text, hash matches content), not specific IDs or wording.

## Session protocol
- Start with a quick repo scan (`ls`, `rg --files`, `rg` as needed).
- Identify and track files you touch.
- End with a concise summary and commit(s).
