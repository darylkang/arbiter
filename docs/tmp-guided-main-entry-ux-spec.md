# Arbiter Main Entry UX Rebuild Spec (Authoritative)

Status: Draft for implementation
Owner: UI/UX + Product + Engineering
Scope: `arbiter` TTY main entry path (pre-run through receipt)
Out of scope: core engine behavior changes (sampling, clustering policy defaults, prompt design)

---

## 1. Why Rebuild (Root-Cause Analysis)

The previous iterations improved functionality, but they did not achieve the intended product experience. The root causes are structural, not cosmetic.

### 1.1 Root causes

1. **Wrong primary interaction model**
   - The UI still behaves like a transcript/log shell with guided overlays layered on top.
   - Result: the user experiences a terminal with guardrails, not a guided product.

2. **Mixed paradigms in one surface**
   - Guided flow, command flow, and runtime telemetry all compete in the same visual channel.
   - Result: cognitive overload and weak stage boundaries.

3. **No strict information budget by stage**
   - Irrelevant information appears while user is making decisions.
   - Result: dense screen, difficult scanning, reduced confidence.

4. **Telemetry rendered as primary UX content**
   - System/run events are printed directly into user-facing narrative.
   - Result: noisy, operational feel.

5. **Patching legacy flow instead of replacing the foundation**
   - Prior work optimized existing transcript-first architecture.
   - Result: local fixes, but global UX shape remained wrong.

### 1.2 Non-negotiable implication

A high-fidelity implementation requires a **clean UX architecture shift**:
- from transcript-first shell
- to stage-card guided workflow with constrained telemetry and explicit completion states.

---

## 2. Product Vision Contract

This section defines what must be true for the rebuild to be considered successful.

### 2.1 Launch behavior

Running `arbiter` in a TTY launches a guided application with:
- a fixed informational header,
- stacked stage cards,
- one primary decision at a time,
- no command knowledge required for first-run completion.

### 2.2 Three-stage journey

1. **Intake**: gather all experiment setup inputs.
2. **Run**: show live progress and bounded observability.
3. **Receipt**: summarize outputs and guide next action.

Completed stages remain visible as frozen cards in scroll history.

### 2.3 Interaction intent

The experience should feel like a polished product workflow:
- clear prompts,
- low ambiguity,
- stable keyboard semantics,
- calm and readable visual hierarchy.

---

## 3. UX Principles (Locked)

1. **One primary decision per step**.
2. **No hidden required commands in the primary guided path**.
3. **Progressive disclosure over density**.
4. **Stage transition must feel explicit**.
5. **Telemetry supports decisions; it does not dominate the surface**.
6. **Readability over compactness** (wrap text first; truncate only as last resort).
7. **Professional research tone** (Google-doc quality copy, no slang, no internal jargon).

---

## 4. Target Information Architecture

## 4.1 Fixed header (always visible)

Content:
- App title (`ARBITER` wordmark)
- One-line product description
- Version
- Environment indicators:
  - API key present / missing
  - config present / missing

Rules:
- Header is informational only.
- No primary branching choices in header.

## 4.2 Stage cards (scroll, stacked, persistent)

Cards accumulate in this order:
1. Stage 1 card (Intake summary when complete)
2. Stage 2 card (Run summary when complete)
3. Stage 3 card (Receipt + next actions)

Behavior:
- Active stage card is interactive.
- Completed stage cards are read-only and preserved in scroll history.

## 4.3 Control surfaces

- **Editor** for free text (question entry only when relevant).
- **Selection overlays** for structured decisions.
- **No command dependency** for completing the flow.
- Commands may remain as secondary power-user affordances, never primary guidance.

---

## 5. Stage Specifications

## 5.1 Stage 1: Intake

### 5.1.1 Entry gate

At launch, present start path options based on environment:

- `Run current configuration (mock)`
  - enabled if config exists
- `Run current configuration (live)`
  - enabled if config exists and API key exists
- `Set up new study`
  - always enabled
- `Quit`

If disabled, item remains visible with explicit reason.

### 5.1.2 Wizard steps (explicit setup path)

Profiles are removed from the primary flow.

Wizard steps:
1. Question input (`x`)
2. Decode parameters (`d`)
3. Persona selection (`p`) — checklist
4. Model selection (`m`) — checklist with versioned model identifiers
5. Protocol selection (`pi`) — independent/debate + variant
6. Advanced execution settings
7. Run mode selection (mock/live/save-only)
8. Summary + confirmation

### 5.1.3 Summary and confirm

The final intake step must show:
- question
- decode parameters
- selected personas
- selected models
- protocol
- advanced settings
- run mode

Actions:
- Start
- Edit question
- Change personas
- Change models
- Change protocol
- Change advanced
- Change mode
- Cancel setup

### 5.1.4 Back and cancel semantics

- `Esc` goes back one wizard step with state preserved.
- `Esc` on first step cancels setup.
- `Ctrl+C` exits when not running.

---

## 5.2 Stage 2: Run

Stage 2 is a dedicated run card beneath frozen Stage 1.

Required elements:
- Master progress bar
- Worker status rows (with compaction strategy for large worker counts)
- Batch boundary status card:
  - current/last batch
  - stop-check status
  - clustering/group summary

Rules:
- Keep observability, but constrain noise.
- Trial-level log spam must not flood the primary card.
- Detailed metrics belong in report/receipt artifacts and optional drill-downs.

Exit conditions:
- graceful user interrupt (`Ctrl+C`)
- stopping criteria met
- max trials reached

When run ends, Stage 2 card freezes.

---

## 5.3 Stage 3: Receipt

Stage 3 appears under Stage 2.

Required content:
- run outcome summary
- key stats
- artifact locations
- reproducibility pointers

Required next actions:
- View report
- Verify run
- Start new study
- Quit

Action selector loops until user chooses `Start new study` or `Quit`.

---

## 6. Copy and Content Standards

All user-facing strings must satisfy:

1. Sentence case.
2. Period-terminated where applicable.
3. Action-oriented language.
4. No internal engineering terms (`runtime`, `event bus`, `reducer`, etc.).
5. No command-first guidance in guided stages.

Error message shape:
- what failed
- what to do next

Example:
- "Configuration not found at ./arbiter.config.json. Set up a new study first."

---

## 7. Rendering Rules (Must-Haves)

1. **Primary options must be readable**.
   - Do not ellipsize primary decision labels by default.
   - Use wrapping for explanatory text.

2. **Descriptions must not overwrite adjacent regions**.
   - Overlay layout must be isolated from footer/background text.

3. **Overlay text policy**
   - labels: single line if possible; fallback to wrapped rows when needed
   - descriptions: wrapped, block-style context
   - truncation only for pathological terminal widths

4. **Narrow terminal degradation**
   - define compact behavior for widths `< 90`, `< 72`, `< 56`
   - preserve decision readability before decorative content

5. **Stable focus**
   - one focus owner at a time (editor or overlay list)
   - no remount loops on simple navigation

---

## 8. Architecture Rebuild Plan (First-Principles)

This is a UX architecture rebuild, not a styling patch.

## 8.1 Required separation

Split UI state channels explicitly:

1. **Decision channel**
   - current stage, current step, pending actions
2. **Narrative channel**
   - frozen stage summaries and key milestone lines
3. **Telemetry channel**
   - runtime signal feed mapped to run card widgets

Telemetry should never directly dump into narrative without transformation.

## 8.2 Module responsibilities

- `app.ts`
  - orchestration only
  - no formatting logic
- `intake-flow.ts`
  - step machine + transition contracts
- `run-controller.ts`
  - run lifecycle adapter, no direct UX copy composition beyond event intents
- `components/*`
  - pure rendering of typed UI models
- `copy-map.ts` (new)
  - canonical strings and message templates
- `view-model/*` (new)
  - transforms domain events into stage-card view models

## 8.3 No-lock statement

We are **not** fundamentally locked by backend architecture.

Engine boundaries are already clean. The blocker is frontend model coupling, which this plan resolves by separating channels and stage view-models.

---

## 9. Implementation Phases

## Phase A: Foundation reset

Goal:
- establish stage-card view model and channel separation.

Tasks:
- introduce stage card VM types
- remove direct event-to-transcript dumping for primary UX paths
- centralize copy in canonical map

Exit:
- app renders stage cards from VMs
- no raw run event lines injected into primary narrative by default

## Phase B: Stage 1 fidelity

Goal:
- complete guided intake exactly as specified.

Tasks:
- implement full step sequence
- enforce back/cancel semantics
- implement summary/confirm step
- remove profile-based primary path

Exit:
- first-run user can complete intake with no commands
- all step transitions unit + PTY tested

## Phase C: Stage 2 fidelity

Goal:
- implement bounded observability run card.

Tasks:
- worker rows + master bar + batch card
- stage-aware compaction for narrow terminals
- remove run log spam from primary narrative

Exit:
- run card remains legible across widths
- observability requirements met without transcript noise

## Phase D: Stage 3 fidelity

Goal:
- complete receipt + action loop.

Tasks:
- structured receipt card
- deterministic next-action loop
- resilient report/verify integration

Exit:
- no dead-end post-run states

## Phase E: Visual polish + hardening

Goal:
- stabilize product quality and prevent drift.

Tasks:
- spacing, wrapping, clipping audits
- accessibility/fallback checks
- PTY golden-path + edge-path verification

Exit:
- UI passes visual acceptance checklist and PTY contract tests

---

## 10. Testing Strategy (PTY-First)

Unit tests are required but insufficient.

## 10.1 Required test layers

1. **Unit**
   - transition matrices
   - view-model transforms
   - copy-map integrity

2. **Integration**
   - stage handoffs
   - run adapter behavior

3. **PTY end-to-end (mandatory)**
   - first-run guided flow
   - quickstart flow
   - disabled-live handling
   - backtracking and cancel recovery
   - post-run action loop
   - narrow-width rendering checks

## 10.2 Visual acceptance checklist (manual + PTY)

- No clipped primary option labels in normal widths.
- No text spill into adjacent regions.
- No illegible highlight bands.
- No command-first copy in guided path.
- Clear stage boundaries and frozen-card history.

---

## 11. Definition of Done (Rebuild)

This rebuild is done only when all are true:

1. Main path (`arbiter`) behaves as guided stage-card product, not transcript shell.
2. User can go launch -> intake -> run -> receipt without commands.
3. Stage cards freeze and remain reviewable in scroll history.
4. Run card shows bounded observability with clear progress and worker status.
5. Receipt stage offers clear next-action loop.
6. UI remains readable at supported terminal widths with no clipping/spill defects.
7. PTY suite covers all core paths and passes consistently.

---

## 12. Open Questions (Explicit)

1. Stage 2 worker display cap strategy for very high worker counts (`16+`, `32+`).
2. Whether to add optional collapsible "detailed telemetry" panel in Stage 2.
3. Whether to expose hidden command affordances in a separate advanced mode only.

These are not blockers for foundational rebuild.

---

## 13. Immediate Execution Focus

Immediate priority is **architecture-correct UX foundation**, not incremental styling.

Next execution order:
1. Phase A (channel separation + stage-card VMs)
2. Phase B (full intake fidelity)
3. Phase C (run card observability)
4. Phase D (receipt/action loop)
5. Phase E (visual hardening)

No additional feature expansion until Phases A-C are complete.
