# Arbiter ExecPlan Contract (`docs/PLANS.md`)

This file defines the repository-local standard for writing and executing ExecPlans.

## Precedence

1. Use this file (`docs/PLANS.md`) for planning behavior in this repository.
2. Fall back to `~/.codex/PLANS.md` only if this file is unavailable.
3. Store feature-level plans in `docs/exec-plans/`.

## Purpose

An ExecPlan is a self-contained, living execution spec for non-trivial work. A capable engineer or agent should be able to complete the task from the plan alone, with no hidden chat context.

ExecPlans are designed to make outcomes:

- observable,
- testable,
- reversible.

## When an ExecPlan Is Required

Use an ExecPlan for:

- complex features,
- significant refactors,
- migrations,
- cross-cutting changes,
- work with meaningful unknowns or risk.

ExecPlans are optional for:

- low-risk docs-only edits,
- small single-file fixes,
- straightforward changes that can be validated in one short pass.

## Non-Negotiable Requirements

Every ExecPlan must:

1. be self-contained and understandable without prior thread history,
2. define non-obvious terms in plain language,
3. state user-visible outcomes, not only code deltas,
4. include exact file paths, commands, and expected evidence,
5. include concrete validation and acceptance criteria,
6. include idempotence and recovery guidance,
7. stay current as implementation evolves,
8. record decisions and discoveries with evidence,
9. be specific enough for a novice to execute reliably,
10. include orientation evidence (what was read and why),
11. surface fundamental design flaws early and propose practical migration paths,
12. preserve Arbiter invariants from `AGENTS.md` (schema-first, determinism, artifact guarantees, architecture boundaries).

## Writing Style

- Use prose-first writing; add structure only when it improves clarity.
- Use checkboxes only in `Progress`.
- Prefer concise evidence over long raw logs.
- If building on a prior checked-in plan, reference it and restate assumptions that still matter.

## Execution Behavior

Authoring:

- read relevant docs and code before finalizing the plan,
- resolve ambiguity in the plan itself,
- make concrete decisions rather than listing open options unless truly blocked.

Implementing:

- execute milestone by milestone without waiting for repeated confirmation unless blocked,
- update the plan at each meaningful stopping point,
- keep milestones independently verifiable,
- commit at logical boundaries in git repositories.

Reviewing:

- treat the plan as the current source of truth for scope and acceptance,
- record material scope or design changes in the plan.

## Canonical Section Order

Use this order. Omit optional sections when empty.

1. Purpose / Big Picture (required)
2. Progress (required)
3. Surprises & Discoveries (optional)
4. Decision Log (optional)
5. Outcomes & Retrospective (optional)
6. Context and Orientation (required)
7. Plan of Work (required)
8. Concrete Steps (required)
9. Validation and Acceptance (required)
10. Idempotence and Recovery (required)
11. Interfaces and Dependencies (optional)
12. Artifacts and Notes (optional)
13. Plan Change Notes (optional)

## Formatting Rules

- Store plans as Markdown in `docs/exec-plans/`.
- File naming: `YYYY-MM-DD-<short-kebab-title>.md`.
- Use repository-relative file paths.
- Include exact commands and working directory context.
- Include expected evidence for key steps.
- Include UTC timestamps in `Progress` for multi-day or multi-agent work; optional for short single-session work.

## Quality Bar

A good ExecPlan is:

- self-contained,
- outcome-focused,
- evidence-backed,
- interruption-resilient,
- handoff-ready,
- explicit about risks and rollback.

If architecture is fundamentally flawed, state it directly and define the safer end state plus migration sequence.

---

## ExecPlan Skeleton

# <Short action-oriented title>

This ExecPlan is a living document and must be updated as work proceeds.
This plan follows `docs/PLANS.md`.

## Purpose / Big Picture
Explain what changes for users/operators and how to observe it.

## Progress
- [ ] (YYYY-MM-DD HH:MMZ) initial plan drafted
- [ ] (YYYY-MM-DD HH:MMZ) milestone 1 complete
- [ ] (YYYY-MM-DD HH:MMZ) milestone 2 complete

## Surprises & Discoveries (Optional)
- Observation: <what was discovered>
  Evidence: <test output, log line, benchmark, or file reference>

## Decision Log (Optional)
- Decision: <what was decided>
  Rationale: <why>
  Date/Author: <YYYY-MM-DD, name/thread>

## Outcomes & Retrospective (Optional)
Summarize delivered outcomes, remaining gaps, and lessons learned.

## Context and Orientation
Describe current state with exact file paths and key modules.
Define non-obvious terms used in this plan.
List docs/files reviewed first and why each matters.
Identify entry points, validation commands, and high-risk components.

## Plan of Work
Describe implementation sequence in prose.
Name files/modules/functions to change.
Break work into independently verifiable milestones.
State the milestone ordering principle when not obvious.

## Concrete Steps
List exact commands and working directories.
Include expected outputs where useful.

## Validation and Acceptance
Define behavioral acceptance criteria with observable signals.
List tests/commands and expected pass/fail behavior.
Include fail-before/pass-after evidence when adding new behavior.

## Idempotence and Recovery
Describe safe reruns, rollback points, and failure recovery steps.

## Interfaces and Dependencies (Optional)
Name required libraries, modules, APIs, and interface expectations.

## Artifacts and Notes (Optional)
Include concise transcripts, snippets, or artifact links.

## Plan Change Notes (Optional)
- YYYY-MM-DD HH:MMZ: <what changed in the plan and why>
