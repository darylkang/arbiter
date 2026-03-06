# Arbiter ExecPlan Contract (`docs/PLANS.md`)

This file is Arbiter's repository-local contract for writing, executing, reviewing, and closing ExecPlans.

It is not a feature plan.

Its job is to make non-trivial work:

1. executable without hidden chat context,
2. safe to hand off across time or agents,
3. observable, testable, and reversible,
4. aligned with Arbiter's research and documentation governance model.

## 1) Precedence and Scope

1. Use this file for planning behavior in this repository.
2. Fall back to `~/.codex/PLANS.md` only if this file is unavailable.
3. Store feature-level ExecPlans in `docs/exec-plans/`.
4. `docs/exec-plans/README.md` may add directory-specific conventions, but it must not weaken or contradict this file.

This contract governs planning behavior, not semantic product truth.

For semantic and product truth, see:

1. `schemas/`
2. `docs/DESIGN.md`
3. `docs/product-specs/`
4. `README.md`
5. `AGENTS.md`

## 2) ExecPlan Definition

An ExecPlan is a self-contained, living execution spec for non-trivial work.

A capable engineer or agent should be able to complete the work from the plan alone, without relying on unstated thread memory or implicit context.

An ExecPlan must make outcomes:

1. observable,
2. testable,
3. reversible,
4. handoff-ready.

## 3) When an ExecPlan Is Required

Use an ExecPlan for:

1. complex features,
2. significant refactors,
3. migrations,
4. cross-cutting changes,
5. work with meaningful unknowns or risk,
6. multi-day or multi-agent implementation,
7. any change where durable semantics, artifact contracts, or user-facing behavior may shift.

ExecPlans are optional for:

1. low-risk docs-only edits,
2. small single-file fixes,
3. straightforward changes that can be validated in one short pass,
4. narrowly scoped cleanup with no meaningful design ambiguity.

When unsure, bias toward writing the plan.

## 4) Lifecycle and Status Semantics

Status is tracked inside the plan's `Progress` section and reflected in `Plan Change Notes` when it changes materially.

Use these lifecycle terms consistently:

1. `proposed`: plan drafted, not started,
2. `in_progress`: implementation actively underway,
3. `blocked`: waiting on a dependency, decision, or external input,
4. `completed`: acceptance criteria met and completion gates satisfied,
5. `superseded`: replaced by a newer plan that takes over execution,
6. `abandoned`: intentionally stopped without completion.

Status-change rules:

1. when status changes materially, update the `Progress` section,
2. add a short note under `Plan Change Notes`,
3. if superseded, name the replacement plan explicitly,
4. if abandoned, state why and what remains unresolved.

## 5) Non-Negotiable Requirements

Every ExecPlan must:

1. be self-contained and understandable without prior thread history,
2. define non-obvious terms in plain language,
3. state user-visible or operator-visible outcomes, not only code deltas,
4. include exact repository-relative file paths, commands, and expected evidence,
5. include concrete validation and acceptance criteria,
6. include idempotence and recovery guidance,
7. stay current as implementation evolves,
8. record decisions and discoveries with evidence,
9. be specific enough for a novice to execute reliably,
10. include orientation evidence: what was read first and why it matters,
11. surface fundamental design flaws early and propose a practical migration path,
12. preserve Arbiter invariants from `AGENTS.md`,
13. define explicit scope guardrails,
14. define milestones with entry and exit criteria when the work has multiple stages,
15. state the ordering principle used for milestones and steps when it is not obvious,
16. define handoff requirements when work is multi-agent, asynchronous, or interruption-prone,
17. require canonical doc sync before durable design truth is considered complete.

For Arbiter, canonical doc sync means:

1. durable system semantics must be moved into `docs/DESIGN.md`,
2. exact human-facing UI behavior, copy, or visual truth must be moved into the relevant file under `docs/product-specs/`,
3. operator workflow changes must be reflected in `README.md` when relevant,
4. completed ExecPlans must not remain the only place where lasting truth lives.

## 6) Writing Style

1. Use prose-first writing; add structure only when it improves clarity.
2. Use checkboxes only in `Progress`.
3. Prefer concise evidence over long raw logs.
4. If a plan builds on a prior checked-in plan, reference it explicitly and restate the assumptions that still matter.
5. If non-arbitrary structure or style constraints matter to the implementation, state them plainly in the plan instead of leaving them implicit.

## 7) Execution Discipline

### 7.1) Authoring

Before finalizing a plan:

1. read the relevant docs and code,
2. resolve ambiguity in the plan itself,
3. make concrete decisions instead of listing open options unless the work is truly blocked,
4. identify the governing files, entry points, validation commands, and high-risk surfaces,
5. decide what is intentionally out of scope.

### 7.2) Implementing

While implementing from a plan:

1. execute milestone by milestone without waiting for repeated confirmation unless blocked,
2. update the plan at each meaningful stopping point,
3. keep milestones independently verifiable,
4. commit at logical boundaries in git repositories,
5. keep rollback boundaries clear,
6. record material scope or design changes in the plan, not only in chat.

### 7.3) Reviewing

When reviewing or resuming work:

1. treat the plan as the current source of truth for scope and acceptance,
2. do not rely on stale thread context when the plan says otherwise,
3. if implementation or docs diverge materially from the plan, either update the plan or treat the divergence as a defect.

### 7.4) Multi-Agent and Async Handoffs

For multi-agent, asynchronous, or multi-day work, the plan must make handoffs safe.

When applicable, include:

1. ownership or role boundaries,
2. required artifacts before handoff,
3. validation that must pass before the next stage begins,
4. unresolved risks or unknowns,
5. the recommended next action.

Every handoff should let the next contributor answer:

1. what was decided,
2. what changed,
3. what was validated,
4. what is still risky,
5. what should happen next.

## 8) Canonical Section Order

Use this order. Omit optional sections only when they are genuinely empty.

1. Purpose / Big Picture (required)
2. Scope Guardrails (required)
3. Progress (required)
4. Surprises & Discoveries (optional)
5. Decision Log (optional)
6. Outcomes & Retrospective (optional)
7. Context and Orientation (required)
8. Plan of Work (required)
9. Milestones and Gates (required)
10. Concrete Steps (required)
11. Validation and Acceptance (required)
12. Idempotence and Recovery (required)
13. Interfaces and Dependencies (optional)
14. Handoffs and Ownership (optional, but required for multi-agent or async work)
15. Artifacts and Notes (optional)
16. Plan Change Notes (optional)

Section intent:

1. `Scope Guardrails` defines in-scope, out-of-scope, and sequencing dependencies.
2. `Milestones and Gates` defines the stage structure, ordering principle, and milestone entry/exit criteria.
3. `Outcomes & Retrospective` is for delivered results and remaining gaps after implementation has progressed far enough to say something useful.

## 9) Required Section Semantics

### 9.1) Scope Guardrails

Every non-trivial plan must define:

1. what is in scope,
2. what is explicitly out of scope,
3. sequencing or dependency constraints when they matter,
4. any temporary coexistence rules during migration.

### 9.2) Context and Orientation

This section must:

1. describe the relevant current state with exact file paths,
2. define non-obvious terms used in the plan,
3. list the docs and files reviewed first and why each matters,
4. identify entry points, validation commands, and high-risk components.

### 9.3) Milestones and Gates

For multi-stage work, each milestone should define:

1. what concrete outcome it produces,
2. what must already be true before it begins when that is not obvious,
3. what evidence is required before it is considered complete,
4. what rollback or containment boundary it creates.

Milestone names alone are not enough.

### 9.4) Validation and Acceptance

This section must define:

1. observable behavioral acceptance criteria,
2. the commands or checks that validate those criteria,
3. expected pass/fail evidence where relevant,
4. fail-before/pass-after evidence when adding or changing behavior,
5. any residual validation gap that would block truthful completion.

### 9.5) Completion Gates

A plan must not be marked `completed` until all of the following are true:

1. acceptance criteria are met,
2. required validations have been run or any exceptions are explicitly documented,
3. durable semantic changes have been migrated into canonical docs,
4. residual risks or gaps are documented truthfully,
5. the current plan state would let another contributor understand what was delivered without reading the full thread.

## 10) Formatting Rules

1. Store plans as Markdown files in `docs/exec-plans/`.
2. File naming format: `YYYY-MM-DD-<short-kebab-title>.md`.
3. Use repository-relative file paths.
4. Include exact commands and working directory context.
5. Include expected evidence for key steps.
6. Use UTC timestamps in `Progress` for multi-day, multi-agent, or asynchronous work; they are optional for short single-session work.
7. Keep examples concise and evidence-focused.

## 11) Quality Bar

A strong ExecPlan is:

1. self-contained,
2. outcome-focused,
3. evidence-backed,
4. interruption-resilient,
5. handoff-ready,
6. explicit about risks, rollback, and dependencies,
7. aligned with Arbiter's canonical documentation model.

If the architecture is fundamentally flawed, say so directly and define:

1. the safer target state,
2. the migration sequence,
3. the validation and rollback boundaries.

## 12) ExecPlan Skeleton

# <Short action-oriented title>

This ExecPlan is a living document and must be updated as work proceeds.
This plan follows `docs/PLANS.md`.

## Purpose / Big Picture
Explain what changes for users or operators and how to observe it.

## Scope Guardrails
State what is in scope, out of scope, and any sequencing constraints.

## Progress
- [ ] (YYYY-MM-DD HH:MMZ) initial plan drafted (`proposed`)
- [ ] (YYYY-MM-DD HH:MMZ) milestone 1 complete
- [ ] (YYYY-MM-DD HH:MMZ) milestone 2 complete

## Surprises & Discoveries (Optional)
- Observation: <what was discovered>
  Evidence: <test output, log line, benchmark, file reference, or artifact>

## Decision Log (Optional)
- Decision: <what was decided>
  Rationale: <why>
  Date/Author: <YYYY-MM-DD, name/thread>

## Outcomes & Retrospective (Optional)
Summarize delivered outcomes, remaining gaps, and lessons learned.

## Context and Orientation
Describe the current state with exact file paths and key modules.
Define non-obvious terms used in this plan.
List the docs and files reviewed first and why each matters.
Identify entry points, validation commands, and high-risk components.

## Plan of Work
Describe the implementation sequence in prose.
Name files, modules, and functions to change.
State the ordering principle when it is not obvious.

## Milestones and Gates
Break work into independently verifiable milestones.
For each milestone, define entry assumptions when needed and exit evidence.

## Concrete Steps
List exact commands and working directories.
Include expected outputs or evidence where useful.

## Validation and Acceptance
Define behavioral acceptance criteria with observable signals.
List tests, commands, and expected pass/fail behavior.
Include fail-before/pass-after evidence when applicable.

## Idempotence and Recovery
Describe safe reruns, rollback points, and failure recovery steps.

## Interfaces and Dependencies (Optional)
Name required libraries, modules, APIs, and interface expectations.

## Handoffs and Ownership (Optional)
State role boundaries, required handoff artifacts, validation gates, unresolved risks, and recommended next action.

## Artifacts and Notes (Optional)
Include concise transcripts, snippets, or artifact links.

## Plan Change Notes (Optional)
- YYYY-MM-DD HH:MMZ: <what changed in the plan and why>
