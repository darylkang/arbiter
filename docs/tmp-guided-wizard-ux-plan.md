# Arbiter Guided Main Entry UX Plan

Status: proposal (authoritative temporary guide)
Last updated: 2026-02-08
Scope: interactive main entrypoint (`arbiter` in TTY)
Out of scope: backend algorithm changes, artifact schema changes, non-interactive CLI scripting behavior (except consistency updates explicitly listed)

---

## 1) Purpose and Inputs

This document defines the target UX for Arbiter's primary interactive experience.

It consolidates direction from:

- `/Users/darylkang/Developer/arbiter/docs/390167d1-955e-4c05-9382-d496df53fa65_Arbiter_UIUX.pdf`
- `/Users/darylkang/Developer/arbiter/docs/d6dc560d-2aa7-4e58-9ad4-a75da8e7e53e_Reasoning_as_a_Distribution.pdf`
- `/Users/darylkang/Developer/arbiter/docs/d824e33f-082c-43dc-b8a6-c17a50b05ffb_Related_Work.pdf`
- local OpenClaw interaction patterns in `/Users/darylkang/Developer/openclaw/src/wizard/*`

This is the single temporary source of truth for the guided-entry rebuild and should be the primary review artifact for external design audits.

---

## 2) Product Vision (Ground Truth)

Arbiter is a research-grade experimentation harness for analyzing model behavior as a distribution, not for producing one "best answer."

The interactive product should help users:

1. set up a valid experiment quickly,
2. run it safely with explicit tradeoffs,
3. interpret results responsibly with uncertainty-aware framing,
4. continue to the next action without dead ends.

The UX goal is not "terminal power-user speed" first. The UX goal is high-confidence experiment setup and interpretation with minimal cognitive overhead.

---

## 3) Problem Statement

Current interactive behavior is significantly improved but still perceived as "terminal-first" rather than "guided-product-first."

Primary gap:

- Users can still feel they are operating a shell with commands instead of being led through a clear research workflow.

Desired shift:

- From command orchestration by the user
- To guided orchestration by the product, with commands as optional accelerators

---

## 4) UX Outcomes

The design is successful when all are true:

1. A first-time user can complete a mock run from launch to receipt without typing slash commands.
2. The product asks one clear question at a time.
3. Keyboard flow is obvious: arrow keys, enter, escape, space where relevant.
4. Run progress is readable and calm under load.
5. Receipt and next actions are explicit and immediate.
6. Copy is professional, precise, and research-appropriate.
7. Live execution is always explicit and safe.

---

## 5) Experience Principles

1. Guided by default
Interactive launch starts a guided flow immediately.

2. One decision per step
Each screen/step has one decision and one primary action.

3. Safe defaults
Mock is default. Live is explicit and confirmed.

4. Progressive disclosure
Advanced controls are available but collapsed by default.

5. Research clarity over theatrics
Visual energy is useful only if it improves comprehension.

6. Commands are secondary
Slash commands remain, but are not required for the main journey.

7. Professional language everywhere
Use concise, documentation-grade copy with concrete next actions.

---

## 6) Main Entrypoint Contract

## 6.1 Launch behavior

When user runs `arbiter` in a TTY:

- enter guided intake immediately,
- show short orientation text,
- set focus to first prompt input.

When user runs `arbiter` in non-TTY:

- preserve existing CLI behavior and help conventions.

## 6.2 Primary stages

Arbiter guided flow has three top-level stages:

1. Intake
2. Run progress
3. Receipt and next actions

The guided engine controls stage transitions.

---

## 7) Stage A: Intake (Guided Setup)

## 7.1 Step sequence

Step A1: Research question

- Input prompt: "What question are you investigating?"
- Validation:
  - required,
  - min length 8,
  - max length 500.
- Action: Continue

Step A2: Profile selection

- Arrow-key single-select list with short descriptions.
- Rounded choice row styling (focus + selected state).
- Action: Continue
- Secondary: Back

Step A3: Run mode selection

- Options:
  - mock (default, recommended)
  - live
  - save-only
- If no API key, live option is disabled with a clear inline reason.
- Action: Continue
- Secondary: Back

Step A4: Review and confirm

Summary includes:

- question,
- selected profile/template,
- run mode,
- advanced overrides (if changed).

Actions:

- Start run (primary)
- Edit question
- Change profile
- Change mode
- Cancel setup

## 7.2 Advanced controls

Collapsed "Advanced" group under review:

- max trials,
- batch size,
- workers,
- strict/permissive,
- contract failure policy.

Defaults remain visible; overrides are explicit.

## 7.3 Cancel and restart semantics

- Escape goes back one step (where valid).
- Cancel returns to idle with state preserved when safe.
- If a new setup is started mid-intake, product asks confirmation before discarding partial input.

---

## 8) Stage B: Run Progress (Operational Clarity)

## 8.1 Progress panel requirements

Always visible while running:

- planned / attempted / eligible,
- current batch index and elapsed time,
- token usage (prompt, completion, total),
- cost estimate if available,
- stop/convergence signals.

## 8.2 Transcript updates

Append concise, structured events:

- run start,
- batch start/completion,
- non-success trial statuses,
- warnings,
- run completion/failure.

Do not flood transcript with low-value noise.

## 8.3 Warnings

- Warnings are deduped and visible.
- `/warnings` shows full warning history.
- Warning copy is factual and actionable.

## 8.4 Interrupt semantics

- Ctrl+C while running requests graceful stop.
- Repeated Ctrl+C communicates escalation behavior clearly.

---

## 9) Stage C: Receipt and Next Actions

Immediately after completion or failure:

1. render receipt summary block,
2. state completion/failure plainly,
3. present next actions in an explicit selector.

Next actions:

- View report
- Verify run
- Start new study
- Quit

No blank state after run completion.

---

## 10) Interaction and Visual System

## 10.1 Layout regions

1. Header
- brand line,
- environment status (API key/config/runs count),
- concise run mode indicator.

2. Main transcript
- system narrative,
- key run events,
- warnings/errors,
- receipt/report summaries.

3. Guided step panel
- current question,
- selector/checklist controls,
- focused input/editor.

4. Footer hints
- context-specific key hints,
- warnings count,
- mode label.

## 10.2 Selection components

Adopt OpenClaw-inspired interaction quality:

- rounded single-choice rows,
- clear focused state with arrow-key navigation,
- checkboxes with space toggle for multi-select contexts,
- consistent enter/escape semantics.

## 10.3 Motion and feedback

Use motion sparingly:

- spinner only for meaningful async boundaries:
  - run setup start,
  - report generation,
  - verify run,
  - config write where latency is material.
- no decorative idle animation.
- no distracting micro-motion in typing flows.

## 10.4 Color system

- Keep Gruvbox-dark semantic palette.
- Keep TTY/non-TTY, NO_COLOR, and fallback behavior strict and consistent.
- Keep semantic mapping stable across CLI and TUI surfaces.

---

## 11) Copy System (Professional Standard)

All user-facing copy should match documentation-grade quality.

Rules:

1. Sentence case, direct language.
2. Use concrete verbs in actions.
3. Explain failures with cause and next step.
4. Avoid slang and internal codenames.
5. Keep warnings objective and concise.
6. Use progressive disclosure in help content.

Preferred examples:

- "Set up a new study."
- "Select a run mode."
- "OpenRouter API key not found. Live runs require OPENROUTER_API_KEY."
- "Run complete. Review the receipt or open a report."

---

## 12) Command Role in Guided Mode

Slash commands remain available for advanced users:

- `/help`
- `/new`
- `/run [mock|live]`
- `/report [run_dir]`
- `/verify [run_dir]`
- `/receipt [run_dir]`
- `/warnings`
- `/quit`

But guided startup must not depend on discovering `/new`.

---

## 13) Implementation Architecture

## 13.1 Required modules

Introduce and centralize guided flow logic:

- `src/ui/transcript/flow/flow-types.ts`
- `src/ui/transcript/flow/flow-machine.ts`
- `src/ui/transcript/flow/flow-actions.ts`
- `src/ui/transcript/flow/flow-render.ts`

Purpose:

- keep flow transitions pure and testable,
- keep `app.ts` orchestration thin,
- reduce behavioral drift across overlays, commands, and startup.

## 13.2 State model

Use explicit intake substates with a discriminated union:

- `question`
- `profile`
- `mode`
- `review`

Track wizard metadata:

- active,
- step index,
- started at timestamp,
- dirty/unsaved edits indicator.

## 13.3 Integration boundaries (must stay unchanged)

- Engine emits events.
- UI subscribes via EventBus.
- RunLifecycleHooks remains UI-agnostic interface.
- Artifact semantics and schemas remain unchanged.

---

## 14) Delivery Plan (Sequenced)

Phase 0: Spec lock

- Approve this doc as implementation contract.
- Freeze scope for first pass.

Gate:

- explicit sign-off.

Phase 1: Guided flow state machine

- implement flow machine and transition guards,
- test transition matrix thoroughly.

Gate:

- unit tests for all transitions and guardrails.

Phase 2: Guided startup and step panel

- auto-enter guided intake on interactive launch,
- one-question-at-a-time step panel.

Gate:

- PTY journey: launch -> review without slash commands.

Phase 3: Selection polish

- rounded choice bubbles,
- checkbox and focus behavior consistency,
- keyboard hints aligned with actual controls.

Gate:

- interaction tests and visual checks for 80x24 and narrow terminals.

Phase 4: Async feedback polish

- spinner wrapper and usage policy,
- ensure spinner cleanup on success/failure/interruption.

Gate:

- no spinner artifacts in failure or abort paths.

Phase 5: Post-run action menu

- explicit selector for report/verify/new/quit,
- direct transition paths with clear return behavior.

Gate:

- full PTY journey pass through receipt and next actions.

Phase 6: Hardening and docs alignment

- help and README alignment,
- copy pass for professional tone,
- fallback checks for NO_COLOR and narrow terminal mode.

Gate:

- all quality gates pass.

---

## 15) Test Strategy

## 15.1 Unit tests

- flow transitions,
- validation guards,
- cancellation/back behavior,
- warning dedupe and run-mode safety guards.

## 15.2 Integration tests

- startup enters guided flow,
- flow selections update state correctly,
- review start triggers run controller,
- interrupted run returns coherent state.

## 15.3 PTY E2E tests

Minimum critical paths:

1. launch -> full mock run -> receipt -> quit,
2. launch -> attempt live without key -> blocked explanation,
3. launch -> cancel/resume intake -> complete,
4. post-run action menu -> report -> verify -> new study.

## 15.4 Copy and docs checks

- key prompts and errors tested for expected wording patterns,
- help output contains consistent terminology.

---

## 16) Acceptance Criteria (Premium Bar)

1. First-run mock study can be completed with no slash commands.
2. Keyboard navigation is complete and discoverable.
3. Live path is explicit and safe.
4. Guided flow feels coherent end-to-end.
5. Progress and receipt are readable under normal and narrow widths.
6. Copy quality is consistent with professional research tooling.
7. Commands remain available without dominating the default journey.
8. Backend invariants remain untouched.
9. All existing quality gates remain green.

---

## 17) Risks and Mitigations

Risk: flow complexity grows too fast

- Mitigation: flow machine first, UI wiring second.

Risk: visual polish outruns behavioral correctness

- Mitigation: stage gates require passing behavior tests before polish phases.

Risk: power-user workflows regress

- Mitigation: preserve command shortcuts and explicit help.

Risk: style drift across CLI and TUI

- Mitigation: shared design tokens and copy style checks.

---

## 18) Definition of Done for Guided Entry Rebuild

Done means:

- `arbiter` in TTY launches a guided research setup flow by default,
- user can complete intake, run, and receipt action loop without commands,
- interaction quality matches the intended "alive but professional" bar,
- documentation and help are aligned with behavior,
- all quality gates pass.

---

## 19) Immediate Next Step

Use this doc as the reference artifact for independent audit.

Request external review to stress-test:

- flow clarity,
- interaction design,
- implementation sequencing,
- testing depth,
- risks and omissions.

