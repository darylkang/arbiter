# Arbiter Guided TUI Rebuild Plan (Flow-First, Command-Second)

Status: proposal  
Scope: interactive TTY experience only (`arbiter` with no args)  
Out of scope: engine semantics, artifact schemas, headless CLI behavior changes (except where needed for consistency)

---

## 1) Executive Summary

The current TUI is transcript-first and command-first. It is functional but asks users to remember commands and mentally orchestrate workflow steps.

Target state: a guided, flow-first experience where the default path actively leads users through:

1. Intake
2. Run progress
3. Receipt + next actions

This should feel:

- as simple as an Apple setup flow,
- as polished as Claude Code,
- with OpenClaw-inspired interaction patterns (arrow-key lists, clear step prompts, lively but restrained motion),
- and consistent with Arbiter’s retro arcade / Gruvbox design language.

Core shift:

- Current: `terminal + commands`.
- Target: `guided wizard + optional command palette`.

---

## 2) Product Intent (What We Are Building)

Arbiter is a research-grade distributional experimentation tool. Interactive UX should optimize for:

- getting from question -> run -> interpretable receipt quickly,
- reducing accidental misuse (live cost, wrong mode, wrong profile),
- preserving auditability and determinism of backend outputs,
- enabling repeatable experimentation without requiring users to memorize flags.

The UX should treat “run a study” as a guided product workflow, not a shell command assembly exercise.

---

## 3) Current-State Diagnosis

### Current strengths

- Good backend boundaries and lifecycle hooks.
- Reliable event-driven run progress.
- Existing overlays and keyboard handling.
- Strong tests (unit + smoke + PTY).

### Current UX gaps

- User starts in a transcript shell, not a guided sequence.
- `/new` is discoverable only if user reads help.
- Commands are still primary mental model in the interactive path.
- Step context is implicit, not explicit.
- Progress and receipt exist, but the journey to them is not strongly scaffolded.

Conclusion: strong infrastructure, wrong default interaction contract.

---

## 4) UX Principles (Decision Rules)

1. Guided by default  
When launched interactively, Arbiter should ask the next relevant question automatically.

2. One decision per step  
Each step should ask one thing, with clear defaults and escape hatch.

3. Safe by default  
Mock mode default. Live mode explicit and confirmed.

4. Fast keyboard loop  
Arrow keys, Enter, Escape, Space for toggles. No mouse assumptions.

5. Premium restraint  
Use color/motion/spinners purposefully. No visual noise.

6. Command fallback, not command requirement  
Commands remain available as power-user shortcuts.

---

## 5) Target Interaction Model

## 5.1 Primary modes

- `guided` (default for TTY no-arg launch)
- `command` (slash command entry, optional)

The app starts in `guided`.

## 5.2 3-stage flow (authoritative)

### Stage A: Intake

Ordered wizard steps:

1. Research question (text input)
2. Profile selection (arrow-key rounded choices)
3. Run mode selection (mock/live/save-only)
4. Review and confirm (summary card + CTA)

Optional advanced panel (collapsed by default):

- max trials
- batch size
- workers
- strict/permissive
- contract failure policy

### Stage B: Run Progress

- Persistent progress region
- Streaming status updates
- Warnings surfaced inline and in a dedicated drawer
- `Ctrl+C` graceful interrupt request

### Stage C: Receipt & Next Actions

- Auto-render receipt block
- Guided action list:
  - view report
  - verify artifacts
  - start another study
  - quit

No blank “what now?” moment.

---

## 6) Information Architecture

## 6.1 Layout regions

1. Header
- brand/title
- environment state: api key, config path, runs count

2. Main transcript panel
- system narrative
- run events
- warnings/errors
- receipt/report/verify summaries

3. Interaction rail (contextual)
- current step prompt
- option list / checklist / confirm
- focused input when text is required

4. Footer
- active key hints
- mode indicator
- warning count

## 6.2 Interaction states

- `idle`
- `intake.question`
- `intake.profile`
- `intake.mode`
- `intake.review`
- `running`
- `postrun.actions`

This replaces the current coarse `intake` stage with explicit substates.

---

## 7) Visual Design System (Unified, Premium, Consistent)

## 7.1 Palette

Use existing Gruvbox-dark semantic mapping as the single source:

- brand / accent / success / warn / error / info / muted / text

No divergent color logic between wizard and command surfaces.

## 7.2 Typography and hierarchy

- Headers: bold brand color, short and meaningful.
- Step prompts: high-contrast, single sentence.
- Supporting text: muted, compact.
- Critical actions: accent + strong affordance.

## 7.3 Rounded “choice bubbles”

Adopt rounded choice rows in list overlays using unicode forms:

- normal: `( ) Profile name`
- focused: `❯ (●) Profile name`
- multi-select checked: `[●] item`
- multi-select unchecked: `[ ] item`

Keep these consistent in all selection contexts.

## 7.4 Motion and feedback

- Spinners only for real async work:
  - config write
  - run startup
  - report/verify generation
- Subtle transitions:
  - step change
  - overlay open/close
- No decorative animations during typing or idle.

---

## 8) Functional UX Spec

## 8.1 Startup behavior (`arbiter` in TTY)

Default immediately enters guided intake.

Expected first transcript messages:

1. Welcome line
2. “Let’s set up your study.”
3. Prompt: “What question are you investigating?”

## 8.2 Intake step contracts

### Question step

- Input accepts plain text.
- Validation:
  - non-empty
  - min 8 chars
  - max 500 chars

### Profile step

- Arrow key list with descriptions.
- Enter confirms.
- Escape returns to previous step.

### Mode step

Options:

- mock (default)
- live
- save only

Rules:

- live unavailable if no API key (disabled item + inline explanation).

### Review step

Show summary:

- question
- profile/template
- run mode
- execution overrides (if changed)

Actions:

- `Start run`
- `Edit question`
- `Change profile`
- `Change mode`
- `Cancel`

## 8.3 Running stage contracts

- Progress headline:
  - planned / attempted / eligible
- Batch progress:
  - current batch + elapsed
- Usage:
  - prompt/completion/total/cost
- Warnings:
  - deduped
  - always visible in warning drawer command

## 8.4 Post-run stage contracts

Always show:

- run result status
- receipt excerpt
- next-action selector

Actions:

- `View report`
- `Verify run`
- `Start new study`
- `Quit`

---

## 9) Command Model in Interactive Mode

Slash commands remain, but repositioned:

- primary audience: advanced users
- secondary path: everyone else

Guided flow should cover 90% of normal usage without requiring a command.

Keep commands:

- `/help`
- `/new`
- `/run [mock|live]`
- `/report [run_dir]`
- `/verify [run_dir]`
- `/receipt [run_dir]`
- `/warnings`
- `/quit`

But startup should not depend on user typing `/new`.

---

## 10) Architecture Proposal (Within Current Codebase)

## 10.1 New module boundaries

Add flow orchestration modules:

- `src/ui/transcript/flow/flow-machine.ts`
- `src/ui/transcript/flow/flow-types.ts`
- `src/ui/transcript/flow/flow-actions.ts`
- `src/ui/transcript/flow/flow-render.ts`

Purpose:

- keep `app.ts` thin (composition only),
- make step transitions testable as pure logic,
- avoid scattering flow control across overlays and commands.

## 10.2 State changes

Extend `AppState`:

- replace `newFlow.stage` string trio with explicit discriminated union:
  - `kind: "question" | "profile" | "mode" | "review"`
- add `wizard` metadata:
  - `active: boolean`
  - `stepIndex`
  - `startedAt`

## 10.3 Layout updates

- keep transcript and header/footer.
- add a dedicated “step panel” in layout for guided prompts.
- overlays remain for list/checklist selection; style updated for rounded bubbles.

## 10.4 Controller updates

- `launchTranscriptTUI` should auto-start guided flow on boot when idle.
- commands can call flow actions but should not own flow logic.

---

## 11) Implementation Phases (AI-Agent Oriented)

### Phase 0: UX contract lock

Deliverables:

- this doc approved as source of truth
- explicit acceptance checklist

Gate:

- owner sign-off before code changes

### Phase 1: Flow state machine extraction

Deliverables:

- `flow-machine.ts` pure transitions
- explicit step events (`NEXT`, `BACK`, `CANCEL`, `CONFIRM`)

Gate:

- unit tests for all step transitions and guardrails

### Phase 2: Guided startup + step panel

Deliverables:

- auto-start guided intake on TTY launch
- step panel with one prompt at a time
- back/next navigation

Gate:

- PTY e2e: startup to review without slash commands

### Phase 3: Rounded selection bubbles + checklist polish

Deliverables:

- updated select/checklist visual styling
- consistent focused/selected symbols

Gate:

- visual acceptance on 80x24 and narrow terminal

### Phase 4: Spinner and async feedback

Deliverables:

- spinner API wrapper in TUI context
- spinner usage for run startup/report/verify actions

Gate:

- no spinner artifact left after completion/error

### Phase 5: Post-run guided actions

Deliverables:

- action menu after receipt
- one-key/arrow-key path to report/verify/new/quit

Gate:

- PTY e2e full journey pass

### Phase 6: Hardening + polish

Deliverables:

- docs/help alignment
- keyboard hint audit
- accessibility/fallback checks (`NO_COLOR`, narrow width)

Gate:

- all quality gates green + UX acceptance checklist

---

## 12) Test Strategy (UX-Focused)

## 12.1 Unit (pure flow)

- step transition matrix
- guard conditions (no API key for live)
- cancel/back semantics
- review edit loops

## 12.2 Integration (state + controller)

- guided startup auto-activates intake
- profile/mode selections update state correctly
- start run from review triggers run controller

## 12.3 PTY e2e (critical paths)

1. Launch -> guided intake -> mock run -> receipt -> quit
2. Launch -> choose live without API key -> blocked explanation
3. Launch -> cancel intake -> resume -> finish
4. Post-run action menu -> report -> verify -> new study

---

## 13) Acceptance Criteria (Premium UX Bar)

1. First-time user can complete a full mock study without typing any slash command.
2. Every step is navigable with arrows/enter/escape; no hidden required keys.
3. Live run intent is explicit and safe.
4. Visual language is consistent across wizard panels, overlays, transcript, and footer hints.
5. Spinner usage is meaningful and non-gimmicky.
6. Help text aligns with actual interactive behavior and commands.
7. Terminal width degradation is graceful at 40 columns.
8. All existing backend invariants and artifact behavior remain unchanged.

---

## 14) Risks and Mitigations

Risk: Regressing power-user command workflow  
Mitigation: keep slash commands intact; guided flow is default, not replacement.

Risk: Over-animating and harming usability  
Mitigation: spinner-only policy + motion budget rule in code review.

Risk: State complexity explosion  
Mitigation: explicit flow state machine + reducer tests before UI wiring.

Risk: Drift between CLI and guided TUI semantics  
Mitigation: single source helpers for mode defaults and policy explanations.

---

## 15) Proposed “Definition of Done” for This UX Rebuild

- guided flow is primary path and shipped as default TTY startup behavior
- command-first path remains available but optional
- all gates pass:
  - `npm run build`
  - `npm run check:types`
  - `npm run check:schemas`
  - `npm run test:unit`
  - `npm run test:ui`
  - `npm run test:e2e:tui`
  - `npm run test:cli-contracts`
- user acceptance: “feels like guided product setup, not a generic terminal shell”

---

## 16) Immediate Next Step

Start Phase 1 and Phase 2 first (state machine + guided startup), then review UX in-terminal before styling/motion polish.

---

## 17) OpenClaw Reference Mapping (Concrete Borrowed Patterns)

Reference files inspected:

- `/Users/darylkang/Developer/openclaw/src/wizard/prompts.ts`
- `/Users/darylkang/Developer/openclaw/src/wizard/clack-prompter.ts`
- `/Users/darylkang/Developer/openclaw/src/wizard/onboarding.ts`
- `/Users/darylkang/Developer/openclaw/src/wizard/onboarding.finalize.ts`

Patterns to adopt:

1. Prompter contract abstraction
- OpenClaw separates wizard flow logic from concrete prompt widgets.
- Arbiter should do the same with a `flow-machine` + UI adapter split.

2. One-question-at-a-time setup narrative
- OpenClaw onboarding is intentionally sequential.
- Arbiter should avoid dumping multiple asks at once.

3. Explicit progress objects for long operations
- OpenClaw uses progress handles (`update`, `stop`) for async setup actions.
- Arbiter should wrap spinners in a similar API for run-start/report/verify.

4. Strong cancel semantics
- OpenClaw treats cancellation as first-class.
- Arbiter should preserve back/cancel at every intake step.

5. Contextual notes/hints in flow
- OpenClaw uses concise `note` blocks to explain choices.
- Arbiter should add short just-in-time hints for profile/mode implications.

Patterns to avoid copying directly:

- OpenClaw’s full onboarding breadth (channels, gateway, services) is broader than Arbiter needs.
- Arbiter should keep scope tight: question -> profile -> mode -> run -> receipt.

---

## 18) Scope Guardrails (Prevent Over-Engineering)

Do:

- optimize first-run success and repeatability
- keep option count low in default path
- keep advanced controls collapsed behind “advanced”

Do not:

- rebuild backend orchestration for UX changes
- add decorative animations that do not improve comprehension
- multiply modes/toggles on the main path
