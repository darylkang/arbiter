# Arbiter TUI Copy Deck

Status: accepted redesign target
Owner: Arbiter
Last updated: 2026-03-07

## Purpose

Define the canonical user-facing copy for Arbiter TTY surfaces:

1. Stage 0 identity panel
2. Stage 1 setup rail
3. Stage 2 run dashboard
4. Stage 3 receipt

This copy deck is implementation-facing and should be used with:

1. `docs/product-specs/tui-wizard.md` for behavior and UX contract
2. `docs/product-specs/tui-visual-screen-deck.md` for visual layout targets
3. `docs/TUI-RUNTIME.md` for internal runtime architecture and renderer ownership

When this deck and the wizard spec conflict, behavior semantics from `tui-wizard.md` win.

## How To Use This Deck

Line markers:

1. `LOCKED`: must match exactly in runtime UI copy unless explicitly revised here.
2. `FLEX`: can be refined for brevity/fit while preserving meaning and terminology.

Formatting markers:

1. `{var}` indicates runtime interpolation.
2. `·` indicates inline metadata separation.

## Stage Composition Copy Contract

1. `LOCKED`: the identity panel persists throughout Stage 1 and is printed once at the top of the durable transcript.
2. `LOCKED`: Stage 1 uses an inline study rail where content expands beneath the active step marker.
3. `LOCKED`: when `Run now` is chosen, Stage 1 freezes into a completed study rail summary.
4. `LOCKED`: Stage 2 renders beneath the frozen study rail summary.
5. `LOCKED`: Stage 3 renders beneath the final Stage 2 snapshot.
6. `LOCKED`: the durable transcript preserves one instance each of identity panel, frozen rail, final dashboard snapshot, and receipt.
7. `LOCKED`: `arbiter run --dashboard` renders Stage 2 and Stage 3 without identity panel or frozen Stage 1 rail.

## App Chrome Copy Contract

1. `LOCKED`: stage chrome uses lifecycle headers, not shell-like status strips.
2. `LOCKED`: stage header labels are `SETUP`, `RUN`, and `RECEIPT`.
3. `LOCKED`: subsection headers use short-prefix labels such as `── PROGRESS`, `── SUMMARY`, `── ARTIFACTS`.
4. `LOCKED`: command footer copy remains concise and control-first.
5. `LOCKED`: the product uses two header states: expanded identity panel for the Welcome moment, compact brand chrome for later stages when vertical space is constrained.

## Voice System

Arbiter copy should read as a high-confidence research instrument.

Rules:

1. precise and declarative,
2. calm and direct; no hype language,
3. action-oriented where a user must decide or fix something,
4. research-honest: no correctness or truth claims from stopping/grouping outputs,
5. short terminal-scan lines; avoid dense prose,
6. premium and controlled rather than ornamental.

## Terminology Canon

Always use:

1. `Independent`, `Debate`
2. `embedding groups`, `similarity groups`
3. `novelty saturation`, `diminishing novelty`
4. `Stopping indicates diminishing novelty, not correctness.`

Never use in runtime UI:

1. `converged`
2. `correctness` as a result claim
3. `truth`
4. `clusters`
5. `quickstart`

## Global Microcopy Patterns

Validation error pattern:

1. `LOCKED` structure: `Fix required: {action}.`

Warning pattern:

1. `LOCKED` structure: `Warning: {condition}. {impact}. {recommended action}.`

Disabled option interaction pattern:

1. `LOCKED` structure: `{option} (unavailable)`
2. `LOCKED`: `That option is not available.`

Inline metadata pattern:

1. `LOCKED`: model and persona metadata uses compact inline segments separated by ` · `.
2. `LOCKED`: provider names use canonical capitalization (`OpenAI`, `Anthropic`, `Google`, `Meta`).
3. `LOCKED`: raw slugs are not a premium-mode display target when a product display label exists.
4. `FLEX`: pricing or alias metadata may appear as muted inline metadata when it improves scanability.

## Glyph and Label Contract

### Rail Navigation

1. `LOCKED`: completed rail steps use `◆`.
2. `LOCKED`: active rail step uses `▸`.
3. `LOCKED`: pending rail steps use `◇`.
4. `LOCKED`: rail connector uses `│`.
5. `LOCKED`: rail glyphs are reserved for navigation state and must not be reused as selection markers.

### Controls

1. `LOCKED`: single-choice structure: `○ {option}` (unselected), `● {option}` (selected).
2. `LOCKED`: multi-choice structure: `□ {option}` (unselected), `■ {option}` (selected).
3. `LOCKED`: focus cursor `▸` marks the current actionable row.
4. `LOCKED`: do not use `[ ]` or `[x]` in premium-mode selectors.

### Preflight and Signals

1. `LOCKED`: `✓` indicates passed preflight checks.
2. `LOCKED`: `⚠` indicates skipped or warning-state preflight checks.
3. `LOCKED`: `✕` indicates failed preflight checks.
4. `LOCKED`: `●` is used for signal-dot environment indicators.

## Stage 0 Identity Panel

Brand lines:

1. `LOCKED`: `ARBITER`
2. `LOCKED`: `Distributional reasoning harness`
3. `LOCKED`: `v{version}`

Environment rows:

1. `LOCKED`: `● API key    {present_or_missing}`
2. `LOCKED`: `● Run mode   {mode_or_dash}`
3. `LOCKED`: `● Configs    {count} in current directory`
4. `LOCKED`: `{present_or_missing}` values are `detected` or `not detected`.
5. `LOCKED`: `{mode_or_dash}` values are `Live`, `Mock`, or `—`.
6. `LOCKED`: status rows are reusable status-row components; they may render one-per-line in the expanded header or as a compact grouped row in the compact header.

## Stage Headers

1. `LOCKED`: `▍ SETUP`
2. `LOCKED`: `▍ RUN`
3. `LOCKED`: `▍ RECEIPT`
4. `LOCKED`: stage headers may include a right-aligned elapsed clock.

## Stage 1 Setup Wizard

### Shared Labels

1. `LOCKED`: `Back`
2. `LOCKED`: `Next`
3. `LOCKED`: `Confirm`
4. `LOCKED`: `Revise`
5. `LOCKED`: `Run now`
6. `LOCKED`: `Save config and exit`
7. `LOCKED`: `Quit without saving`

### Step 0 Welcome and Entry

Entry path prompt:

1. `LOCKED`: `Choose how to start`
2. `LOCKED`: `Run existing config`
3. `LOCKED`: `Create new study (guided wizard)`

Run mode prompt:

1. `LOCKED`: `Choose run mode`
2. `LOCKED`: `Live (OpenRouter)`
3. `LOCKED`: `Mock (no API calls)`

Disabled-state lines:

1. `LOCKED`: `Run existing config is unavailable: no config files found in this directory.`
2. `LOCKED`: `Live mode is unavailable: OPENROUTER_API_KEY not detected.`

Multiple-config selector:

1. `LOCKED`: `Select a config file`
2. `FLEX`: `Choose one config to review and run.`

### Step 1 Research Question

1. `LOCKED`: `Research Question`
2. `LOCKED`: `Include all relevant context. Arbiter samples responses to characterize distributional behavior.`
3. `LOCKED`: `Question`
4. `FLEX`: `Type your question and press Enter to continue.`
5. `LOCKED`: `Fix required: enter a research question to continue.`

Rail confirmation:

1. `LOCKED`: `◆  Research Question              "{preview}" ({chars} chars)`

### Step 2 Protocol

1. `LOCKED`: `Protocol`
2. `FLEX`: `Select how each trial is structured.`
3. `LOCKED`: `Independent`
4. `LOCKED`: `Debate`
5. `LOCKED`: `Participants (P)`
6. `LOCKED`: `Rounds (R)`
7. `LOCKED`: `Total turns per trial: P × R + 1`
8. `LOCKED`: `Turn order: A..P for each round, then A final`
9. `LOCKED`: `Slot assignments are sampled once per trial and remain fixed for that trial.`
10. `LOCKED`: `Model, persona, and decode are sampled per slot with replacement.`

Rail confirmation:

1. `LOCKED`: `◆  Protocol                       Independent`
2. `LOCKED`: `◆  Protocol                       Debate ({participants}P, {rounds}R)`

### Step 3 Models

1. `LOCKED`: `Models`
2. `FLEX`: `Select one or more models for sampling.`
3. `LOCKED`: `Fix required: select at least one model.`
4. `LOCKED`: `Warning: free-tier models selected. Availability may be limited. Use paid models for publishable research.`

Rail confirmation:

1. `LOCKED`: `◆  Models                         {summary} ({count} selected)`

### Step 4 Personas

1. `LOCKED`: `Personas`
2. `FLEX`: `Select one or more personas for sampling.`
3. `LOCKED`: `Fix required: select at least one persona.`
4. `LOCKED`: persona rows render as `{display_name} · {category}`.
5. `LOCKED`: the focused guidance block renders exactly three content lines:
   - line 1: `{subtitle}`
   - line 2: `{when_to_use}`
   - line 3: `{risk_note}` or blank
6. `LOCKED`: first-pass category vocabulary is `baseline`, `adversarial`, `analytical`, `divergent`.
7. `LOCKED`: visible `recommended` tags are deferred; default personas are communicated by pre-selection only.
8. `LOCKED`: manifest `description` is not used for Personas-step UI copy once the persona catalog exists.

Rail confirmation:

1. `LOCKED`: `◆  Personas                       {summary} ({count} selected)`

### Step 5 Decode Params

1. `LOCKED`: `Decode Params`
2. `FLEX`: `Set temperature and seed behavior for trial sampling.`
3. `LOCKED`: `Temperature mode`
4. `LOCKED`: `Single value`
5. `LOCKED`: `Range (uniform)`
6. `LOCKED`: `Seed mode`
7. `LOCKED`: `Random`
8. `LOCKED`: `Fixed seed`
9. `LOCKED`: `Fix required: temperature must be within [0.0, 2.0].`
10. `LOCKED`: `Fix required: range min must be less than or equal to max.`
11. `LOCKED`: `Fix required: seed must be a non-negative integer.`

Rail confirmation:

1. `LOCKED`: `◆  Decode Params                  temp {temp_summary}, seed {seed_summary}`

### Step 6 Advanced Settings

1. `LOCKED`: `Advanced Settings`
2. `FLEX`: `Use defaults or customize execution and stopping settings.`
3. `LOCKED`: `Use defaults (recommended)`
4. `LOCKED`: `Customize`
5. `LOCKED`: `Execution`
6. `LOCKED`: `Budget and Limits`
7. `LOCKED`: `Stopping Policy`
8. `LOCKED`: `Output`

Rail confirmation:

1. `LOCKED`: `◆  Advanced Settings              defaults`
2. `LOCKED`: `◆  Advanced Settings              {changed_summary}`

### Step 7 Review and Confirm

1. `LOCKED`: `Review and Confirm`
2. `FLEX`: `Review settings, run checks, and choose how to proceed.`
3. `LOCKED`: `Preflight`
4. `LOCKED`: `Schema validation`
5. `LOCKED`: `Output path writable`
6. `LOCKED`: `Live connectivity check`
7. `LOCKED`: `Run now`
8. `LOCKED`: `Save config and exit`
9. `LOCKED`: `Revise`
10. `LOCKED`: `Quit without saving`
11. `LOCKED`: `Config saved: {path}`
12. `LOCKED`: `Starting run`
13. `LOCKED`: `Returning to Step 1 with your selections preserved.`
14. `LOCKED`: `Config Summary`

## Stage 1 Frozen Study Rail (Run Path)

When `Run now` is chosen, all setup steps freeze into completed state. No separate study card is rendered.

Frozen rail lines:

1. `LOCKED`: `◆  Entry Path                     {entry_path_summary}`
2. `LOCKED`: `◆  Run Mode                       {run_mode_summary}`
3. `LOCKED`: `◆  Research Question              "{preview}" ({chars} chars)`
4. `LOCKED`: `◆  Protocol                       {protocol_summary}`
5. `LOCKED`: `◆  Models                         {models_summary} ({count} selected)`
6. `LOCKED`: `◆  Personas                       {personas_summary} ({count} selected)`
7. `LOCKED`: `◆  Decode Params                  temp {temp_summary}, seed {seed_summary}`
8. `LOCKED`: `◆  Advanced Settings              {advanced_summary}`

## Stage 2 Run Dashboard

Stage header:

1. `LOCKED`: `▍ RUN`

Subsection headers:

1. `LOCKED`: `── PROGRESS`
2. `LOCKED`: `── MONITORING`
3. `LOCKED`: `── WORKERS`
4. `LOCKED`: `── USAGE`

Progress block:

1. `LOCKED`: `Trials: {completed}/{planned} · Workers: {workers}`
2. `LOCKED`: progress bar uses bracketless format.
3. `LOCKED`: elapsed time renders inline after percentage.
4. `LOCKED`: ETA renders inline after elapsed with `ETA` prefix.

Monitoring block:

1. `LOCKED`: key `Novelty rate`, value `{value} (threshold {threshold})`
2. `LOCKED`: key `Patience`, value `{current}/{target}`
3. `LOCKED`: key `Status`, value `{sampling_status}`
4. `LOCKED`: `Stopping indicates diminishing novelty, not correctness.`
5. `LOCKED`: `Groups reflect embedding similarity, not semantic categories.` (only when group output is shown)

Workers block:

1. `LOCKED`: `ID`
2. `LOCKED`: `Activity`
3. `LOCKED`: `State`
4. `LOCKED`: `Trial`
5. `LOCKED`: `Model`
6. `LOCKED`: `one worker activity row is rendered per visible async worker.`
7. `LOCKED`: `stage dashboard includes one master progress bar plus per-worker activity bars.`
8. `LOCKED`: worker model labels use product display names when available.

Usage block:

1. `LOCKED`: `Usage so far: {usage_summary}`
2. `LOCKED`: `Mock mode: usage and cost are not tracked.`
3. `LOCKED`: `Cost: {cost_estimate}`

Footer and stop line:

1. `LOCKED`: `Ctrl+C to stop gracefully`
2. `LOCKED`: `Graceful stop requested. Finishing in-flight trials and writing partial artifacts.`

## Stage 3 Receipt

Stage header:

1. `LOCKED`: `▍ RECEIPT`

Receipt lead lines:

1. `LOCKED`: `Stopped: novelty saturation`
2. `LOCKED`: `Stopped: max trials reached`
3. `LOCKED`: `Stopped: user requested graceful stop`
4. `LOCKED`: `Stopped: sampling complete`
5. `LOCKED`: `Stopped: run failed`
6. `LOCKED`: `Stopping indicates diminishing novelty, not correctness.`

Subsection headers:

1. `LOCKED`: `── SUMMARY`
2. `LOCKED`: `── GROUPS`
3. `LOCKED`: `── ARTIFACTS`
4. `LOCKED`: `── REPRODUCE`

Summary labels:

1. `LOCKED`: `Stop reason`
2. `LOCKED`: `Trials`
3. `LOCKED`: `Duration`
4. `LOCKED`: `Usage`
5. `LOCKED`: `Protocol`
6. `LOCKED`: `Models`
7. `LOCKED`: `Personas`

Artifacts:

1. `FLEX`: `Only generated files are listed.`
2. `LOCKED`: `No embeddings were generated because there were zero eligible trials.`

Reproduce:

1. `LOCKED`: `arbiter run --config {config_path}`
2. `LOCKED`: prefer a relative `{config_path}` from the current working directory when available.

Completion footer:

1. `FLEX`: `Run complete.`

## Non-TTY / Headless Copy

1. `LOCKED`: `TTY not detected. Showing headless help.`
2. `LOCKED`: `Dashboard requested without TTY; continuing in headless mode.`

## Copy QA Checklist

1. no shell-like pseudo-command chrome remains in the product surface,
2. compact `ARBITER` brand treatment is used instead of the spaced-out wordmark,
3. rail completion uses `◆`, active uses `▸`, pending uses `◇`,
4. model/persona metadata is inline and product-facing,
5. Stage 2 and Stage 3 subsection labels use short-prefix form (`── LABEL`),
6. receipt hierarchy is visibly parent/child,
7. command footer copy remains concise and control-first,
8. the identity panel appears once at the top of the durable transcript.
