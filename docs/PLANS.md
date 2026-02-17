# Arbiter Execution Plans (ExecPlans)

This file defines the repository-local contract for writing and executing ExecPlans.

Precedence:
1. Use this file (`docs/PLANS.md`) for planning behavior in this repository
2. Fall back to `~/.codex/PLANS.md` only if this file is unavailable
3. Store feature-level implementation plans in `docs/exec-plans/`

## Purpose
`PLANS.md` is the contract for writing, executing, and maintaining feature-level ExecPlans.
It is not a per-feature implementation plan.

## ExecPlan Definition
An ExecPlan is a self-contained living execution spec that lets a capable engineer or agent implement a change end-to-end from the plan alone.
An ExecPlan must make outcomes observable, testable, and reversible.

## When to Require an ExecPlan
Use an ExecPlan for:
- complex features
- significant refactors
- migrations
- cross-cutting changes
- work with meaningful unknowns or risk

ExecPlans are optional for small, low-risk, single-file edits.

## Non-Negotiable Requirements
Every ExecPlan must:
1. Be self-contained and understandable without prior thread history
2. Define non-obvious terms in plain language
3. State user-visible outcomes, not only code changes
4. Include exact file paths, commands, and expected results
5. Include concrete validation and acceptance criteria
6. Include idempotence and recovery guidance
7. Stay current as implementation evolves
8. Record decisions and discoveries with evidence
9. Be specific enough for a novice to execute reliably
10. Include enough context to resume without prior chat history; prefer concise summaries plus links to canonical artifacts over copying large raw content
11. Surface fundamental design flaws early, then propose a practical migration path
12. Record orientation evidence: key docs and files reviewed, and why each matters
13. Use intentional ordering for milestones and steps (dependency order, risk, impact, or alphabetical), and state the principle when not obvious
14. State any style or structure constraints required for intentional non-arbitrary implementation choices
15. State how repository invariants in `AGENTS.md` (schema-first workflow, determinism, artifact guarantees, architecture boundaries) are preserved

## Writing Style
- Write in plain prose that is precise and actionable
- Prefer narrative structure over rigid templates; use structure only when it improves clarity
- Use checklists only in `Progress`
- If an ExecPlan is a standalone Markdown file, do not wrap the full file in outer triple-backtick fences
- If a plan builds on a prior checked-in plan, reference it explicitly and restate assumptions that still matter

## Execution Behavior
### Authoring
- Read relevant code and docs before finalizing the plan
- Resolve ambiguity in the plan itself
- Prefer decisive concrete choices over vague options

### Implementing
- Execute milestone by milestone without waiting for "next step" prompts unless blocked
- Keep the plan updated at each meaningful stopping point
- Commit at logical independently verifiable milestones when working in git repositories
- If the workspace is not a git repository, record round closure with concise status and validation updates in the plan
- Ensure each milestone is independently verifiable

### Discussing and Reviewing
- Treat the plan as source of truth for scope and acceptance
- Record all material scope or design changes in the plan

## Canonical Section Order
Keep this order even when optional sections are omitted.
Do not include empty optional sections.

1. Purpose / Big Picture (Required)
2. Progress (Required)
3. Surprises & Discoveries (Optional)
4. Decision Log (Optional)
5. Outcomes & Retrospective (Optional)
6. Context and Orientation (Required)
7. Plan of Work (Required)
8. Concrete Steps (Required)
9. Validation and Acceptance (Required)
10. Idempotence and Recovery (Required)
11. Interfaces and Dependencies (Optional)
12. Artifacts and Notes (Optional)
13. Plan Change Notes (Optional)

## Formatting Rules
- Store ExecPlans as Markdown files in `docs/exec-plans/`
- Use clear headings and prose-first writing
- Use checkboxes only in `Progress`
- Include UTC timestamps in `Progress` for multi-day, multi-agent, or asynchronous work; timestamps are optional for short single-session work
- Use full repository-relative file paths
- Use exact commands with working directory context
- Keep examples concise and evidence-focused

## Quality Bar
A good ExecPlan is:
- self-contained
- outcome-focused
- evidence-backed
- executable without hidden context
- resilient to interruption and handoff
- coherent in structure and ordering, with intentional non-arbitrary design choices

If the current architecture is fundamentally flawed, say so directly and define a safer target state plus migration sequence.

---

## ExecPlan Skeleton

# <Short, action-oriented title>

This ExecPlan is a living document and must be updated as work proceeds.
This plan follows `docs/PLANS.md`.

## Purpose / Big Picture
Explain what changes for users or operators after this work and how to observe it.

## Progress
- [ ] (YYYY-MM-DD HH:MMZ) initial plan drafted
- [ ] (YYYY-MM-DD HH:MMZ) milestone 1 complete
- [ ] (YYYY-MM-DD HH:MMZ) milestone 2 complete

## Surprises & Discoveries (Optional)
- Observation: <what was discovered>
  Evidence: <test output, log line, benchmark, etc>

## Decision Log (Optional)
- Decision: <what was decided>
  Rationale: <why>
  Date/Author: <YYYY-MM-DD, name/thread>

## Outcomes & Retrospective (Optional)
Summarize delivered outcomes, remaining gaps, and lessons learned.

## Context and Orientation
Describe relevant current state with full file paths and key components.
Define non-obvious terms used in this plan.
List key docs and files reviewed first, and why each matters.
Identify entry points, validation commands, and high-risk components.

## Plan of Work
Describe the implementation sequence in prose.
Name files, modules, and functions to change.
Break work into milestones where each milestone produces a concrete verifiable outcome.
State the ordering principle used for milestones when not obvious.

## Concrete Steps
List exact commands and working directories.
Include expected outputs where useful.

## Validation and Acceptance
Define behavioral acceptance criteria with observable signals.
Include test commands and expected pass or fail behavior.
When applicable, include fail-before and pass-after evidence for new behavior.

## Idempotence and Recovery
Describe safe re-runs, rollback points, and failure recovery steps.

## Interfaces and Dependencies (Optional)
Name required libraries, modules, APIs, and expected interfaces or signatures.

## Artifacts and Notes (Optional)
Include concise transcripts, diffs, snippets, or links to generated artifacts.

## Plan Change Notes (Optional)
- YYYY-MM-DD HH:MMZ: <what changed in this plan and why>
