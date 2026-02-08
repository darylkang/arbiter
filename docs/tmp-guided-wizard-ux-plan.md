# Arbiter Guided Main Entry UX Specification

Status: draft (authoritative temporary spec)
Last updated: 2026-02-08
Primary source of truth: `/Users/darylkang/Developer/arbiter/docs/390167d1-955e-4c05-9382-d496df53fa65_Arbiter_UIUX.pdf`
Supporting context:
- `/Users/darylkang/Developer/arbiter/docs/d6dc560d-2aa7-4e58-9ad4-a75da8e7e53e_Reasoning_as_a_Distribution.pdf`
- `/Users/darylkang/Developer/arbiter/docs/d824e33f-082c-43dc-b8a6-c17a50b05ffb_Related_Work.pdf`
- `/Users/darylkang/Developer/openclaw/src/wizard/*`

---

## 1) Scope

This specification defines the interactive main entry experience for `arbiter` in a TTY.

In scope:
- guided intake and setup
- run progress cockpit
- receipt and post-run guidance
- interaction model, copy standards, and visual behavior
- implementation sequencing and acceptance gates

Out of scope:
- backend algorithm semantics
- artifact schema changes
- non-interactive scripting behavior

---

## 2) Product Intent

Arbiter is a professional research tool for distributional experimentation.

The interactive experience must optimize for:
1. high-confidence experiment setup
2. safe execution defaults
3. clear interpretation boundaries
4. fast continuation to the next research step

The main entrypoint should feel like a guided product workflow, not a shell session.

---

## 3) Legacy-Free UX Decision

The guided main entrypoint must not depend on command literacy.

Hard rules:
1. No slash-command requirement in the primary path.
2. No command-first onboarding language.
3. No command hints as the dominant call to action during setup.
4. First-run completion must be possible with only arrow keys, enter, escape, and text input.

Advanced command paths may continue to exist elsewhere in the product surface, but they are not the contract for the guided main entrypoint.

---

## 4) Experience Outcomes

The design is successful when all are true:
1. A first-time user can launch, configure, run, and finish a mock study without learning commands.
2. Every step asks one clear question and provides one primary action.
3. Live mode is explicit and safe.
4. Run progress communicates status without noise.
5. Receipt provides immediate interpretation context and next actions.
6. Language is precise, neutral, and documentation-grade.

---

## 5) Core Experience Model

The guided experience has three stages.

## 5.1 Stage A: Intake

Goal: build a valid run plan with minimal cognitive overhead.

Step sequence:
1. Research question input
2. Profile selection
3. Run mode selection
4. Review and confirm

Advanced options are collapsed by default.

## 5.2 Stage B: Run Progress

Goal: provide confidence during execution.

Required signals:
- planned, attempted, eligible counts
- active batch progress and elapsed time
- token usage and cost when available
- warning stream and stop reasoning

## 5.3 Stage C: Receipt and Next Actions

Goal: prevent post-run dead ends.

Required outputs:
- run outcome summary
- receipt excerpt
- explicit action selector:
  - view report
  - verify run
  - start another study
  - quit

---

## 6) Interaction Contract

## 6.1 Keyboard model

Required keys:
- Arrow up/down: move selection focus
- Enter: confirm current selection
- Escape: back/cancel current interaction
- Space: toggle checklist options where multi-select is used
- Ctrl+C: request graceful interrupt while running

No hidden keys are required for the main path.

## 6.2 Selection components

Use rounded, high-clarity row treatments inspired by OpenClaw.

Single-select rows must show:
- focused state
- selected state
- disabled state with inline explanation

Checklist rows must show:
- explicit checked/unchecked indicator
- focused row indicator

## 6.3 Cancel behavior

Cancel is first-class at every intake step.

Rules:
1. Escape returns to the previous step where valid.
2. Cancel from review returns to idle safely.
3. Starting a new intake while one is active requires confirmation before discarding partial inputs.

---

## 7) Visual and Motion System

## 7.1 Tone and style

Visual tone: premium, restrained, professional.

Principles:
- strong hierarchy
- calm color usage
- meaningful motion only
- no decorative effects that reduce clarity

## 7.2 Palette

Use semantic Gruvbox-dark tokens consistently across the guided surfaces:
- brand
- accent
- success
- warning
- error
- info
- muted
- primary text

Fallback rules:
- respect `NO_COLOR`
- support reduced color terminals
- preserve readability at narrow widths

## 7.3 Spinner policy

Use spinners only at real async boundaries:
- run startup
- report generation
- verification
- any setup operation with noticeable latency

Spinner cleanup is mandatory on success, failure, and cancellation.

---

## 8) Copy System

All in-product text should read like professional technical documentation.

Rules:
1. Sentence case.
2. Direct action language.
3. No slang or internal codenames.
4. Errors must include what failed and what to do next.
5. Warnings must be factual and non-alarmist.
6. Help text must use progressive disclosure.

Preferred examples:
- "Set up a new study."
- "Select a run mode."
- "OpenRouter API key not found. Live runs require OPENROUTER_API_KEY."
- "Run complete. Choose the next action."

Avoid:
- playful internal references
- vague motivational copy
- ambiguous error phrasing

---

## 9) Layout Contract

The guided main entrypoint uses four persistent regions:

1. Header
- product title
- environment status (API key/config/runs)
- current stage indicator

2. Transcript panel
- concise system narrative
- run events and warnings
- receipt/report/verify summaries

3. Guided interaction panel
- current step prompt
- selector/checklist/input controls
- primary and secondary actions

4. Footer
- context-accurate key hints only
- warning count

The guided panel is the primary interaction surface during Stage A and Stage C.

---

## 10) Intake Specification

## 10.1 Question step

Prompt: "What question are you investigating?"

Validation:
- required
- min length: 8
- max length: 500

Primary action: Continue
Secondary action: Cancel

## 10.2 Profile step

Single-select list with short profile descriptions.

Primary action: Continue
Secondary actions: Back, Cancel

## 10.3 Run mode step

Options:
- mock (default)
- live
- save-only

If API key is missing:
- live appears disabled
- explanation is visible inline

Primary action: Continue
Secondary actions: Back, Cancel

## 10.4 Review step

Show:
- question
- selected profile
- selected mode
- advanced overrides (only when changed)

Actions:
- Start run (primary)
- Edit question
- Change profile
- Change mode
- Cancel setup

---

## 11) Run Progress Specification

During Stage B, the progress surface must provide:
1. run status headline
2. counts (planned/attempted/eligible)
3. active batch indicator and elapsed time
4. token/cost summary when available
5. warning stream access

Behavior:
- avoid transcript spam
- dedupe repeating warnings
- preserve critical failures in visible context

Interrupt:
- first Ctrl+C requests graceful stop
- repeated interrupt shows clear escalation messaging

---

## 12) Receipt Specification

Immediately after run completion or failure:
1. show run outcome summary
2. show receipt excerpt
3. show action selector with default focus on most likely next action

Action selector options:
- View report
- Verify run
- Start new study
- Quit

No blank post-run state is allowed.

---

## 13) Implementation Architecture

Required modules:
- `src/ui/transcript/flow/flow-types.ts`
- `src/ui/transcript/flow/flow-machine.ts`
- `src/ui/transcript/flow/flow-actions.ts`
- `src/ui/transcript/flow/flow-render.ts`

Design intent:
1. keep flow transitions explicit and testable
2. keep `app.ts` as orchestration, not state-machine logic
3. keep guided behavior centralized to avoid drift

Integration boundaries must remain:
- engine emits events
- UI subscribes via EventBus
- RunLifecycleHooks remain framework-agnostic
- artifact invariants remain unchanged

---

## 14) Delivery Plan

Phase 0: Spec lock
- approve this spec as execution contract

Phase 1: Flow machine extraction
- explicit state transitions and guards
- complete unit transition matrix

Phase 2: Guided startup and panel wiring
- interactive launch enters guided intake immediately
- one-step-at-a-time rendering

Phase 3: Selection and keyboard polish
- rounded choices, checklist clarity, cancel/back consistency

Phase 4: Progress and spinner polish
- async feedback wrapper
- strict cleanup guarantees

Phase 5: Receipt action loop
- explicit post-run action selector
- report/verify/new/quit loop

Phase 6: Hardening and docs alignment
- copy pass
- narrow-width and NO_COLOR verification
- final consistency pass with help/docs

---

## 15) Test Plan

## 15.1 Unit
- flow transitions
- validation guards
- cancel and restart safety
- run mode safety guards

## 15.2 Integration
- guided startup auto-enters intake
- step selections update state coherently
- review start triggers run controller
- completion/failure transitions are deterministic

## 15.3 PTY E2E
1. launch -> intake -> mock run -> receipt -> quit
2. launch -> live without key -> blocked with explanation
3. launch -> cancel and resume intake -> complete
4. completion -> action selector -> report/verify/new cycle

## 15.4 Copy checks
- key prompts and errors match professional tone rules
- no stale command-first onboarding text in guided path

---

## 16) Acceptance Criteria

1. Guided flow is the default TTY entry experience.
2. Full first-run journey is command-free.
3. Keyboard navigation is complete and discoverable.
4. Live behavior is explicit and safe.
5. Progress and receipt are clear under normal and narrow widths.
6. Copy quality is consistent and professional.
7. All existing quality gates remain green.

---

## 17) Risks and Mitigations

Risk: guided flow regresses power-user speed
- Mitigation: keep advanced surfaces available outside guided primary path.

Risk: polish work outruns behavior correctness
- Mitigation: enforce phase gates and behavioral tests before visual refinements.

Risk: interaction drift across modules
- Mitigation: central flow machine and strict integration boundaries.

Risk: over-animation
- Mitigation: spinner policy and motion budget in review checklist.

---

## 18) Definition of Done

Done means:
1. `arbiter` in TTY launches a guided workflow by default.
2. User can reach receipt and next actions without command knowledge.
3. The experience feels alive, calm, and professional.
4. Documentation/help reflect actual behavior.
5. All quality gates pass.

