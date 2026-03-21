# Arbiter TUI Wizard Product Spec

Status: accepted implementation target
Owner: Arbiter
Last updated: 2026-03-03

## Purpose

Define the canonical human UX for Arbiter as a strict, linear wizard with persistent staged stack composition in TTY environments.

This is an end-state UX target, not a description of current implementation.

This spec is a clean cutover target. The transcript-style TUI and slash-command-first interaction model are not part of the target UX.

## Product Split

Arbiter has two user-facing interaction products:

1. Wizard TUI for humans in TTY.
2. Headless CLI for automation and scripting.

Headless CLI remains canonical for automation workflows.

## Hard Constraints

1. No engine semantic changes beyond what is required to support this UX.
2. UI remains downstream of run service, events, and artifacts.
3. Determinism, provenance, and artifact guarantees are preserved.
4. TUI launches only in TTY; non-TTY falls back to headless help/commands.
5. Copy must remain research-honest and avoid correctness language.

## Input Contract (Keybindings and Focus)

This contract is normative for wizard behavior.

Global navigation:

1. `Up` and `Down` move the active row in lists.
2. `Space` toggles the focused checkbox.
3. `Enter` confirms the focused control or advances to Next when the current step is valid.
4. `Esc` goes Back where Back is allowed.
5. `Tab` cycles focus between panes and controls when multiple focus regions are present.

Interrupt behavior:

1. In Stage 1, `Ctrl+C` exits the wizard immediately.
2. A confirm prompt on Stage 1 exit is optional when unsaved input exists.
3. In Stage 2, `Ctrl+C` must trigger graceful stop behavior (mandatory).

Step 1 multiline editor behavior:

1. `Enter` submits the question and advances when valid.
2. Manual newline insertion is intentionally unsupported in the wizard input field.
3. `Esc` returns to the previous step.

Validation and disabled controls:

1. Disabled options remain visible, are visually muted, and cannot be selected.
2. Validation errors render inline on the active step.
3. Next and Confirm actions remain blocked until validation passes.

## Terminology and Copy Rules

Use:

1. `Independent` and `Debate` for protocol labels.
2. `embedding groups` or `similarity groups` for grouping output.
3. `novelty saturation` and `diminishing novelty`.
4. `stopping indicates diminishing novelty, not correctness`.

Do not use:

1. `converged` in UI copy.
2. `correct`, `truth`, or semantic-truth framing.
3. `clusters` for user-facing wording in receipt and dashboard.
4. `early stopping` in headings or labels.

## Command Surface and Mode Behavior

CLI surface is intentionally minimal and stable.

Primary entry points:

1. `arbiter`
2. `arbiter init`
3. `arbiter run`

Global flags:

1. `--help`, `-h`
2. `--version`, `-V`

Not part of contract:

1. no `--headless`
2. no `--verbose`
3. no `--wizard`
4. no redundant shorthand aliases beyond `-h` and `-V`

Wizard entry:

1. `arbiter` with TTY stdout launches Wizard TUI.
2. `arbiter` without TTY stdout prints help text and exits `0`.
3. Wizard entry requires no flags.

Headless run path:

1. `arbiter run --config <path>` is required and canonical for automation.
2. Supported runtime override flags are:
   - `--out <dir>`
   - `--workers <n>`
   - `--batch-size <n>`
   - `--max-trials <n>`
   - `--mode <mock|live>`
   - `--dashboard`
3. `--dashboard` is TTY-only monitor rendering (Stage 2 and Stage 3 reuse).
4. If `--dashboard` is used without TTY stdout, print warning to stderr and continue headless.
5. No experiment-variable CLI flags are allowed in v1.
6. Study variables are config-defined only (models, personas, protocol, decode, debate parameters, clustering thresholds).

Bootstrap:

1. `arbiter init` writes a default config in CWD using the same deterministic collision-safe naming sequence as the wizard.
2. `arbiter init` never overwrites an existing config file.
3. Wizard detects Arbiter config files in the current working directory and supports a `Run existing config` path.
4. `arbiter init` prints the created config path and suggested next commands:
   - `arbiter`
   - `arbiter run --config <file>`

### Config discovery (CWD)

Discovery scope and qualification:

1. Discovery scope is CWD only.
2. Files qualify for discovery when the filename matches `arbiter.config.json` or `arbiter.config.<n>.json` where `<n>` is a positive integer.
3. Discovery pattern is equivalent to `^arbiter\.config(?:\.[1-9][0-9]*)?\.json$`.

Enumeration and display:

1. Candidate configs are sorted lexicographically by filename.
2. Display uses filename only, not absolute or relative paths.
3. If multiple configs exist, the UI presents a single-select list.
4. If no configs exist, `Run existing config` is visible but disabled.

Validation behavior:

1. Discovery is filename-based.
2. Selected config validity is enforced at Step 7 preflight via schema validation.

### Config save naming (commit point)

Naming and overwrite rules:

1. New config writes use this deterministic sequence in CWD:
   - `arbiter.config.json`
   - `arbiter.config.1.json`
   - `arbiter.config.2.json`
   - and so on
2. Selection is first available filename in sequence.
3. Existing files are never overwritten.

Existing-config run behavior:

1. If user entered via `Run existing config`, `Run now` executes using the selected file and must not rewrite it.
2. In that path, `Save config and exit` is treated as `Save copy` and writes a new collision-safe filename.

## Stage Model

1. Stage 0: Status strip and brand identity
2. Stage 1: Intake Wizard, then frozen Stage 1 summary
3. Stage 2: Run Dashboard
4. Stage 3: Receipt and auto-exit

No Stage 4 next-action menu.

### Stage Composition Contract

1. Stage 0 status strip remains visible for all interactive stages in the run path. Brand identity block remains visible throughout Stage 1 and is persisted once at the top of the durable run transcript.
2. During editable Stage 1, only one wizard step is active at a time.
3. On `Run now`, Stage 1 transitions from editable form to a frozen Stage 1 summary.
4. During execution, Stage 2 renders on the normal screen via bounded cursor-up overwrite rather than via alternate-screen buffering.
5. When execution ends, the runtime writes one final stacked normal-screen transcript:
   - wizard path: frozen Stage 1 summary, final Stage 2 snapshot, Stage 3 receipt.
6. When Stage 2 ends, its final snapshot remains visible above Stage 3 in that durable transcript.
7. This is not a full transcript stack: prior editable step bodies are not persisted after commit.
8. Stacked composition applies only to wizard `Run now` path; `arbiter run --dashboard` renders Stage 2 and Stage 3 without brand identity block or Stage 1 summary.

## Stage 1: Intake Wizard

Global behavior:

1. Strict linear flow, one active step at a time.
2. Back navigation only through explicit Back controls.
3. Navigation rail shows completed and current steps.
4. Main pane shows only active step content while Stage 1 is editable.
5. Validation gates Next or Confirm.
6. Config is in-memory until explicit commit on Review.
7. After `Run now`, Stage 1 is represented by a frozen summary rather than editable step pages.

### Step 0: Welcome and Entry

Header:

1. Stage 0 brand identity block and status strip are the source for title, tagline, version, and environment indicators throughout Stage 1.
2. Step 0 does not duplicate brand identity lines in the step content area.

Two sequential selections:

1. Entry path:
   - Run existing config
   - Create new study (guided wizard)
2. Run mode:
   - Live
   - Mock

Rules:

1. `Run existing config` is disabled when no configs are found.
2. If one config exists, it is selected directly.
3. If multiple configs exist, user must select exactly one.
4. Existing-config path jumps to Step 7 Review.
5. Live mode is disabled when API key is missing.
6. Run mode selects the runner implementation at runtime and does not rewrite config study semantics.
7. Saving a config does not bake in Live vs Mock; config remains a study definition.

### Step 1: Research Question (`x`)

1. Large multiline text input.
2. Validation: non-empty.
3. Optional char count.
4. Rail confirmation: `✔  Research Question    "{preview}" ({chars} chars)`

### Step 2: Protocol (`pi`)

Primary selection:

1. Independent (default)
2. Debate

Debate parameters:

1. Participants `P` integer >= 2, default 2.
2. Rounds `R` integer >= 1, default 1.

Locked debate mechanics:

1. Total turns per trial = `P * R + 1`.
2. Round order is participant slots `A..P` repeated `R` times, then slot `A` final.
3. Slot assignments are sampled once per trial and fixed within that trial.
4. For each slot, model, persona, and decode assignment are sampled independently with replacement from selected pools.
5. No distinctness constraints apply across slots.

### Debate output semantics (required)

1. Trial output is the final response from participant slot `A` (the final turn).
2. Contract parsing and `parse_status` apply to that final output only.
3. `embed_text` is derived from that final output, or from contract `embed_text_source` derived from that final output.
4. Intermediate debate turns must be persisted for auditability.
5. Intermediate debate turns are persisted in `trials.jsonl` as per-trial `transcript` records.

### Step 3: Models (`m`)

1. Multi-select list with at least one selection required.
2. Compact row format is `{display_name} · {provider_label}`.
3. Models are grouped into non-interactive tier sections (`Flagship`, `Mid`, `Budget`, `Free`) and the cursor skips section headers.
4. A fixed-height focused guidance block sits below the list and updates with the active model.
5. The guidance block always renders exactly three content lines plus one blank separator line after the list:
   - `summary_line`
   - `research_note`
   - `risk_note` or blank
6. The active row appends a compact capability-and-cost fingerprint as muted secondary metadata; non-active rows do not show this fingerprint.
7. Defaults are sourced from the model catalog via `default: true`; first pass uses exactly one default-selected model.
8. Free-tier non-blocking warning is shown when any selected model is in tier `free`.

### Step 4: Personas (`p`)

1. Checkbox list with compact metadata rows.
2. At least one selection required.
3. Focused guidance block updates with the active persona and remains fixed-height while the cursor moves.
4. Default personas are selected from the persona catalog rather than by positional assumption.

### Pool sampling semantics

1. Baseline wizard sampling is uniform across selected models.
2. Baseline wizard sampling is uniform across selected personas.
3. For Independent protocol, one model and one persona are sampled per trial.
4. For Debate protocol, model and persona are sampled per participant slot per trial with replacement.
5. Wizard writes uniform sampling behavior unless and until weights UI is explicitly added.
6. If weighted config fields exist in schemas, baseline wizard does not expose weight editing.

### Step 5: Decode Params (`d`)

1. Temperature mode:
   - single value
   - uniform range
2. Single default: 0.7, valid range [0.0, 2.0].
3. Range defaults: 0.3 to 1.0, with min <= max.
4. Seed mode:
   - random
   - fixed integer >= 0

No sliders. Numeric inputs only.

### Step 6: Advanced Settings (Skippable)

Initial gate:

1. Use defaults (recommended)
2. Customize

Customize groups:

1. Execution:
   - workers
   - batch size
2. Budget and limits:
   - `K_max`
   - max tokens per call
3. Stopping policy:
   - novelty threshold `epsilon`
   - patience
   - `K_min` eligible trials
   - optional similarity advisory threshold
4. Output:
   - output directory
   - run name

Optional embedding-group feature toggle lives here.

Summary should list changed values only.

### Step 7: Review and Confirm (Commit Point)

1. Human-readable config review in the content region, no raw JSON.
2. Preflight checks:
   - schema valid for both `Run now` and `Save config and exit`
   - output path writable for both `Run now` and `Save config and exit`
   - live-mode API key presence only when run mode is Live and action is `Run now`
   - live connectivity is verified at run start after the wizard hands off to Stage 2; it is not a blocking network probe inside the review screen
   - if run mode is Live and action is `Save config and exit`, show warning: `Live mode requires OPENROUTER_API_KEY to run; config saved but not executed.`
   - warnings for risky settings
3. Actions:
   - Run now
   - Save config and exit
   - Revise
   - Quit without saving
4. When one to three models are selected, the review screen lists the exact selected model slugs on indented continuation lines beneath the `Models` summary row.

Revise routing semantics:

1. `Revise` always returns to Stage 1 Step 1 (`Research Question`).
2. All selections are preserved and remain editable through normal forward and back navigation.
3. No file is written while revising; config remains in-memory until commit actions are chosen.
4. For `Run existing config` entry path, Step 1 through Step 6 fields are pre-populated from the selected config.
5. Revising an existing config creates an edited in-memory copy unless and until user commits.
6. `Revise` never modifies the selected source file in place.

Commit rules:

1. Config file is written only for `Run now` or `Save config and exit`.
2. Naming follows the deterministic collision-safe sequence defined in Config save naming.
3. Existing-config path must not rewrite the selected config file on `Run now`.
4. Existing-config path writes a new file only when user chooses save-copy behavior via `Save config and exit`.
5. `Save config and exit` is always available even without OpenRouter API connectivity.
6. `Run now` freezes Stage 1 into a frozen summary and starts Stage 2 below it.

## Stage 2: Run Dashboard

Stage 2 starts only after `Run now`.

Layout behavior:

1. Stage 2 is rendered below the persistent Stage 0 header and frozen Stage 1 summary.
2. During execution, only the Stage 2 live surface is updated; the durable normal-screen transcript is not repeatedly rewritten.
3. On termination, Stage 2 final state is committed once to the normal-screen transcript above Stage 3 receipt.
4. If terminal height is constrained, the live surface may compact or degrade, but the final durable transcript still preserves the final Stage 2 snapshot once.

Required regions:

1. Compact dynamic summary line: trials completed/planned and workers. (Stage 3 receipt uses planned/completed/eligible order — the asymmetry is intentional: Stage 2 foregrounds progress, Stage 3 foregrounds completeness.)
2. Master progress: progress bar, completed and planned counts, elapsed time, and best-effort ETA (`—` when unknown).
3. Worker table when workers > 1:
   - worker id
   - status
   - current trial id
   - activity indicator
   - overflow line for hidden workers
4. Batch and monitoring card at batch boundaries:
   - novelty rate vs threshold
   - patience progress
   - status text for continue or likely stop
   - optional embedding-group counts
   - required always-visible caveat line:
     - stopping indicates diminishing novelty, not correctness
   - conditional caveat line when embedding groups are displayed:
     - embedding groups reflect similarity, not semantic categories

Worker table status and rendering rules:

1. Worker status values are `idle`, `running`, `finishing`, and `error`.
2. If true per-trial percent progress is unavailable, render a spinner with current phase label.
3. Recommended phase labels include `calling model`, `parsing`, and `embedding`.
4. When worker rows exceed available height, show `(+N more workers)` and keep master progress visible.
5. When workers == 1, worker table is not rendered.

Usage display:

1. Show token usage accumulation when available.
2. Show cost only when reliable; otherwise omit or label as estimate.
3. In mock mode, show `usage not applicable` or omit usage fields.
4. Unknown or unstable usage and cost values must be labeled as estimates or omitted.

Interrupt behavior:

1. `Ctrl+C` triggers graceful stop.
2. Stop dispatching new trials.
3. Allow in-flight workers to finish.
4. Write partial artifacts.
5. Continue to Stage 3 with UI stop reason `Stopped: user requested graceful stop`.
6. Artifact stop-reason code may use internal code values such as `user_cancel`.

Termination paths:

1. novelty saturation heuristic threshold met,
2. `K_max` reached,
3. user requested graceful stop,
4. run failed.

## Stage 3: Receipt and Exit

Stage 3 is static output followed by automatic process exit.

No next-action menu.

Stage 3 renders below the final Stage 2 snapshot in the run path.

Receipt must remain visible after exit via normal terminal scrollback. Teardown must not clear stacked output from scrollback.

Receipt content:

1. completion banner line:
   - `Stopped: novelty saturation`
   - `Stopped: max trials reached`
   - `Stopped: user requested graceful stop`
   - `Stopped: sampling complete`
   - `Stopped: run failed`
2. research-honest hint directly below banner:
   - stopping indicates diminishing novelty, not correctness.
3. receipt summary section:
   - stop reason
   - planned, completed, and eligible counts
   - duration
   - token usage
   - protocol summary
   - model and persona counts
4. optional embedding groups summary with caveat shown only when embedding group output is present.
5. artifact list showing only files that exist.
6. reproducibility command:
   - `arbiter run --config <path>`

Receipt artifact-note behavior:

1. If embeddings are absent because there are zero eligible trials, show an explicit explanatory note.
2. Absence in this case must not be presented as an execution error.

Exit codes:

1. success paths exit `0`.
2. non-zero only for true run failure.

## Non-Goals

1. No transcript or chat UX in wizard flow.
2. No slash-command interaction during setup.
3. No post-receipt action hub.
4. No claims of correctness or semantic truth from grouping or stopping.
5. No profiles or templates concept in wizard UX; only `Run existing config` or `Create new study (guided wizard)`.

## Acceptance Criteria

1. Step order is fixed:
   - Welcome
   - Question
   - Protocol
   - Models
   - Personas
   - Decode
   - Advanced
   - Review
2. Existing-config path skips to Review with selected config context.
3. Disabled options are visible but not selectable:
   - `Run existing config` when no config files are discovered
   - `Live` mode when API key is missing
4. Keybinding contract works:
   - `Space` toggles checkboxes
   - `Enter` confirms controls and Next where applicable
   - `Esc` provides Back where allowed
   - Step 1 multiline submit follows defined multiline contract
5. Config discovery uses the specified filename contract in CWD.
6. Models and personas require at least one selection.
7. Baseline model and persona sampling semantics are uniform unless weights UI is explicitly introduced.
8. Debate trial output equals final slot `A` turn.
9. Parse and embed semantics for Debate apply to final slot `A` output only.
10. Intermediate debate turns are persisted for auditability in `trials.jsonl` `transcript` records.
11. Decode supports numeric single-value or range temperature modes.
12. Review writes config only on Run or Save.
13. Save never overwrites existing config filenames.
14. Existing-config Run now does not rewrite the selected source config.
15. Stage 2 hides worker table when workers equals 1.
16. Stage 2 worker table uses defined status values and fallback activity indicators.
17. `Ctrl+C` in Stage 2 triggers graceful stop and still produces Stage 3 receipt.
18. Stage 3 prints receipt, preserves scrollback visibility, and exits automatically with no next-action menu.
19. Headless CLI remains functional and canonical.
20. `Revise` deterministically returns to Step 1 with preserved state for both entry paths.
21. `Save config and exit` never blocks on OpenRouter connectivity.
22. Embedding-group caveat appears whenever embedding groups are displayed, and is absent otherwise.
23. ETA may be unknown and shown as `—`; UI must not fabricate precision.
24. `arbiter init` never overwrites existing configs.
25. `arbiter` launches wizard in TTY and prints help with exit code `0` in non-TTY.
26. `arbiter run --config <file> --dashboard` renders dashboard in TTY and warns then continues headless in non-TTY.
27. CLI help exposes no legacy flags (`--headless`, `--verbose`) and no extra primary commands beyond `arbiter`, `arbiter init`, and `arbiter run`.
28. Stage 0 header remains visible throughout Stage 1-3 in the `Run now` path and is persisted once at the top of the durable transcript.
29. After `Run now`, Stage 1 remains visible only as a frozen summary (no editable step bodies).
30. Stage 2 final snapshot remains visible above Stage 3 receipt until auto-exit.
31. Scrollback after exit preserves the stacked run-path output order: Stage 0 status strip, Stage 1 frozen summary, Stage 2 final snapshot, Stage 3 receipt.

## Deliverables

1. Strict linear Wizard TUI per this spec.
2. Headless command surface preserved.
3. Evidence bundle with step captures and flow validation notes.
