# Arbiter TUI Copy Deck

Status: accepted implementation target
Owner: Arbiter
Last updated: 2026-03-05

## Purpose

Define the canonical user-facing copy for Arbiter TTY surfaces:

1. Stage 0 Persistent Masthead
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

1. `LOCKED`: Stage 0 masthead is persistent in the run path and remains visible across Stage 1 through Stage 3.
2. `LOCKED`: Stage 1 editable pages are replaced by a frozen Stage 1 Study Summary card once `Run now` is chosen.
3. `LOCKED`: Stage 2 is rendered below the frozen Stage 1 Study Summary card and updates in place.
4. `LOCKED`: Stage 3 is rendered below the final Stage 2 snapshot.
5. `LOCKED`: The run-path stack is preserved in terminal scrollback on exit.
6. `LOCKED`: `arbiter run --dashboard` renders Stage 2 and Stage 3 without Stage 0 masthead or frozen Stage 1 Study Summary.

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

Completion confirmation pattern (spine):

1. `LOCKED` structure: `✔ {StepLabel}: {short summary}`

Selection glyph pattern:

1. `LOCKED` single-choice structure: `○ {option}` (unselected), `● {option}` (selected).
2. `LOCKED` multi-choice structure: `◇ {option}` (unselected), `◆ {option}` (selected).
3. `LOCKED`: do not use `[ ]` or `[x]` in premium-mode selectors.

Navigation hint pattern:

1. `LOCKED` structure: `↑/↓ move · Enter select · Esc back`
2. `LOCKED` structure (tabs): `←/→ cycle tabs · Enter select · Esc back`
3. `FLEX`: include `Space toggle` when multi-select behavior is active.

App-shell chrome pattern:

1. `FLEX`: top status strip should use compact context labels (`setup / models`, `run / monitoring`).
2. `LOCKED`: command footer copy must be concise and control-first.

Disabled option interaction pattern:

1. `LOCKED` structure: `{option} (unavailable)`
2. `LOCKED`: `That option is not available.`

## Stage 0 Persistent Masthead

Identity lines:

1. `LOCKED`: `ARBITER`
2. `LOCKED`: `Distributional reasoning harness`
3. `LOCKED`: `Version {version}`

Status strip:

1. `LOCKED`: `Environment`
2. `LOCKED`: `OpenRouter API key: {present_or_missing}`
3. `LOCKED`: `Run mode: {mode_or_dash}`
4. `LOCKED`: `Configs in current directory: {count}`
5. `LOCKED`: `{present_or_missing}` values are `detected` or `not detected`.
6. `LOCKED`: `{mode_or_dash}` values are `Live`, `Mock`, or `—`.

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

1. `LOCKED`: rendered by Stage 0 Persistent Masthead.
2. `LOCKED`: Step 0 does not duplicate Stage 0 identity/status lines.

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

Spine confirmation:

1. `LOCKED`: `✔ Question: "{preview}" ({chars} chars)`

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

Spine confirmation:

1. `LOCKED`: `✔ Protocol: Independent`
2. `LOCKED`: `✔ Protocol: Debate ({participants} participants, {rounds} rounds)`

### Step 3 Models

Title and helper:

1. `LOCKED`: `Models`
2. `FLEX`: `Select one or more models for sampling.`

Validation:

1. `LOCKED`: `Fix required: select at least one model.`

Free-tier warning:

1. `LOCKED`: `Warning: free-tier models selected. Availability may be limited. Use paid models for publishable research.`

Spine confirmation:

1. `LOCKED`: `✔ Models: {summary} ({count} selected)`

### Step 4 Personas

Title and helper:

1. `LOCKED`: `Personas`
2. `FLEX`: `Select one or more personas for sampling.`

Validation:

1. `LOCKED`: `Fix required: select at least one persona.`

Spine confirmation:

1. `LOCKED`: `✔ Personas: {summary} ({count} selected)`

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

Spine confirmation:

1. `LOCKED`: `✔ Decode: temp {temp_summary}, seed {seed_summary}`

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

Spine confirmation:

1. `LOCKED`: `✔ Advanced: defaults`
2. `LOCKED`: `✔ Advanced: {changed_summary}`

### Step 7 Review and Confirm

Title and helper:

1. `LOCKED`: `Review and Confirm`
2. `FLEX`: `Review settings, run checks, and choose how to proceed.`

Preflight labels:

1. `LOCKED`: `Preflight`
2. `LOCKED`: `Schema validation`
3. `LOCKED`: `Output path writable`
4. `LOCKED`: `Live connectivity check`

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

### Stage 1 Frozen Study Summary Card (Run Path)

Card header:

1. `LOCKED`: `Study Summary`

Summary lines:

1. `LOCKED`: `Question: {question}`
2. `FLEX` note: if question text is long, truncate for summary readability (recommended first 80 chars with ellipsis).
3. `LOCKED`: `Protocol: {protocol_summary}`
4. `LOCKED`: `Models: {models_summary}`
5. `LOCKED`: `Personas: {personas_summary}`
6. `LOCKED`: `Decode: {decode_summary}`
7. `LOCKED`: `Execution: workers {workers}, batch {batch_size}, K_max {k_max}`
8. `LOCKED`: `Output dir: {output_dir}`
9. `LOCKED`: `Source config: {source_config_path}` (show only when entering via `Run existing config`)

## Stage 2 Run Dashboard

Title:

1. `LOCKED`: `═══ RUN ═══`

Note: sentinel format may be updated during visual overhaul to match card-style headers. If updated, the new format becomes the `LOCKED` value and PTY assertions must be updated atomically.

Summary strip:

1. `LOCKED`: `Trials: {completed}/{planned} | Workers: {workers}`

Progress block:

1. `LOCKED`: `Master progress`
2. `LOCKED`: `[{bar}] {pct}%`
3. `LOCKED`: `Elapsed: {elapsed}`
4. `LOCKED`: `ETA: {eta_or_dash}`

Worker block:

1. `LOCKED`: `Workers`
2. `LOCKED` structure: `W{worker_index} [{worker_bar}] {worker_pct}% · {worker_status} · trial {worker_trial}`
3. `LOCKED`: `(+{hidden_count} more workers)`
4. `LOCKED`: `one worker progress row is rendered per visible async worker.`
5. `LOCKED`: `stage dashboard includes one master progress bar plus per-worker progress bars.`

Monitoring block:

1. `LOCKED`: `Monitoring`
2. `LOCKED`: `Novelty rate: {value} (threshold {threshold})`
3. `LOCKED`: `Patience: {current}/{target}`
4. `LOCKED`: `Status: {sampling_status}`
5. `LOCKED`: `Stopping indicates diminishing novelty, not correctness.`
6. `LOCKED`: `Groups reflect embedding similarity, not semantic categories.` (show only when group output is shown)

Usage block:

1. `LOCKED`: `Usage so far: {usage_summary}`
2. `LOCKED`: `Usage not applicable` (mock mode)
3. `LOCKED`: `Cost: {cost_estimate}` (`estimate` label required when not reliable)

Graceful-stop line:

1. `LOCKED`: `Graceful stop requested. Finishing in-flight trials and writing partial artifacts.`

## Stage 3 Receipt

Title:

1. `LOCKED`: `═══ RECEIPT ═══`

Note: sentinel format may be updated during visual overhaul to match card-style headers. If updated, the new format becomes the `LOCKED` value and PTY assertions must be updated atomically.

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
3. `LOCKED`: `Trials (planned/completed/eligible)`
4. `LOCKED`: `Duration`
5. `LOCKED`: `Usage`
6. `LOCKED`: `Protocol`
7. `LOCKED`: `Models`
8. `LOCKED`: `Personas`

Groups section:

1. `LOCKED`: `Embedding groups`
2. `LOCKED`: `Top group sizes`
3. `LOCKED`: `Groups reflect embedding similarity, not semantic categories.` (show only when group output is shown)

Artifact section:

1. `LOCKED`: `Artifacts`
2. `LOCKED`: `No embeddings were generated because there were zero eligible trials.`
3. `FLEX`: `Only generated files are listed.`

Repro section:

1. `LOCKED`: `Reproduce this run`
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
7. Stage 0 masthead remains present in Stage 2 and Stage 3 run-path renders.
8. Frozen Stage 1 Study Summary card remains visible above Stage 2 and Stage 3 in run-path output.
