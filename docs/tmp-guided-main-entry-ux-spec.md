# Arbiter Main Entry UX Specification (Guided Product Flow)

Status: draft (authoritative temporary spec)  
Last updated: 2026-02-08  
Primary source of truth: `/Users/darylkang/Developer/arbiter/docs/390167d1-955e-4c05-9382-d496df53fa65_Arbiter_UIUX.pdf`  
Supporting context:
- `/Users/darylkang/Developer/arbiter/docs/d6dc560d-2aa7-4e58-9ad4-a75da8e7e53e_Reasoning_as_a_Distribution.pdf`
- `/Users/darylkang/Developer/arbiter/docs/d824e33f-082c-43dc-b8a6-c17a50b05ffb_Related_Work.pdf`
- OpenClaw wizard interaction patterns in `/Users/darylkang/Developer/openclaw`

---

## 1) Purpose

This spec defines the interactive UX contract for `arbiter` in TTY mode.

The goal is to replace terminal-like operator behavior with a guided product experience that is:
- simple enough for first-time researchers,
- precise enough for professional research workflows,
- consistent enough to feel like one cohesive product.

This is a UX-first specification. Backend and statistical behavior are intentionally out of scope.

---

## 2) Non-Negotiable Product Intent

Derived directly from the PDF vision and research context:

1. Main entry is guided-first, not command-first.
2. The primary path is command-free from launch to receipt.
3. UX has three stages:
   - Intake wizard
   - Run progress and status
   - Summary and receipt
4. Structured choices use rounded selector bubbles and checkboxes with keyboard navigation.
5. Live mode is explicit and safe; mock is default.
6. Copy quality must read like high-quality technical documentation: clear, factual, concise.
7. UI tone is professional research software; visual style is modern, polished, and restrained.

---

## 3) First-Principles Product Frame

Arbiter is not a chat app, not a shell toolkit, and not a dashboard.

Arbiter is an experiment harness for estimating decision distributions under controlled heterogeneity (`c = (m, d, p, pi)`), with strong provenance and reproducibility constraints.

Therefore the entry UX should optimize for:

1. Setup correctness before execution.
2. Confidence before commitment (review before run).
3. Safe defaults over speed hacks.
4. Legible run progress over log noise.
5. Immediate next-step guidance after completion.

---

## 4) Current-State Diagnosis (Objective)

### 4.1 Root disconnect

The current implementation is functionally solid but still presents itself as a terminal runtime. The user experience is interaction-heavy and context-dense in places where the intended flow should be calm and directive.

### 4.2 Drift matrix against vision

| Vision requirement | Current state | Gap |
|---|---|---|
| Guided-first launch | Partially implemented | Guided entry exists but command mental model is still visible and prominent in several surfaces |
| One clear flow from launch to receipt | Partially implemented | Multiple interaction surfaces (transcript logs, overlays, commands) compete for attention |
| OpenClaw-like structured selection feel | Partially implemented | Overlay mechanics exist, but pacing and hierarchy do not yet feel product-guided |
| Three stages with clear transitions | Implemented structurally | Stage boundaries are not always visually obvious to users |
| Professional documentation-grade copy | Partially implemented | Many strings are improved, but full-system consistency and tone governance are incomplete |
| Calm, low-complexity visual density | Not met | Header/progress/transcript/footer combined density still feels operator-centric |

### 4.3 Why users experience it as "complex terminal"

1. Too many simultaneous signals (status chrome, transcript, progress, footer hints, overlays).
2. Transcript still reads like event log stream in parts, not guided narrative.
3. Keyboard model is powerful but not simplified enough for first-run cognition.
4. Command layer is still too visible for the primary journey.

---

## 5) UX Architecture (Target)

The UI should behave as a single guided workflow system with explicit stage transitions.

### Stage A: Guided intake

Objective: produce high-confidence run setup.

Flow:
1. Launch decision gate
2. Research question
3. Profile selection
4. Mode selection
5. Review and confirmation

### Stage B: Run progress

Objective: maintain confidence during execution with low noise.

Flow:
1. Compact setup summary (top-level only)
2. Progress panel updates at meaningful boundaries
3. Warning visibility without transcript spam
4. Graceful interruption semantics

### Stage C: Summary and receipt

Objective: convert completion into immediate next research actions.

Flow:
1. Outcome summary
2. Receipt excerpt
3. Post-run action selector loop:
   - View report
   - Verify run
   - Start new study
   - Quit

---

## 6) Launch Branching Contract

When user runs `arbiter` in TTY:

1. If config is missing:
   - Enter intake immediately at question step.
2. If config exists:
   - Show launch selector with:
     - `Run with current configuration`
     - `Set up a new study`
     - `Quit`

Rules:
- `Run with current configuration` defaults to mock.
- Setup wizard must always remain available.
- No dead-end state after cancellation.

### 6.1 Launch selector content contract

Title:
- `Choose how to continue`

Options (exact order):
1. `Run with current configuration`
2. `Set up a new study`
3. `Quit`

Descriptions:
- `Run with current configuration`: `Start a mock run using the existing configuration.`
- `Set up a new study`: `Create or update setup through guided intake.`
- `Quit`: no description.

Prohibited content on this selector:
- no slash command hints,
- no implementation terms (runtime, event bus, artifacts),
- no debug hints.

---

## 7) Interaction Contract

### 7.1 Surface model

Keep one canonical paradigm:

1. Transcript region for narrative context and outcomes.
2. Input region for free-text question entry.
3. Overlay region for structured selections.

Do not introduce competing wizard panels or mixed paradigms.

### 7.2 Keyboard model

1. Arrow keys: move selection in overlays.
2. Enter: confirm current selection.
3. Space: toggle checkbox selection (where checklist is used).
4. Escape:
   - in intake substeps: move back one step
   - in question step: cancel setup
5. Ctrl+C:
   - during run: request graceful stop
   - outside run: exit application

### 7.3 Back and cancel semantics

Back matrix:
- Profile -> Question
- Mode -> Profile
- Review -> Mode

Cancel matrix:
- Question + Escape -> cancel setup
- Review + explicit cancel action -> cancel setup
- Starting new setup while active -> discard confirmation required

State preservation:
- Question text must survive back navigation.
- Profile and mode selections must survive local back navigation until discarded.

### 7.4 Focus and stability contract

1. Only one interactive target may own focus at a time (editor or overlay list).
2. Overlay open/close must not remount unless overlay identity changes.
3. During active overlay interaction, transcript scrolling must not steal focus.
4. Escape behavior must be deterministic:
   - never both "back" and "cancel" in the same context,
   - never silently drop state.

### 7.5 Interaction timing budget

Targets:
1. Selection response: under 100ms perceived latency.
2. Overlay open/close transition: under 150ms.
3. Post-submit acknowledgement line: under 100ms.

Any stage interaction repeatedly exceeding these targets is a UX bug.

---

## 8) UX Content System (Copy and Tone)

### 8.1 Voice requirements

1. Professional and research-oriented.
2. Clear action direction.
3. No slang or internal codenames.
4. Concise, complete sentences.

### 8.2 Error and warning rules

Every error must include:
1. What failed.
2. What user should do next.

Warnings must be:
1. factual,
2. non-alarmist,
3. short.

### 8.3 Canonical copy examples

Preferred:
- `Welcome to Arbiter.`
- `What question are you investigating?`
- `Select a profile.`
- `Review setup before starting the run.`
- `Run complete. Choose the next action.`

Avoid:
- runtime/debug framing in user-facing onboarding text
- command-first instructions in primary guided path
- overly terse operator shorthand

### 8.4 Stage copy map (required strings)

Stage A, question:
- `What question are you investigating?`

Stage A, profile:
- `Select a profile.`

Stage A, mode:
- `Select a run mode.`
- Live disabled reason: `Requires OPENROUTER_API_KEY.`

Stage A, review:
- `Review setup before starting the run.`

Stage B, start:
- `Starting mock run.` or `Starting live run.`

Stage B, interrupt:
- `Interrupt requested. Waiting for in-flight trials to finish.`

Stage C, completion:
- `Run complete. Choose the next action.`

Stage C, failure:
- `Run failed. Choose the next action.`

All of the above must be used as canonical text or strict semantic equivalents.

---

## 9) Visual System Contract

### 9.1 Design direction

1. Cohesive design system across TUI and CLI help surfaces.
2. Gruvbox-dark semantic color tokens (already present in codebase).
3. Visual hierarchy first, decoration second.

### 9.2 Density and spacing rules

1. Primary decision area must remain visually dominant.
2. Secondary telemetry must be compact and deferential.
3. Remove repetitive event lines that do not aid user decisions.
4. Avoid continuous vertical churn in the transcript while overlays are active.

### 9.2.1 Information budget by stage

Stage A (setup):
- Must show:
  - one primary prompt,
  - one structured selector when applicable,
  - minimal status indicators.
- Must hide:
  - detailed run telemetry,
  - verbose warning history by default.

Stage B (running):
- Must show:
  - progress summary card,
  - latest batch status,
  - warning count and access affordance.
- Must hide:
  - non-actionable historical debug chatter.

Stage C (receipt):
- Must show:
  - outcome summary,
  - receipt excerpt,
  - next-action selector.
- Must hide:
  - setup-only controls.

### 9.3 Motion rules

1. Spinners only for discrete async tasks (report/verify/receipt/config write).
2. No perpetual spinner for run telemetry.
3. Spinner cleanup required on success/failure/cancel.

### 9.4 Interaction components (design contract)

1. Selector bubbles:
   - rounded visual treatment,
   - one active row at a time,
   - clear disabled state.
2. Checkboxes:
   - space toggles,
   - selected and unselected states must be visually distinct without color dependency.
3. Divider and framing:
   - consistent width policy across header/footer,
   - avoid decorative overuse.
4. Progress visuals:
   - compact and stable,
   - no jitter from frequent line churn.

---

## 10) Command Surface Policy

### 10.1 Primary path

Command-free journey is required from launch through receipt for first-run users.

### 10.2 Advanced path

Slash commands may remain as advanced controls, but:
1. they must not be required for normal flow,
2. they must not dominate onboarding copy,
3. they should be discoverable as optional advanced controls.

Advanced controls should appear only after:
1. first-run completion, or
2. explicit user request for advanced help.

### 10.3 Help model

Help should be progressive:
1. root guidance for workflow
2. deeper command help on demand
3. no overload at the top level

Help quality bar:
1. concise overview at root,
2. examples tied to real workflow,
3. no stale flags or legacy references.

---

## 11) Implementation Strategy (From Current Code, No Parallel Architecture)

Evolve existing modules; do not create a second flow engine.

Primary modules:
- `src/ui/transcript/app.ts`
- `src/ui/transcript/intake-flow.ts`
- `src/ui/transcript/reducer.ts`
- `src/ui/transcript/run-controller.ts`
- `src/ui/transcript/components/*`
- `src/ui/transcript/layout.ts`

Maintain architecture boundaries:
1. engine emits events,
2. UI subscribes and renders,
3. run lifecycle hooks remain framework-agnostic.

---

## 12) Sequenced Delivery Plan (Execution Order, Not Calendar)

### Phase 1: Interaction simplification baseline

Goals:
1. reduce always-on density in header/progress/footer,
2. remove non-essential transcript event noise,
3. ensure overlay behavior is stable and non-jittery.
4. enforce stage-level information budget.

Acceptance:
1. guided decisions remain clear under active run,
2. no visual churn when overlay state is unchanged,
3. full test suite green.

### Phase 2: Guided intake parity with vision

Goals:
1. lock launch branching behavior,
2. lock question/profile/mode/review flow,
3. enforce back/cancel semantics and state preservation,
4. lock live-disabled behavior without API key.
5. enforce canonical stage copy map.

Acceptance:
1. intake transition matrix unit-tested,
2. PTY happy path launch -> receipt passes,
3. no command knowledge required.

### Phase 3: Stage clarity and pacing

Goals:
1. strengthen stage boundaries (setup/running/complete),
2. make run telemetry concise and decision-relevant,
3. ensure post-run action selector loop is default completion behavior.
4. ensure focus stability and no layout thrash during overlays.

Acceptance:
1. users can complete report/verify/new/quit from guided selector only,
2. no blank post-run state,
3. progress and warning surfaces remain legible at narrow widths.

### Phase 4: Copy quality pass (system-wide)

Goals:
1. enforce professional copy contract across all user-facing strings,
2. remove remaining operator-centric wording,
3. align CLI help and TUI onboarding language.
4. ensure message-level consistency with stage copy map.

Acceptance:
1. copy checklist fully passes,
2. no command-first onboarding text in guided path,
3. error and warning messages include clear next action.

### Phase 5: UX hardening and drift prevention

Goals:
1. add missing behavior tests for nuanced navigation and selector loops,
2. formalize vision conformance checklist in PR process,
3. prevent regression back into terminal-runtime UX.
4. codify anti-pattern checks in review checklist.

Acceptance:
1. test coverage includes launch branching, full guided flow, backtracking, cancellation, and post-run action loop,
2. conformance checklist required before merge,
3. all quality gates remain green.

---

## 13) Validation and Test Plan

### 13.1 Unit tests

1. intake transition matrix (forward/back/cancel/discard-confirm)
2. question validation boundaries
3. live-mode availability logic
4. post-run selector transitions
5. reducer behavior for concise progress updates

### 13.2 Integration tests

1. launch with config vs without config
2. setup completion to run handoff
3. run completion to post-run selector loop
4. report and verify actions from selector
5. launch selector content and order contract

### 13.3 PTY E2E tests

1. first-run guided journey to receipt and quit
2. existing-config quick-start branch
3. back-navigation and revise path
4. live-disabled path with no API key

### 13.4 Copy checks

1. sentence case and action clarity
2. no command-first onboarding on primary path
3. explicit next-step guidance in errors
4. stage copy map conformance

---

## 13.5 Anti-pattern checks (must fail review)

1. Any onboarding text that starts with command instructions.
2. Any stage that exposes more than one primary decision at once.
3. Any selector with ambiguous Escape semantics.
4. Any run-progress view that prints repetitive non-actionable event lines.
5. Any completion state without explicit next-action choices.

---

## 14) Product Governance (PM + UX + Research)

This product spans three responsibilities:

1. UX design:
   - optimize cognitive load and interaction clarity.
2. Product management:
   - enforce staged scope and acceptance gates.
3. Research integrity:
   - ensure setup choices map clearly to experimental intent and reproducibility constraints.

No phase is complete unless all three lenses pass.

---

## 15) Vision Conformance Checklist (Must Pass)

1. Does launch feel like a guided product, not a shell?
2. Can a first-time user run end-to-end without commands?
3. Are setup choices one-at-a-time and easy to revise?
4. Are live-mode safety constraints explicit and preemptive?
5. Is run progress readable without transcript overload?
6. Is completion followed by clear next actions?
7. Does the copy read like professional technical documentation?
8. Does the entire surface feel cohesive and premium?
9. Are selector bubbles and checkboxes clearly usable with keyboard-only input?
10. Does the UI avoid feeling like a generic terminal runtime?

If any item fails, implementation is not done.

---

## 16) Definition of Done

Done means all of the following are true:

1. Guided-first launch and setup are the default TTY experience.
2. The primary workflow is command-free and low-friction.
3. The UI is calm, legible, and stage-oriented rather than terminal-dense.
4. Copy quality is consistently professional across TUI and CLI help.
5. Full quality gates are green.
6. Vision conformance checklist passes in full.
