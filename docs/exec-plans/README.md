# Exec Plans Directory

This directory stores checked-in feature-level ExecPlans for Arbiter.

`/Users/darylkang/Developer/arbiter/docs/PLANS.md` is the authoritative planning contract.

This file exists only to document directory-local conventions. It must not duplicate or override the main contract.

## What Belongs Here

Use this directory for:

1. feature-level or migration-level ExecPlans,
2. plans that track multi-step implementation or rollout work,
3. plans that still add active execution value or meaningful traceability.

Do not use this directory for:

1. one-off scratch notes,
2. permanent design truth that belongs in `/Users/darylkang/Developer/arbiter/docs/DESIGN.md`,
3. exact human-facing UI truth that belongs in `/Users/darylkang/Developer/arbiter/docs/product-specs/`.

## Naming

1. Use one Markdown file per plan.
2. File name format: `YYYY-MM-DD-<short-kebab-title>.md`.
3. Keep titles short and action-oriented.
4. Avoid generic names such as `plan.md`.

Examples:

1. `2026-02-17-streaming-embeddings-finalization.md`
2. `2026-02-17-contract-policy-semantics-alignment.md`

## Continuity Rules

1. Create a new plan when the primary outcome is meaningfully independent.
2. Continue updating an existing plan when the work is clearly the same rollout.
3. If a plan is replaced, mark the old one as superseded and name the replacement explicitly.
4. Keep one plan focused on one primary outcome whenever possible.
5. Delete or archive a completed or superseded plan when:
   - its durable truth has already been migrated into canonical docs,
   - it no longer records unique decisions or evidence worth keeping,
   - and retaining it would add more directory noise than traceability value.

## Canonical Contract Reminder

For all required plan structure, lifecycle semantics, milestone gates, completion rules, validation expectations, and handoff discipline, use:

- `/Users/darylkang/Developer/arbiter/docs/PLANS.md`
