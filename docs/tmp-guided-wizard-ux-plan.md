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

## 3) Non-Negotiables

1. The main TTY path is guided-first.
2. The primary journey is command-free.
3. Mock is the default execution mode.
4. Live execution must be explicit and safe.
5. Copy must be professional, precise, and actionable.
6. Engine/artifact invariants remain unchanged.

---

## 4) Launch Branching Contract

Launch behavior is state-aware.

When `arbiter` starts in TTY:
1. If no config exists: enter intake question step immediately.
2. If config exists: show entry selector overlay with:
   - `Run with current configuration`
   - `Set up a new study`
   - `Quit`

This avoids forcing returning users into setup while preserving guided-first behavior.

---

## 5) Canonical Interaction Paradigm

Use a single paradigm to avoid UI drift:

1. Transcript region for narrative, run events, warnings, receipts.
2. Editor input for free-text questions.
3. Overlays for structured choices:
   - profile selection
   - mode selection
   - review confirmation
   - post-run next actions

Do not introduce a second competing wizard surface. Keep overlays as the structured decision mechanism.

---

## 6) Stage Model

The guided experience has three stages:
1. Intake
2. Run progress
3. Receipt and next actions

## 6.1 Intake substages

Intake is a strict sequence:
1. Question
2. Profile
3. Mode
4. Review

## 6.2 Intake back-navigation matrix

Escape behavior:
- Question: cancel intake and return to launch selector/idle state
- Profile: go back to Question (preserve typed question)
- Mode: go back to Profile
- Review: go back to Mode

Cancel behavior:
- explicit cancel action from Review exits intake safely
- starting a new intake while one is active requires discard confirmation

No step should discard user input without confirmation.

---

## 7) Intake Specification

## 7.1 Question step

Prompt: `What question are you investigating?`

Validation:
- required
- min length: 8
- max length: 500

Actions:
- Continue
- Cancel

## 7.2 Profile step

Single-select overlay with clear descriptions.

Actions:
- Continue
- Back
- Cancel

## 7.3 Mode step

Options:
- mock (default)
- live
- save-only

If API key is missing:
- live is disabled (not merely error-after-select)
- disabled reason is visible inline

Actions:
- Continue
- Back
- Cancel

## 7.4 Review step

Review is mandatory before run start.

Review content:
- question
- selected profile
- selected mode
- advanced overrides (only if changed)

Actions:
- Start run (primary)
- Edit question
- Change profile
- Change mode
- Cancel setup

---

## 8) Run Progress Specification

During running stage, always show:
1. run status headline
2. planned/attempted/eligible counts
3. batch index and elapsed time
4. token/cost summary when available
5. warning access

Behavior rules:
- avoid transcript spam
- dedupe warning repeats
- preserve critical failures in visible context

Interrupt rules:
- first Ctrl+C requests graceful stop
- repeated interrupt shows clear escalation messaging

---

## 9) Receipt and Next Actions Specification

Immediately after completion or failure:
1. show run outcome summary
2. show receipt excerpt
3. show next-action selector overlay

Next-action options:
- View report
- Verify run
- Start new study
- Quit

No blank post-run state is allowed.

---

## 10) Visual and Motion System

## 10.1 Tone

Visual tone: premium, restrained, professional.

Principles:
- strong hierarchy
- calm color usage
- meaningful motion only
- no decorative effects

## 10.2 Color

Use semantic Gruvbox-dark tokens consistently:
- brand, accent, success, warning, error, info, muted, text

Fallback requirements:
- respect `NO_COLOR`
- reduced-color compatibility
- narrow-width readability

## 10.3 Spinner policy

Spinners are only for discrete async UI actions in setup/post-run flows.

Examples:
- config write
- report generation
- verify run

Run progress itself is handled by the progress panel; no perpetual spinner for run telemetry.

Spinner cleanup is mandatory on success, failure, and cancel.

---

## 11) Copy System

All user-facing text must read like professional technical documentation.

Rules:
1. Sentence case.
2. Direct action language.
3. No slang or internal codenames.
4. Errors must include what failed and what to do next.
5. Warnings must be factual and non-alarmist.
6. Help text must use progressive disclosure.

Preferred examples:
- `Set up a new study.`
- `Select a run mode.`
- `OpenRouter API key not found. Live runs require OPENROUTER_API_KEY.`
- `Run complete. Choose the next action.`

## 11.1 Copy migration checklist

Before UX implementation is considered complete:
- replace all legacy onboarding lines with professional equivalents
- remove command-first onboarding prompts from guided launch path
- ensure all overlay titles and prompts follow sentence case
- ensure all errors include a next-step suggestion
- ensure all warnings are concise and factual
- ensure receipt-stage prompts are action-oriented and explicit

---

## 12) Layout Contract

The guided entrypoint uses four persistent regions:
1. Header
   - product title
   - environment status (API key/config/runs)
   - stage indicator (`Setting up`, `Running`, `Complete`)
2. Transcript panel
3. Guided interaction surface (editor + overlays)
4. Footer hints

Footer hints must reflect active context only.

---

## 13) Implementation Architecture (Evolve Existing Code)

Do not create a parallel `flow/` subsystem.

Evolve current modules:
- `src/ui/transcript/state.ts`
- `src/ui/transcript/intake-flow.ts`
- `src/ui/transcript/app.ts`
- `src/ui/transcript/run-controller.ts`
- `src/ui/transcript/components/overlay.ts`

Required design intent:
1. extend existing `NewFlowState` and phase logic
2. add review + back-navigation transitions to current intake controller
3. add post-run action selector in existing run lifecycle flow
4. keep overlay control centralized to current overlay system

Integration boundaries that must remain unchanged:
- engine emits events
- UI subscribes via EventBus
- RunLifecycleHooks remain framework-agnostic
- artifact invariants remain unchanged

---

## 14) Delivery Plan (5 Phases)

Phase 0: Spec lock
- approve this document as execution contract

Phase 1: Launch branching + guided startup
- add config-exists entry selector
- auto-enter intake when config is missing
- remove command-first launch messaging from guided path

Gate:
- TTY launch behavior tests pass

Phase 2: Intake hardening
- add review step
- implement explicit back-navigation matrix
- add question validation and live-disabled behavior

Gate:
- intake transition unit tests pass

Phase 3: Post-run loop
- add post-run next-action selector
- support report/verify/new/quit loop

Gate:
- PTY journey through receipt and next actions passes

Phase 4: Copy and polish pass
- apply copy migration checklist
- stage indicator in header
- spinner helper for setup/post-run async tasks

Gate:
- copy checklist and UX regression tests pass

Phase 5: Final hardening
- narrow-width checks
- NO_COLOR checks
- consistency pass across guided path text and behavior

Gate:
- all quality gates green

---

## 15) Test Plan

## 15.1 Unit tests

- intake transition matrix (forward/back/cancel)
- question validation guards (min/max)
- live disabled logic when API key missing
- review action transitions
- post-run action transitions

## 15.2 Integration tests

- launch with config vs without config branch behavior
- question text persistence across back-navigation
- review step starts run correctly
- completion/failure transitions into next-action selector

## 15.3 PTY E2E

1. launch -> intake -> mock run -> receipt -> quit
2. launch with config -> run current -> receipt -> new study
3. launch -> navigate back during intake -> complete
4. launch -> live unavailable path -> clear guidance -> complete via mock

## 15.4 Copy checks

- guided path contains no command-first onboarding text
- key prompts and errors match tone rules
- completion/failure messaging includes explicit next actions

---

## 16) Acceptance Criteria

1. Guided flow is the default TTY entry experience.
2. Full first-run journey is command-free.
3. Config-exists users get an entry selector instead of forced setup.
4. Back-navigation preserves user inputs.
5. Review step exists before run start.
6. Post-run action selector exists and is looped.
7. Live mode is disabled with explanation when API key is missing.
8. Copy quality is consistently professional.
9. All existing quality gates remain green.

---

## 17) Risks and Mitigations

Risk: accidental architecture duplication
- Mitigation: evolve existing intake/overlay modules; no parallel flow subsystem.

Risk: input loss during navigation
- Mitigation: explicit back-navigation matrix and persistence tests.

Risk: visual polish outruns behavior correctness
- Mitigation: phase gates require behavior tests before polish tasks.

Risk: over-animation
- Mitigation: spinner policy and cleanup tests.

---

## 18) Definition of Done

Done means:
1. `arbiter` in TTY launches a guided workflow by default.
2. User can reach receipt and next actions without command knowledge.
3. The guided flow is safe, recoverable, and professional.
4. Documentation/help reflect actual guided behavior.
5. All quality gates pass.

