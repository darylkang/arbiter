# Arbiter Main Entry UX Rebuild Spec (Authoritative Build Contract)

Status: Draft for implementation  
Owner: Product, UX, Engineering  
Scope: TTY main entry path for `arbiter` from launch through receipt  
Out of scope: Core inference algorithms and policy logic (sampling math, clustering defaults, prompt semantics)

---

## 1. Purpose

This document is a strict implementation contract for rebuilding Arbiter main-entry UX from first principles.

It is normative. Engineering work should treat **MUST** as required, **SHOULD** as strongly recommended, and **MAY** as optional.

Primary objective: the default `arbiter` experience MUST feel like a guided research product, not a terminal log shell.

---

## 2. Vision Anchors (Source of Truth)

This spec is derived from:

1. `/Users/darylkang/Developer/arbiter/docs/2fafecda-4d35-4fd5-a5a7-5521a0397b54_Arbiter_UIUX_Specification.pdf`
2. `/Users/darylkang/Developer/arbiter/docs/d6dc560d-2aa7-4e58-9ad4-a75da8e7e53e_Reasoning_as_a_Distribution.pdf`
3. `/Users/darylkang/Developer/arbiter/docs/d824e33f-082c-43dc-b8a6-c17a50b05ffb_Related_Work.pdf`

Interpretation guardrails:

- The UI/UX PDF defines interaction and presentation behavior.
- The research PDFs define scientific honesty constraints for copy and metrics framing.
- If implementation choices conflict, UX fidelity and scientific honesty take precedence.

---

## 3. Product Contract (Non-Negotiable Outcomes)

When a user runs `arbiter` in a TTY:

1. The user MUST be able to complete launch -> intake -> run -> receipt without commands.
2. The interface MUST use stacked stage blocks with frozen history, below a fixed informational header.
3. Each step MUST present one primary decision at a time.
4. Stage transitions MUST be visually explicit.
5. Runtime telemetry MUST support decisions without dominating the UI.
6. Copy MUST remain professional, precise, and research-honest.
7. The guided path MUST keep one active control at a time.

---

## 4. Information Architecture

## 4.1 Fixed Header (Pinned)

The header MUST remain pinned and non-scrollable.

Header contents:

- `ARBITER` wordmark (block/ASCII style)
- one-line product description
- semantic version
- environment indicators:
  - OpenRouter API key detected: yes/no
  - local config detected: yes/no (+ count if multiple)

Header rules:

- Header MUST NOT contain primary branching controls.
- Header MUST update status in place when environment state changes.

## 4.2 Scrollable Transcript-Block Feed

Below header, the UI MUST render a scrollable stage-block feed.

Block lifecycle:

- Active block: interactive and mutable.
- Frozen block: read-only snapshot retained in scroll history.

Stage order:

1. Stage 1 Intake block
2. Stage 2 Run block
3. Stage 3 Receipt block

Selecting “Start new study” MUST append a new Stage 1 block below frozen prior stages.

Frozen blocks MAY be compacted for space, but MUST remain reviewable through scrolling and expansion.

---

## 5. Stage 1 Intake Contract

## 5.1 Entry Gate (Mode + Path)

The intake block MUST begin with a launch gate that branches by environment.

Launch-gate sequence MUST be:

1. Choose run mode (`Live run` or `Mock run`).
2. Choose start path (`Quick Start` or `Setup Wizard`).

Mode options:

- `Live run`
  - enabled only when API key exists
  - disabled state MUST include inline reason
- `Mock run`
  - always enabled

Path options:

- `Quick Start`
  - enabled only when at least one config exists
- `Setup Wizard`
  - always enabled

If multiple configs are detected, the user MUST select a config before `Quick Start`.

Mode precedence rule:

- The mode selected at launch gate (`Live`/`Mock`) MUST control the immediate run.
- If loaded config mode differs, the review card MUST show both values and indicate that launch mode overrides for this run.

## 5.2 Wizard Step Sequence (Setup Wizard path)

Profiles are removed from the primary guided path.

The wizard MUST include these steps in order:

1. Research question (`x`, multiline text box)
2. Decision labels (`Y`, optional finite label set; default free-form)
3. Decoding parameters (`d`)
4. Persona selection (`p`, checkbox list, min 1)
5. Model selection (`m`, checkbox list with versioned slugs)
6. Protocol selection (`pi`, independent/debate + debate variant if applicable)
7. Advanced settings (collapsed by default)
8. Review and confirm

## 5.3 Quick Start Behavior

`Quick Start` MUST:

- load the selected config,
- skip wizard input steps,
- still route through Review and confirm before run execution.

## 5.4 Review and Confirm

Review card MUST show:

- mode
- question
- labels (or free-form)
- decoding parameters
- personas
- models
- protocol
- advanced settings summary
- output path

Review actions MUST include:

- Accept/start run
- Revise

If `Revise` is selected, prior selections MUST remain preserved.

## 5.5 Back and Cancel Semantics

- `Esc` MUST go to previous wizard step with state preserved.
- `Esc` on first wizard step MUST cancel setup and return to gate.
- `Ctrl+C` outside active run MUST exit.

## 5.6 Validation Rules

Wizard validation MUST enforce:

- Question: non-empty.
- Labels: if enabled, at least 2 unique labels after trim/dedup.
- Temperature: each value in `[0.0, 2.0]`; range min <= max.
- Seed: non-negative integer when fixed.
- Personas: at least 1 selected.
- Models: at least 1 selected.
- Protocol: exactly 1 selected.
- Workers: `>= 1`.
- Batch size: `>= 1`.
- Max trials: `>= 1`.
- Novelty threshold: `> 0`.

---

## 6. Stage 2 Run Contract

Stage 2 MUST render as a dedicated run block below frozen Intake.

Required subregions:

1. Summary card (compact run context)
2. Master progress bar (planned/completed + elapsed + ETA)
3. Worker rows (worker id, busy/idle, trial id, mini progress)
4. Batch status card (refresh at batch boundaries only)

Batch status card MUST include:

- novelty trend/delta
- embedding group count
- stopping threshold current vs target
- stopping status
- inline caveat:
  - "Groups reflect embedding similarity, not semantic categories."
  - "Stopping indicates diminishing novelty, not correctness."

Update cadence:

- master bar and worker rows: per trial completion or throttled <= 100ms
- batch status card: batch boundary only

Narrative noise budget:

- Per-trial success events MUST NOT append transcript lines.
- Non-success events SHOULD aggregate at batch boundary instead of one-line-per-trial spam.
- The run block MUST remain visually stable under high-throughput runs.

Termination conditions:

- threshold met
- max trials completed
- user cancel (`Ctrl+C`) with graceful in-flight drain

After termination, Stage 2 MUST freeze with explicit stop reason.

---

## 7. Stage 3 Receipt Contract

Stage 3 MUST render beneath frozen Run block.

Receipt MUST include:

- completion banner
- results stats card
- artifact manifest based on actual produced files (no guessed outputs)
- reproducibility command

Next actions MUST include:

- Quit
- Start new study
- Open run folder

Action loop behavior:

- Choosing `Start new study` appends a new Stage 1 block.
- Choosing `Open run folder` opens path or prints path fallback.
- Choosing `Quit` exits.

---

## 8. Interaction and Keyboard Contract

Required keyboard behavior:

- Up/Down: move within selection/checkbox lists
- Space: toggle checkbox
- Enter: confirm selection
- Enter in multiline text box: insert newline
- Ctrl+D: confirm multiline text input
- Esc: previous step (intake) or cancel first-step intake
- Ctrl+C during run: graceful cancel (drain in-flight work)
- Ctrl+C outside run: exit application

Focus rules:

- Exactly one focus owner at any time (`editor` or `overlay`).
- Overlay opening MUST transfer focus from editor to overlay.
- Overlay closing MUST restore focus deterministically.

---

## 9. Visual Design System Contract

Visual language MUST be consistent across stages and controls.

Required presentation rules:

- bounded stage cards with clear borders and section hierarchy
- rounded selection affordance style for active options
- consistent spacing rhythm
- one blank line between blocks
- each wizard step renders a section header
- each confirmed wizard step renders an inline confirmation line
- section headers and inline confirmations rendered consistently

Width and wrapping policy:

- Baseline content target: 80 columns.
- Cards SHOULD cap at 78 characters with side margins when practical.
- Primary option labels MUST wrap before truncating.
- Truncation MAY occur only under pathological widths.
- Narrow-width behavior MUST be defined for `< 90`, `< 72`, `< 56`.

No clipping policy:

- option labels MUST NOT be unreadable under supported widths
- highlight backgrounds MUST NOT spill across unrelated regions
- descriptive text MUST NOT overlap footer or neighboring components

---

## 10. Copy and Scientific Honesty Contract

All user-facing text MUST satisfy:

1. Sentence case.
2. Direct active voice.
3. Explicit actionability.
4. No internal engineering jargon.
5. No command-first guidance in guided path.

Error format MUST include:

- what failed
- what to do next

Scientific honesty requirements:

- Never imply stopping means correctness.
- Never imply embedding groups are semantic truth categories.
- Present model availability caveat when listing OpenRouter model choices.

---

## 11. Architecture Contract (Implementation Boundaries)

The rebuild MUST separate three UI channels:

1. Decision channel: step state, user intent, pending actions
2. Narrative channel: frozen stage summaries and key milestones
3. Telemetry channel: raw runtime signals transformed into run-card models

Rules:

- Raw event streams MUST NOT be dumped directly into primary narrative.
- Components MUST render typed view models, not perform ad-hoc formatting logic.
- The UI layer MUST NOT influence engine scheduling or stopping policy.

Suggested module responsibilities:

- `app.ts`: orchestration and composition
- `intake-flow.ts`: step transitions and validation
- `run-controller.ts`: lifecycle adaptation and stage handoff
- `components/*`: pure rendering
- `copy-map.ts`: canonical strings and templates
- `view-model/*`: domain-to-UI transformations

---

## 12. Implementation Plan (Phased)

## Phase A: Foundation and channel separation

Deliverables:

- typed stage view models
- copy-map foundation
- no direct event dump into narrative

Exit criteria:

- stage cards render from view models
- telemetry transformation path exists

## Phase B: Stage 1 complete fidelity

Deliverables:

- full intake gate + Quick Start + config selection
- full wizard sequence including decision-label step
- review/confirm with revise
- full back/cancel semantics

Exit criteria:

- user can complete Stage 1 without commands
- state preservation verified across revise/back paths

## Phase C: Stage 2 complete fidelity

Deliverables:

- run card with master bar, worker rows, batch card
- cadence controls
- noise reduction rules

Exit criteria:

- run observability is actionable and calm
- no transcript spam for per-trial noise

## Phase D: Stage 3 and loop closure

Deliverables:

- receipt card + manifest + reproducibility command
- next actions with loop (`new study`, `open folder`, `quit`)

Exit criteria:

- no dead-end state after run completion

## Phase E: Visual hardening and polish

Deliverables:

- clipping/spill fixes
- narrow-width behavior stabilization
- typography, spacing, and hierarchy polish pass

Exit criteria:

- visual acceptance checklist passes across supported widths

---

## 13. Stress Test: Fidelity to Vision

This section is mandatory pre-implementation validation.

## 13.1 Coverage Matrix

Every core PDF requirement MUST map to an explicit contract clause:

- fixed header -> Section 4.1
- stacked/frozen stage blocks -> Section 4.2
- launch gate with live/mock + quick start/setup -> Section 5.1
- wizard sequence including labels -> Section 5.2
- review/confirm and revise -> Section 5.4
- run progress master + workers + batch card -> Section 6
- cancel/termination behavior -> Section 6
- receipt and action loop -> Section 7
- keyboard semantics -> Section 8
- scientific honesty caveats -> Section 6 and Section 10

If any item is unmapped, implementation MUST be blocked.

## 13.2 Ambiguity Test (Build-Contract Effectiveness)

A contract passes ambiguity testing only if two independent engineers can produce materially similar UX behavior.

The following must be unambiguous in this spec:

- enabled/disabled launch options and reasons
- wizard step order and required validations
- quick-start versus setup-wizard transitions
- revise/back behavior and state preservation
- run update cadence and what updates where
- exact receipt action set and loop behavior
- keyboard ownership and focus transfer rules

Any unresolved ambiguity MUST be promoted to an explicit open question before implementation.

## 13.3 Failure-Mode Test

The contract MUST explicitly define behavior for:

- no API key
- no config found
- multiple configs found
- run cancelled mid-flight
- partial artifact sets
- narrow terminal widths

---

## 14. Testing Contract (PTY-First)

Unit tests are required but insufficient.

Required test layers:

1. Unit:
   - wizard transition matrix
   - validations
   - view-model transforms
   - copy-map integrity
2. Integration:
   - stage handoffs
   - run-controller behavior
   - artifact manifest truthfulness
3. PTY E2E (mandatory):
   - first-run journey (no key/no config)
   - returning journey with Quick Start
   - multiple-config journey
   - cancel journey (`Ctrl+C`)
   - post-run action loop
   - narrow-width rendering checks

---

## 15. Definition of Done

The rebuild is complete only when all are true:

1. `arbiter` default path is guided and command-free for first-run completion.
2. Header is fixed; stage blocks accumulate and freeze.
3. Intake, Run, and Receipt contracts are implemented in full.
4. Visual output is readable and stable at supported widths with no clipping/spill defects.
5. Scientific honesty caveats appear inline where relevant.
6. PTY suite covers all required journeys and passes consistently.
7. Manual visual audit confirms premium, coherent, low-cognitive-load behavior.

---

## 16. Open Questions (Explicit, Non-Blocking)

1. Worker row compaction strategy at very high worker counts (`16+`, `32+`).
2. Whether to expose optional “detailed telemetry” panel in Stage 2.
3. Whether advanced command affordances should remain visible or move behind an advanced toggle.

These questions MUST NOT block Phases A through D.
