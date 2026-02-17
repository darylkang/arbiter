# AGENTS.md

Purpose: This file defines mandatory rules for contributors and AI coding agents working in this repo. Follow these rules to keep Arbiter research‑grade: deterministic, auditable, and reproducible.

---

## Planning contract

- Active planning contract is `docs/PLANS.md`.
- The local contract supersedes the global fallback `~/.codex/PLANS.md` for this repository.
- Store feature-level ExecPlans in `docs/exec-plans/`.

---

## Non‑negotiable invariants

- **Schema‑first workflow**: define or modify JSON Schemas in `schemas/` before writing code that depends on them.
- **Generated types are read‑only**: never hand‑edit `src/generated/*`.
- **Determinism**:
  - `trial_id` assigned deterministically before async execution.
  - Trial plan sampled with seeded RNG; plan is recorded.
  - Monitoring/clustering updates applied in `trial_id` order at batch boundaries.
- **Artifacts**:
  - JSONL outputs are append‑only during execution.
  - Finalization is atomic (tmp → rename).
  - `config.resolved.json` is immutable after execution starts.
- **Architecture boundary**:
  - Engine emits events; UI + ArtifactWriter subscribe.
  - Engine **must not** import UI code.
- **Provenance**:
  - Requested vs actual models must be logged (actual from OpenRouter response body `model`).
  - Embeddings record `generation_id` when provided.

---

## Schema workflow (required)

1) Edit schema(s) in `schemas/`.
2) Regenerate types: `npm run gen:types`.
3) Commit generated types in `src/generated/`.
4) Validate schemas: `npm run check:schemas`.

**Versioning:** keep schema version bumps intentional and minimal; avoid breaking changes unless explicitly required.

---

## Testing / quality gates (must pass before merge)

Run these locally before committing:
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

If you touched OpenRouter integration or live behavior, also run:
- `npm run test:provenance`
- `npm run test:live-smoke` (only if API key present)

---

## Common footguns (avoid)

- **Math.random**: never use it in core execution. Use seeded RNG from `src/utils/seeded-rng`.
- **Completion‑order updates**: monitoring/clustering must use `trial_id` order at batch boundaries.
- **UI ↔ engine leakage**: UI must not influence scheduling or stop decisions.
- **Provenance drift**: `actual_model` must come from OpenRouter response **body** `model` field, not headers.
- **Contracts**: contract failures should map to `parse_status=fallback`, not silent success.

---

## Stub content policy

- Catalog/prompt bank content may be in **dev** stage during development.
- **Examples may reference current stub IDs**, but must include a disclaimer that IDs can change as curated content lands.
- Do **not** treat stub IDs as canonical in docs narrative or tests.
- Tests must assert invariants (schema validity, non‑empty prompt text, hash matches content), not specific IDs or wording.

---

## Release / publish checklist

- `npm run check:types`
- `npm run check:schemas`
- `npm run test:pack`
- `npm pack` and confirm tarball contents exclude `runs/`, `docs/` (unless intended).
- README is npm‑first and accurate.
- No secrets committed.

---

## When changing X, do Y first

- **Stopping logic** → update `docs/DESIGN.md` + convergence schema if needed; add tests.
- **Provenance fields** → update schemas + generated types; verify `verify` still passes.
- **Contracts** → update `resources/contracts/` + resolver embedding; add contract tests.
- **Artifacts** → update `docs/DESIGN.md` artifact list + verify logic.
- **UI routing** → update `scripts/ui-routing.mjs` and headless smoke tests.

---

## Session protocol (agents)

- Start with a quick repo scan (`ls`, `rg --files`, `rg`).
- Identify and track files you touch.
- End each round with a concise summary and commit(s).
- Split into multiple commits when there is a clear logical boundary; one commit is fine when changes are tightly coupled.
- Use Conventional Commits: `type(scope): description` with bullet‑only body lines.
- Commit body bullets should be sentence-style and start lowercase; keep natural capitalization for proper nouns/acronyms (for example `README`, `OpenRouter`, `JSONL`).

---

## When uncertain

Consult in this order: `docs/DESIGN.md` → `schemas/` → conservative behavior. Document assumptions in your end‑of‑round summary.
