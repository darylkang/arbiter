# Exec Plans Directory

This directory stores feature-level ExecPlans governed by `docs/PLANS.md`.

## Naming Convention
- Use one Markdown file per plan.
- File name format: `YYYY-MM-DD-<short-kebab-title>.md`.
- Keep titles short and action-oriented; avoid generic names like `plan.md`.

Examples:
- `2026-02-17-streaming-embeddings-finalization.md`
- `2026-02-17-contract-policy-semantics-alignment.md`

## Status Convention
Track status in the plan file itself using the `Progress` checklist defined by `docs/PLANS.md`.

Use this lifecycle consistently:
- `proposed`: plan drafted, not started
- `in_progress`: implementation active
- `blocked`: waiting on a dependency or decision
- `completed`: acceptance criteria met
- `superseded`: replaced by a newer plan
- `abandoned`: intentionally stopped

When status changes materially, update the plan's `Progress` section and add a short note under `Plan Change Notes`.

## Scope Convention
- Create a new plan for complex, cross-cutting, or high-risk work.
- Reuse/update an existing plan only when scope is clearly continuous.
- Keep one plan focused on one primary outcome to preserve traceability.
