# Arbiter TUI Copy Deck

Status: accepted implementation target
Owner: Arbiter
Last updated: 2026-03-05

## Purpose

Define the canonical user-facing copy for Arbiter TTY surfaces:

1. Stage 0 Brand Identity Block
2. Stage 1 Intake Wizard
3. Stage 2 Run Dashboard
4. Stage 3 Receipt

This copy deck is implementation-facing and should be used with:

1. `docs/product-specs/tui-wizard.md` for behavior and UX contract
2. `docs/product-specs/tui-visual-screen-deck.md` for concrete visual layout targets
3. `docs/exec-plans/2026-03-04-premium-visual-reboot.md` for execution plan and validation gates

When this deck and the wizard spec conflict, behavior semantics from `tui-wizard.md` win.

## How To Use This Deck

Line markers:

1. `LOCKED`: must match exactly in runtime UI copy unless explicitly revised in this document.
2. `FLEX`: can be refined for brevity/fit while preserving meaning and terminology.

Formatting markers:

1. `{var}` indicates runtime interpolation.
2. `|` indicates inline option separators, not separate lines.

## Stage Composition Copy Contract

1. `LOCKED`: Stage 0 brand identity block is rendered only on Step 0 entry path. Subsequent steps and stages use the status strip for context.
2. `LOCKED`: Stage 1 uses an inline rail where content expands under the active step marker. Completed steps show `✔` with inline summaries.
3. `LOCKED`: When `Run now` is chosen, the inline rail freezes into a completed-step summary (all steps show `✔` with summaries). This frozen rail summary remains visible in scrollback.
4. `LOCKED`: Stage 2 is rendered below the frozen Stage 1 rail summary and updates in place.
5. `LOCKED`: Stage 3 is rendered below the final Stage 2 snapshot.
6. `LOCKED`: The run-path stack is preserved in terminal scrollback on exit.
7. `LOCKED`: `arbiter run --dashboard` renders Stage 2 and Stage 3 without brand identity block or frozen Stage 1 rail summary.

## App-Shell Copy Contract

1. `FLEX`: top status strip uses compact context format (`arbiter  {stage_context}`).
2. `LOCKED`: command footer is always present and control-first.
3. `LOCKED`: tab hints, when shown, use `←/→ cycle tabs`.

## Color Semantics Contract

1. `LOCKED`: runtime UI uses color to encode focus and status; monochrome-only presentation is not an acceptable premium target.
2. `LOCKED`: warnings use warn color, errors use error color, success states use success color.
3. `LOCKED`: active selection/focus uses accent color; non-active rows remain neutral.
4. `LOCKED`: master and worker progress bars are colorized, with semantic status coloring for worker bars.
5. `LOCKED`: color remains disciplined (no decorative rainbow styling).

## Voice System

Arbiter copy should read as a high-confidence research instrument.

Rules:

1. Precise and declarative.
2. Calm and direct; no hype language.
3. Action-oriented where a user must decide or fix something.
4. Research-honest: no correctness or truth claims from stopping/grouping outputs.
5. Short terminal-scan lines; avoid dense prose.
6. Quality bar: Google/Stripe-grade clarity and consistency.

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
4. `semantic categories` except in the required caveat sentence
5. `clusters`
6. `quickstart`

## Global Microcopy Patterns

Step title pattern:

1. `FLEX`: noun phrase, 1-4 words (`Research Question`, `Advanced Settings`).

Helper text pattern:

1. `FLEX`: one sentence with purpose or caveat.

Validation error pattern:

1. `LOCKED` structure: `Fix required: {action}.`

Warning pattern:

1. `LOCKED` structure: `Warning: {condition}. {impact}. {recommended action}.`

Completion confirmation pattern (inline rail):

1. `LOCKED` structure: `✔  {StepLabel}           {short summary}`
2. `LOCKED`: completed steps align summaries at a consistent column (column 22).
3. `LOCKED`: `✔` is colored `accent.primary`, label is `fg.primary`, summary is `fg.muted`.

Rail glyph pattern:

1. `LOCKED`: active step uses `◆` in `accent.primary`.
2. `LOCKED`: pending steps use `◇` in `accent.secondary`.
3. `LOCKED`: completed steps use `✔` in `accent.primary`.
4. `LOCKED`: active step content is indented under `│` continuation lines in `accent.secondary`.
5. `LOCKED`: rail glyphs (`◆`, `◇`, `✔`) are used exclusively for navigation state. They must not appear in selection controls or preflight indicators.

Selection glyph pattern:

1. `LOCKED` single-choice structure: `○ {option}` (unselected), `● {option}` (selected).
2. `LOCKED` multi-choice structure: `□ {option}` (unselected), `■ {option}` (selected).
3. `LOCKED`: do not use `[ ]` or `[x]` in premium-mode selectors.
4. `LOCKED`: focus cursor `▸` marks the current actionable row.

Navigation hint pattern:

1. `LOCKED` structure: `↑/↓ move · Enter select · Esc back`
2. `LOCKED` structure (tabs): `←/→ cycle tabs · Enter select · Esc back`
3. `FLEX`: include `Space toggle` when multi-select behavior is active.

App-shell chrome pattern:

1. `FLEX`: top status strip should use compact context labels. Canonical values: `onboarding`, `onboarding / mode`, `setup / question`, `setup / protocol`, `setup / models`, `setup / personas`, `setup / decode`, `setup / advanced`, `setup / review`, `run / monitoring`, `run / receipt`. (See screen deck Status Strip section for the authoritative enumerated list.)
2. `LOCKED`: command footer copy must be concise and control-first.

Metadata badge pattern:

1. `LOCKED`: pricing/plan metadata uses compact badges (`[paid]`, `[free]`).
2. `FLEX`: additional capability badges (for example `[fast]`, `[stable]`) may be used when consistently applied.

Preflight checklist symbol pattern:

1. `LOCKED`: `✓` indicates passed preflight checks.
2. `LOCKED`: `⚠` indicates skipped or warning-state preflight checks.
3. `LOCKED`: `✗` indicates failed preflight checks.

Disabled option interaction pattern:

1. `LOCKED` structure: `{option} (unavailable)`
2. `LOCKED`: `That option is not available.`

## Stage 0 Brand Identity Block

The brand identity block renders only on Step 0 (entry path). Subsequent steps use the app-shell status strip for context.

Brand lines:

1. `LOCKED`: `A R B I T E R` (letter-spaced, rendered in `accent.primary` + bold as instrument nameplate).
2. `LOCKED`: `Distributional reasoning harness`
3. `LOCKED`: `v{version}` (right-aligned on the same line as the brand).

Status rows (key-value pairs below brand):

1. `LOCKED`: `API key: {present_or_missing}`
2. `LOCKED`: `Run mode: {mode_or_dash}`
3. `LOCKED`: `Configs: {count} in current directory`
4. `LOCKED`: `{present_or_missing}` values are `detected` or `not detected`.
5. `LOCKED`: `{mode_or_dash}` values are `Live`, `Mock`, or `—`.
6. `LOCKED`: if `{present_or_missing}` is `not detected`, render the value in `status.warn` color.

## Stage 1 Intake Wizard

### Shared Labels

1. `LOCKED`: `Back`
2. `LOCKED`: `Next`
3. `LOCKED`: `Confirm`
4. `LOCKED`: `Revise`
5. `LOCKED`: `Run now`
6. `LOCKED`: `Save config and exit`
7. `LOCKED`: `Quit without saving`

### Step 0 Welcome and Entry

Header and status strip:

1. `LOCKED`: Step 0 renders the Stage 0 brand identity block above the rail. Subsequent steps use the status strip for context.
2. `LOCKED`: Step 0 does not duplicate brand identity lines in the step content area.

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

Title and helper:

1. `LOCKED`: `Research Question`
2. `LOCKED`: `Include all relevant context. Arbiter samples responses to characterize distributional behavior.`

Prompt label and placeholder:

1. `LOCKED`: `Question`
2. `FLEX`: `Type your question and press Enter to continue.`

Validation:

1. `LOCKED`: `Fix required: enter a research question to continue.`

Rail confirmation:

1. `LOCKED`: `✔  Research Question    "{preview}" ({chars} chars)`

### Step 2 Protocol

Title and helper:

1. `LOCKED`: `Protocol`
2. `FLEX`: `Select how each trial is structured.`

Primary options:

1. `LOCKED`: `Independent`
2. `LOCKED`: `Debate`

Debate fields:

1. `LOCKED`: `Participants (P)`
2. `LOCKED`: `Rounds (R)`
3. `LOCKED`: `Total turns per trial: P × R + 1`
4. `LOCKED`: `Turn order: A..P for each round, then A final`
5. `LOCKED`: `Slot assignments are sampled once per trial and remain fixed for that trial.`
6. `LOCKED`: `Model, persona, and decode are sampled per slot with replacement.`

Rail confirmation:

1. `LOCKED`: `✔  Protocol             Independent`
2. `LOCKED`: `✔  Protocol             Debate ({participants}P, {rounds}R)`

### Step 3 Models

Title and helper:

1. `LOCKED`: `Models`
2. `FLEX`: `Select one or more models for sampling.`

Validation:

1. `LOCKED`: `Fix required: select at least one model.`

Free-tier warning:

1. `LOCKED`: `Warning: free-tier models selected. Availability may be limited. Use paid models for publishable research.`

Rail confirmation:

1. `LOCKED`: `✔  Models               {summary} ({count} selected)`

### Step 4 Personas

Title and helper:

1. `LOCKED`: `Personas`
2. `FLEX`: `Select one or more personas for sampling.`

Validation:

1. `LOCKED`: `Fix required: select at least one persona.`

Rail confirmation:

1. `LOCKED`: `✔  Personas             {summary} ({count} selected)`

### Step 5 Decode Params

Title and helper:

1. `LOCKED`: `Decode Params`
2. `FLEX`: `Set temperature and seed behavior for trial sampling.`

Temperature labels:

1. `LOCKED`: `Temperature mode`
2. `LOCKED`: `Single value`
3. `LOCKED`: `Range (uniform)`

Seed labels:

1. `LOCKED`: `Seed mode`
2. `LOCKED`: `Random`
3. `LOCKED`: `Fixed seed`

Validation:

1. `LOCKED`: `Fix required: temperature must be within [0.0, 2.0].`
2. `LOCKED`: `Fix required: range min must be less than or equal to max.`
3. `LOCKED`: `Fix required: seed must be a non-negative integer.`

Rail confirmation:

1. `LOCKED`: `✔  Decode Params        temp {temp_summary}, seed {seed_summary}`

### Step 6 Advanced Settings

Title and helper:

1. `LOCKED`: `Advanced Settings`
2. `FLEX`: `Use defaults or customize execution and stopping settings.`

Gate options:

1. `LOCKED`: `Use defaults (recommended)`
2. `LOCKED`: `Customize`

Group headers:

1. `LOCKED`: `Execution`
2. `LOCKED`: `Budget and Limits`
3. `LOCKED`: `Stopping Policy`
4. `LOCKED`: `Output`

Rail confirmation:

1. `LOCKED`: `✔  Advanced Settings    defaults`
2. `LOCKED`: `✔  Advanced Settings    {changed_summary}`

### Step 7 Review and Confirm

Title and helper:

1. `LOCKED`: `Review and Confirm`
2. `FLEX`: `Review settings, run checks, and choose how to proceed.`

Preflight labels:

1. `LOCKED`: `Preflight`
2. `LOCKED`: `Schema validation`
3. `LOCKED`: `Output path writable`
4. `LOCKED`: `Live connectivity check`
5. `LOCKED` structure: `✓ {check_name}`
6. `LOCKED` structure: `⚠ {check_name}`
7. `LOCKED` structure: `✗ {check_name}`

Live save warning:

1. `LOCKED`: `Live mode requires OPENROUTER_API_KEY to run; config saved but not executed.`

Action labels:

1. `LOCKED`: `Run now`
2. `LOCKED`: `Save config and exit`
3. `LOCKED`: `Revise`
4. `LOCKED`: `Quit without saving`

Action confirmations:

1. `LOCKED`: `Config saved: {path}`
2. `LOCKED`: `Starting run`
3. `LOCKED`: `Returning to Step 1 with your selections preserved.`

### Stage 1 Frozen Rail Summary (Run Path)

When `Run now` is chosen, all wizard steps freeze into completed state. The frozen rail summary is the inline rail with every step showing `✔` and its summary. No separate "Study Summary card" is rendered.

Frozen rail lines use the completion confirmation pattern:

1. `LOCKED`: `✔  Entry Path           {entry_path_summary}` (for existing-config path: `Run existing config ({filename})`)
2. `LOCKED`: `✔  Run Mode             {run_mode_summary}`
3. `LOCKED`: `✔  Research Question    "{preview}" ({chars} chars)`
4. `FLEX` note: if question text is long, truncate for summary readability (recommended first 80 chars with ellipsis).
5. `LOCKED`: `✔  Protocol             {protocol_summary}`
6. `LOCKED`: `✔  Models               {models_summary} ({count} selected)`
7. `LOCKED`: `✔  Personas             {personas_summary} ({count} selected)`
8. `LOCKED`: `✔  Decode Params        temp {temp_summary}, seed {seed_summary}`
9. `LOCKED`: `✔  Advanced Settings    {advanced_summary}`

## Stage 2 Run Dashboard

Sentinel:

1. `LOCKED`: `── PROGRESS ──` (ruled section header format, replaces `═══ RUN ═══`).

Summary line:

1. `LOCKED`: `Trials: {completed}/{planned} · Workers: {workers}`

Progress block:

1. `LOCKED`: progress bar uses bracketless format: `{bar} {pct}%` (no `[` or `]` wrapping).
2. `LOCKED`: elapsed time renders inline after percentage, no label prefix, format `HH:MM:SS`.
3. `LOCKED`: ETA renders inline after elapsed, prefix `ETA`, format `HH:MM:SS` or `—` when unknown.

Worker block:

1. `LOCKED`: `Workers`
2. `LOCKED`: `ID`
3. `LOCKED`: `Progress`
4. `LOCKED`: `State`
5. `LOCKED`: `Trial`
6. `LOCKED`: `Model`
7. `LOCKED` structure: `W{worker_index} {worker_bar} {worker_pct}% {worker_state} trial {worker_trial} {worker_model}` (bracketless bar, tab-aligned columns)
8. `LOCKED`: `(+{hidden_count} more workers)`
9. `LOCKED`: `one worker progress row is rendered per visible async worker.`
10. `LOCKED`: `stage dashboard includes one master progress bar plus per-worker progress bars.`

Monitoring block:

1. `LOCKED`: `Monitoring`
2. `LOCKED`: key `Novelty rate`, value `{value} (threshold {threshold})` — rendered as KV row (no colon, 16-char key column).
3. `LOCKED`: key `Patience`, value `{current}/{target}`.
4. `LOCKED`: key `Status`, value `{sampling_status}`.
5. `LOCKED`: `Stopping indicates diminishing novelty, not correctness.`
6. `LOCKED`: `Groups reflect embedding similarity, not semantic categories.` (show only when group output is shown)

Usage block:

1. `LOCKED`: `Usage so far: {usage_summary}`
2. `LOCKED`: `Usage not applicable` (mock mode)
3. `LOCKED`: `Cost: {cost_estimate}` (`estimate` label required when not reliable)

Graceful-stop line:

1. `LOCKED`: `Graceful stop requested. Finishing in-flight trials and writing partial artifacts.`

## Stage 3 Receipt

Sentinel:

1. `LOCKED`: `── RECEIPT ──` (ruled section header format, replaces `═══ RECEIPT ═══`).

Completion banner:

1. `LOCKED`: `Stopped: novelty saturation`
2. `LOCKED`: `Stopped: max trials reached`
3. `LOCKED`: `Stopped: user requested graceful stop`
4. `LOCKED`: `Stopped: sampling complete`
5. `LOCKED`: `Stopped: run failed`

Interpretation hint:

1. `LOCKED`: `Stopping indicates diminishing novelty, not correctness.`
2. `FLEX` note: this hint is currently emitted for all stop reasons; a future refinement may conditionally scope it to novelty-related stops.

Summary section labels:

1. `LOCKED`: `Summary`
2. `LOCKED`: `Stop reason`
3. `LOCKED`: key `Trials`, value `{planned} / {completed} / {eligible} (planned / completed / eligible)` — parenthetical is inline documentation, not a separate label.
4. `LOCKED`: `Duration`
5. `LOCKED`: `Usage`
6. `LOCKED`: `Protocol`
7. `LOCKED`: `Models`
8. `LOCKED`: `Personas`

Groups section:

1. `LOCKED`: ruled section header: `GROUPS`. Body content uses "Embedding groups" as a prose label.
2. `LOCKED`: `Top group sizes`
3. `LOCKED`: `Groups reflect embedding similarity, not semantic categories.` (show only when group output is shown)

Artifact section:

1. `LOCKED`: `Artifacts`
2. `LOCKED`: `No embeddings were generated because there were zero eligible trials.`
3. `FLEX`: `Only generated files are listed.`

Repro section:

1. `LOCKED`: ruled section header: `REPRODUCE`. No prose title line — section body starts directly with the command.
2. `LOCKED`: `arbiter run --config {config_path}`

Exit line:

1. `FLEX`: `Run complete.`

## Non-TTY / Headless Copy

`arbiter` without TTY stdout:

1. `LOCKED`: `TTY not detected. Showing headless help.`

`arbiter run --dashboard` without TTY stdout:

1. `LOCKED`: `Dashboard requested without TTY; continuing in headless mode.`

## Copy QA Checklist

1. Forbidden terms absent from runtime UI surfaces.
2. Canonical caveat lines appear in required contexts.
3. Grouping caveat appears only when group output is shown.
4. Stop-reason labels are consistent across Stage 2 and Stage 3.
5. Validation and warning messages follow the required patterns.
6. Long lines in narrow terminals remain readable without semantic truncation.
7. Brand identity block renders only on Step 0 entry path; subsequent stages use status strip.
8. Frozen Stage 1 rail summary (all steps showing `✔`) remains visible above Stage 2 and Stage 3 in run-path scrollback.
