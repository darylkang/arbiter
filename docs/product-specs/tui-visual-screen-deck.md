# Arbiter TUI Visual Screen Deck

Status: accepted implementation target
Owner: Arbiter
Last updated: 2026-03-05

## Scope and Precedence

Precedence order for TUI implementation:

1. `docs/product-specs/tui-wizard.md` (behavior and interaction semantics),
2. `docs/product-specs/tui-copy-deck.md` (LOCKED/FLEX copy contract),
3. this visual screen deck (visual layout contract),
4. `docs/exec-plans/2026-03-04-premium-visual-reboot.md` (execution and validation workflow).

When this visual deck conflicts with behavior semantics, behavior semantics win.
When this visual deck conflicts with LOCKED copy, LOCKED copy wins.

## Design Intent

Arbiter's TUI reads as a warm instrument panel — information-dense, calm, no visual clutter. Gruvbox dark palette provides warmth. Amber highlights active elements; teal marks structural chrome. Content occupies center stage; decoration is absent. When making judgment calls not covered by this spec, choose the option that looks more like laboratory equipment and less like a consumer app.

Never implement: box-bordered cards (`╭──╮`/`╰──╯`), bracket-wrapped progress bars (`[███░]`), `[x]`/`[ ]` checkboxes, split-pane layouts, rainbow or decorative color, CRT/blink effects.

## Screen Management

### Screen Buffers

Stage 1 (wizard) renders in the **alternate screen buffer** (`\x1b[?1049h`). This keeps interactive editing out of terminal scrollback.

On `Run now`:

1. Disable alt-screen (`\x1b[?1049l`).
2. Write frozen rail summary to normal screen buffer.
3. Stage 2 and Stage 3 render in normal screen. Scrollback is preserved.

Scrollback after exit shows: frozen rail → Stage 2 final → Stage 3 receipt. Stage 1 interactive editing is NOT preserved in scrollback.

`arbiter run --dashboard` never enters alt-screen. Stage 2 and Stage 3 render directly in normal screen.

### Render Loop

**Stage 1**: Full-frame clear-and-redraw on each interaction.

1. Clear: `\x1b[2J\x1b[H` (clear all + cursor home).
2. Render: status strip → separator → content (brand block or rail) → separator → footer.
3. Triggered by: each keypress that changes state.

**Stage 2**: In-place update via cursor movement.

1. Count rendered lines of previous frame.
2. Move cursor up: `\x1b[{lineCount}A`.
3. Clear from cursor: `\x1b[J`.
4. Write new frame.
5. Animation timer: 120ms interval for worker state and progress updates (see Activity Indicator section).
6. Substantive re-render on: `trial.completed`, `worker.status`, `monitoring.record`, `batch.completed`.

**Stage 3**: Single static write, then process exit.

### Resize

Terminal resize triggers re-render at new dimensions. No special handling — rail is width-agnostic, progress bars scale via formula, separators refill to terminal width. Minimum supported width: 60 columns.

## Visual Grammar

### Color Palette

**256-color (target tier):**

| Role | Hex | Code | Escape | `fmt.ts` method |
|------|-----|------|--------|-----------------|
| `fg.primary` | `#ebdbb2` | 223 | `\x1b[38;5;223m` | `text()` |
| `fg.muted` | `#928374` | 245 | `\x1b[38;5;245m` | `muted()` |
| `accent.primary` | `#fabd2f` | 214 | `\x1b[38;5;214m` | `brand()` |
| `accent.secondary` | `#83a598` | 109 | `\x1b[38;5;109m` | `accent()` — **change from 208** |
| `status.success` | `#b8bb26` | 142 | `\x1b[38;5;142m` | `success()` |
| `status.warn` | `#d79921` | 172 | `\x1b[38;5;172m` | `warn()` — **change from 214** |
| `status.error` | `#fb4934` | 167 | `\x1b[38;5;167m` | `error()` |

Bold: `\x1b[1m`. Reset: `\x1b[0m`.

**16-color fallback:**

| Role | ANSI | `fmt.ts` change |
|------|------|-----------------|
| `accent.primary` | `\x1b[93m` bright yellow | no change |
| `accent.secondary` | `\x1b[36m` cyan | **change `accent` from `\x1b[33m`** |
| `status.warn` | `\x1b[33m` yellow | no change |
| Others | standard mapping | no change |

### Glyph Vocabulary

Each glyph has exactly one semantic role.

| Glyph | Role | Context | Color |
|-------|------|---------|-------|
| `◆` | Active step | Rail | `accent.primary` |
| `◇` | Pending step | Rail | `accent.secondary` |
| `✔` | Completed step | Rail | `accent.primary` |
| `│` | Content indent | Rail | `accent.secondary` |
| `●` | Selected | Single-choice | `accent.primary` |
| `○` | Unselected | Single-choice | `fg.muted` |
| `■` | Selected | Multi-choice | `accent.primary` |
| `□` | Unselected | Multi-choice | `fg.muted` |
| `▸` | Focus cursor | Actionable row | `accent.primary` |
| `✓` | Passed | Preflight | `status.success` |
| `⚠` | Warning/skip | Preflight | `status.warn` |
| `✗` | Failed | Preflight | `status.error` |
| `█` | Fill | Progress bar | varies by context |
| `░` | Empty | Progress bar | `fg.muted` |
| `─` | Rule | Separators | `accent.secondary` |
| `›` | Prompt | Status strip | `accent.primary` |

### Progress Bars

Bracketless — no `[` or `]` wrapping.

**Master bar:**

```text
████████████░░░░░░░░░░░░░░░░░░  35%    00:02:12  ETA 00:04:03
```

1. Fill (`█`): `accent.primary`. Empty (`░`): `fg.muted`.
2. Width: `min(30, termWidth - 40)` characters.
3. Percentage: `fg.primary`, 4-char gap after bar.
4. Elapsed: `fg.primary`, format `HH:MM:SS`.
5. ETA: label in `fg.muted`, value in `fg.primary`, format `HH:MM:SS` or `—` when unknown.

**Worker activity bar:**

```text
W1  ░███░░░░░  running  trial 28  gpt-5
```

1. ID (`W{n}`): `fg.primary`, 4-char width.
2. Worker rows are activity indicators, not determinate completion percentages.
3. Fill behavior by state: `running` → animated `accent.primary` pulse, `finishing` → full `accent.secondary` bar, `idle` → muted spinner + `░`, `error` → `status.error`.
4. Bar width: 10 chars (fixed).
5. Column layout:

```text
Col 0    Col 4       Col 16        Col 28    Col 40
W{n}     {bar 10ch}  {state 8ch}   trial {n} {model}
```

### Ruled Sections

Stage 2 and Stage 3 use ruled section headers:

```text
── {LABEL} ─────────────────────────────────────────────────────────────────
```

1. Label: ALL-CAPS, `accent.primary` + bold.
2. Rule chars (`─`): `accent.secondary`.
3. Fill to `min(termWidth, 78)`.

Key-value rows below headers:

1. Key: `fg.muted`, left-aligned, 16-char width.
2. Value: `fg.primary`, left-aligned at column 16.

## App Shell

Every screen uses this three-part frame:

```text
› arbiter  {context}                                                     {time}
───────────────────────────────────────────────────────────────────────────────
{content}
───────────────────────────────────────────────────────────────────────────────
{footer}
```

### Status Strip

```text
› arbiter  setup / models                                                00:13
```

1. `›` in `accent.primary`, `arbiter` in `accent.primary` + bold.
2. Context label in `fg.muted`. Values: `onboarding`, `onboarding / mode`, `setup / question`, `setup / protocol`, `setup / models`, `setup / personas`, `setup / decode`, `setup / advanced`, `setup / review`, `run / monitoring`, `run / receipt`.
3. Elapsed time in `fg.muted`, right-aligned, format `MM:SS` (or `HH:MM:SS` when ≥ 1 hour).

### Separator

Full terminal width `─` in `accent.secondary`.

### Command Footer

```text
↑/↓ move · Space toggle · Enter confirm · Esc back
```

Key names in `fg.primary`. Actions and `·` separators in `fg.muted`. Footer adapts per step (see copy deck for exact strings).

### Brand Block

Rendered on **all Stage 1 steps**. Not repeated on Stage 2 or Stage 3.

```text
A R B I T E R                                          v0.1.0
Distributional reasoning harness

API key:    detected
Run mode:   —
Configs:    0 in current directory
```

1. Brand: letter-spaced, `accent.primary` + bold. Version: `fg.muted`, right-aligned.
2. Tagline: `fg.muted`.
3. Status keys: `fg.muted`, 12-char width. Values: `fg.primary` (or `status.warn` if `not detected`).

## Inline Rail

The inline rail is the core composition primitive for Stage 1. All wizard steps render as a single continuous vertical document where content expands under the active step marker.

### Step States

| State | Glyph | Label color | Content |
|-------|-------|-------------|---------|
| Completed | `✔` (`accent.primary`) | `fg.primary` | Summary in `fg.muted` at column 22 |
| Active | `◆` (`accent.primary`) | `accent.primary` + bold | Content region below, indented by `│` |
| Pending | `◇` (`accent.secondary`) | `fg.muted` | None |

### Rendering Algorithm

```text
for each step in steps:
  if COMPLETED:
    emit "✔  {label}           {summary}"
    //  ✔ accent.primary | label fg.primary | summary fg.muted | align at col 22

  if ACTIVE:
    emit "◆  {label}"              // ◆ accent.primary | label accent.primary+bold
    emit "│"                       // breathing line, │ accent.secondary
    for each line in content:
      emit "│   {line}"            // │ accent.secondary, 3-space indent
    emit "│"                       // breathing line

  if PENDING:
    emit "◇  {label}"             // ◇ accent.secondary | label fg.muted
```

Constants: `SUMMARY_COLUMN = 22`, `CONTENT_INDENT = 4` (1 `│` + 3 spaces), `GLYPH_INDENT = 0`.

### Content Region

1. Content appears between `│` breathing lines, indented 4 chars from left margin.
2. Content includes: helper text, selection lists, input fields, validation messages, warnings.
3. Selection glyphs (`●/○`, `■/□`, `▸`) render inside the content region.
4. Only one step is ACTIVE at a time.
5. Long text wraps at word boundaries within `termWidth - CONTENT_INDENT`.
6. Validation errors render inline in the content region, colored `status.error`.

### Rail Items and Step Mapping

The rail has 9 visual items, mapped to 8 wizard steps:

| Rail item | Step | Notes |
|-----------|------|-------|
| Entry Path | Step 0, phase 1 | |
| Run Mode | Step 0, phase 2 | Hidden until Entry Path completes |
| Research Question | Step 1 | |
| Protocol | Step 2 | |
| Models | Step 3 | |
| Personas | Step 4 | |
| Decode Params | Step 5 | |
| Advanced Settings | Step 6 | |
| Review and Confirm | Step 7 | |

When Entry Path is active, Run Mode is not yet shown in the rail (8 visible items). Once Entry Path completes, Run Mode appears and becomes active (9 visible items). All subsequent states show 9 items.

### State Transitions

Step state is determined by position relative to `currentStepIndex`:

```text
step.index < currentStepIndex  →  COMPLETED  (shows summary)
step.index == currentStepIndex →  ACTIVE     (shows content region)
step.index > currentStepIndex  →  PENDING    (no content)
```

**Advance** (Enter confirms step N):

1. Step N: ACTIVE → COMPLETED. Summary generated from step data (see copy deck Rail confirmation patterns).
2. Step N+1: PENDING → ACTIVE. Content region expands.

**Back** (Esc on step N, N > 0):

1. Step N: ACTIVE → PENDING. Content region collapses.
2. Step N-1: COMPLETED → ACTIVE. Summary removed, content region re-expands.
3. All step data is preserved in memory. Only visual state changes.

**Freeze** (Run now selected on Step 7):

1. All steps: → COMPLETED. All summaries shown.
2. Written to normal screen buffer (exit alt-screen first).
3. Rail renders in `fg.muted` (all glyphs, labels, summaries) to visually subordinate to active Stage 2/3 content.

**Existing-config jump** (Step 0 Entry Path → `Run existing config`):

1. After both Entry Path and Run Mode are completed, jump directly to Step 7.
2. Steps 1-6 are shown as COMPLETED with summaries derived from the loaded config file.
3. User may select `Revise` from Step 7 → goes back to Step 1 with all data preserved.

### Frozen Rail

When `Run now` is selected, the rail freezes (all `✔`) and remains in terminal scrollback.

```text
✔  Entry Path           Create new study
✔  Run Mode             Mock
✔  Research Question    "What is the effect of..." (72 chars)
✔  Protocol             Independent
✔  Models               gpt-5, gpt-4.1-mini (2 selected)
✔  Personas             neutral_analyst, skeptical_reviewer (2 selected)
✔  Decode Params        temp 0.70, seed random
✔  Advanced Settings    defaults
```

During Stage 1 (wizard active): completed steps use normal coloring (`✔` accent.primary, label fg.primary, summary fg.muted).

During Stage 2 and Stage 3: all frozen rail text renders in `fg.muted` to subordinate it visually to the active content below.

Existing-config variant: `✔  Entry Path           Run existing config (arbiter.config.json)`.

## Stage 1 Screen Deck

### Step 0: Entry Path

```text
› arbiter  onboarding                                                    00:09
───────────────────────────────────────────────────────────────────────────────

A R B I T E R                                          v0.1.0
Distributional reasoning harness

API key:    detected
Run mode:   —
Configs:    0 in current directory

◆  Entry Path
│
│   Choose how to start
│
│   ▸ ● Create new study (guided wizard)
│     ○ Run existing config (unavailable)
│
│   Run existing config is unavailable:
│   no config files found in this directory.
│
◇  Research Question
◇  Protocol
◇  Models
◇  Personas
◇  Decode Params
◇  Advanced Settings
◇  Review and Confirm

───────────────────────────────────────────────────────────────────────────────
↑/↓ move · Enter select · Esc back
```

### Step 0: Run Mode

```text
› arbiter  onboarding / mode                                             00:10
───────────────────────────────────────────────────────────────────────────────

✔  Entry Path           Create new study

◆  Run Mode
│
│   Choose run mode
│
│   ▸ ● Mock (no API calls)
│     ○ Live (OpenRouter) (unavailable)
│
│   Live mode is unavailable:
│   OPENROUTER_API_KEY not detected.
│
◇  Research Question
◇  Protocol
◇  Models
◇  Personas
◇  Decode Params
◇  Advanced Settings
◇  Review and Confirm

───────────────────────────────────────────────────────────────────────────────
↑/↓ move · Enter select · Esc back
```

Brand block remains visible throughout Stage 1 and is not repeated in Stage 2 or Stage 3.

### Step 1: Research Question

```text
› arbiter  setup / question                                              00:11
───────────────────────────────────────────────────────────────────────────────

✔  Entry Path           Create new study
✔  Run Mode             Mock

◆  Research Question
│
│   Include all relevant context. Arbiter samples responses
│   to characterize distributional behavior.
│
│   Question
│   {multiline input area}
│
◇  Protocol
◇  Models
◇  Personas
◇  Decode Params
◇  Advanced Settings
◇  Review and Confirm

───────────────────────────────────────────────────────────────────────────────
Enter continue · Esc back
```

### Step 1: Validation Error

When the input is empty and user presses Enter:

```text
◆  Research Question
│
│   Include all relevant context. Arbiter samples responses
│   to characterize distributional behavior.
│
│   Question
│   {empty input}
│
│   Fix required: enter a research question to continue.
│
```

Validation error text renders in `status.error`.

### Step 2: Protocol

```text
› arbiter  setup / protocol                                              00:12
───────────────────────────────────────────────────────────────────────────────

✔  Entry Path           Create new study
✔  Run Mode             Mock
✔  Research Question    "What is the effect of..." (42 chars)

◆  Protocol
│
│   Select how each trial is structured.
│
│   ▸ ● Independent
│     ○ Debate
│
◇  Models
◇  Personas
◇  Decode Params
◇  Advanced Settings
◇  Review and Confirm

───────────────────────────────────────────────────────────────────────────────
↑/↓ move · Enter select · Esc back
```

### Step 3: Models

```text
› arbiter  setup / models                                                00:13
───────────────────────────────────────────────────────────────────────────────

✔  Entry Path           Create new study
✔  Run Mode             Mock
✔  Research Question    "What is the effect of..." (42 chars)
✔  Protocol             Independent

◆  Models
│
│   Select one or more models for sampling.
│
│   ▸ ■ openai/gpt-5                [paid] [stable]
│     □ anthropic/claude-sonnet-4    [paid]
│     ■ openai/gpt-4.1-mini         [paid] [fast]
│     □ google/gemini-2.0-flash      [free]
│
│   Warning: free-tier models selected. Availability may be
│   limited. Use paid models for publishable research.
│
◇  Personas
◇  Decode Params
◇  Advanced Settings
◇  Review and Confirm

───────────────────────────────────────────────────────────────────────────────
↑/↓ move · Space toggle · Enter confirm · Esc back
```

### Step 4: Personas

```text
› arbiter  setup / personas                                              00:13
───────────────────────────────────────────────────────────────────────────────

✔  Entry Path           Create new study
✔  Run Mode             Mock
✔  Research Question    "What is the effect of..." (42 chars)
✔  Protocol             Independent
✔  Models               gpt-5, gpt-4.1-mini (2 selected)

◆  Personas
│
│   Select one or more personas for sampling.
│
│   ▸ ■ neutral_analyst
│     ■ skeptical_reviewer
│     □ policy_formalist
│
◇  Decode Params
◇  Advanced Settings
◇  Review and Confirm

───────────────────────────────────────────────────────────────────────────────
↑/↓ move · Space toggle · Enter confirm · Esc back
```

### Step 5: Decode Params

```text
› arbiter  setup / decode                                                00:14
───────────────────────────────────────────────────────────────────────────────

✔  Entry Path           Create new study
✔  Run Mode             Mock
✔  Research Question    "What is the effect of..." (42 chars)
✔  Protocol             Independent
✔  Models               gpt-5, gpt-4.1-mini (2 selected)
✔  Personas             neutral_analyst, skeptical_reviewer (2 selected)

◆  Decode Params
│
│   Set temperature and seed behavior for trial sampling.
│
│   Temperature mode
│   ▸ ● Single value
│     ○ Range (uniform)
│
│   Temperature: 0.70
│
│   Seed mode
│   ● Random  ○ Fixed seed
│
◇  Advanced Settings
◇  Review and Confirm

───────────────────────────────────────────────────────────────────────────────
↑/↓ move · Enter confirm · Esc back
```

### Step 6: Advanced Settings

```text
› arbiter  setup / advanced                                              00:15
───────────────────────────────────────────────────────────────────────────────

✔  Entry Path           Create new study
✔  Run Mode             Mock
✔  Research Question    "What is the effect of..." (42 chars)
✔  Protocol             Independent
✔  Models               gpt-5, gpt-4.1-mini (2 selected)
✔  Personas             neutral_analyst, skeptical_reviewer (2 selected)
✔  Decode Params        temp 0.70, seed random

◆  Advanced Settings
│
│   Use defaults or customize execution and stopping settings.
│
│   ▸ ● Use defaults (recommended)
│     ○ Customize
│
◇  Review and Confirm

───────────────────────────────────────────────────────────────────────────────
↑/↓ move · Enter select · Esc back
```

### Step 7: Review and Confirm

```text
› arbiter  setup / review                                                00:16
───────────────────────────────────────────────────────────────────────────────

✔  Entry Path           Create new study
✔  Run Mode             Mock
✔  Research Question    "What is the effect of..." (42 chars)
✔  Protocol             Independent
✔  Models               gpt-5, gpt-4.1-mini (2 selected)
✔  Personas             neutral_analyst, skeptical_reviewer (2 selected)
✔  Decode Params        temp 0.70, seed random
✔  Advanced Settings    defaults

◆  Review and Confirm
│
│   Preflight
│   ✓ Schema validation
│   ✓ Output path writable
│   ⚠ Live connectivity check (skipped in Mock mode)
│
│   ▸ ● Run now
│     ○ Save config and exit
│     ○ Revise
│     ○ Quit without saving
│

───────────────────────────────────────────────────────────────────────────────
↑/↓ move · Enter select · Esc back
```

### Existing-Config Path: Step 7

When the user chose `Run existing config` at Step 0, intermediate steps are completed with summaries derived from the config:

```text
› arbiter  setup / review                                                00:11
───────────────────────────────────────────────────────────────────────────────

✔  Entry Path           Run existing config (arbiter.config.json)
✔  Run Mode             Live
✔  Research Question    "Compare reasoning approaches..." (48 chars)
✔  Protocol             Debate (2P, 1R)
✔  Models               gpt-5, claude-sonnet-4 (2 selected)
✔  Personas             neutral_analyst (1 selected)
✔  Decode Params        temp 0.70, seed random
✔  Advanced Settings    workers 4, K_max 120

◆  Review and Confirm
│
│   Preflight
│   ✓ Schema validation
│   ✓ Output path writable
│   ✓ Live connectivity check
│
│   ▸ ● Run now
│     ○ Save config and exit
│     ○ Revise
│     ○ Quit without saving
│

───────────────────────────────────────────────────────────────────────────────
↑/↓ move · Enter select · Esc back
```

## Stage 2: Run Dashboard

### Composition

Stage 2 replaces Stage 1's interactive content with ruled sections. The frozen rail summary (all `✔`, in `fg.muted`) appears above in scrollback.

Status strip context: `run / monitoring`. Footer: `Ctrl+C graceful stop`.

Three ruled sections:

1. `── PROGRESS ──` — trial counts, master progress bar.
2. `── MONITORING ──` — novelty rate, patience, status, caveat.
3. `── WORKERS ──` — per-worker activity rows. Omitted when workers == 1.

### In-Place Update

Stage 2 re-renders its entire content region in place:

1. Count lines in previous rendered frame.
2. Cursor up by line count: `\x1b[{n}A`.
3. Clear to end of screen: `\x1b[J`.
4. Write new frame.

The frozen rail summary above is NOT re-rendered. It was written to scrollback before Stage 2 began. Only the Stage 2 content region is rewritten on each update.

### Mid-Run Screen Target

```text
› arbiter  run / monitoring                                              00:19
───────────────────────────────────────────────────────────────────────────────

✔  Entry Path           Create new study
✔  Run Mode             Mock
✔  Research Question    "What is the effect of..." (72 chars)
✔  Protocol             Independent
✔  Models               gpt-5, gpt-4.1-mini (2 selected)
✔  Personas             neutral_analyst, skeptical_reviewer (2 selected)
✔  Decode Params        temp 0.70, seed random
✔  Advanced Settings    defaults

── PROGRESS ────────────────────────────────────────────────────────────────

Trials: 28/80 · Workers: 3
████████████░░░░░░░░░░░░░░░░░░  35%    00:02:12  ETA 00:04:03

── MONITORING ──────────────────────────────────────────────────────────────

Novelty rate    0.18 (threshold 0.05)
Patience        2/4
Status          sampling continues

Stopping indicates diminishing novelty, not correctness.

── WORKERS ─────────────────────────────────────────────────────────────────

W1  ░███░░░░░  running   trial 28  gpt-5
W2  ⠋░░░░░░░░░  idle      trial 19  gpt-4.1-mini
W3  ░░███░░░░  running   trial 27  gpt-5

───────────────────────────────────────────────────────────────────────────────
Ctrl+C graceful stop
```

Frozen rail renders in `fg.muted` during Stage 2.

### Worker Rendering

1. One row per visible worker (column layout defined in Visual Grammar → Progress Bars).
2. When workers exceed available terminal height: show top N, then `(+{hidden} more workers)`.
3. When workers == 1: `── WORKERS ──` section is omitted entirely.
4. Worker bar fill color is semantic by state (running=amber, finishing=teal, idle=muted, error=red).

### Graceful Stop

When user presses Ctrl+C during a run:

```text
── PROGRESS ────────────────────────────────────────────────────────────────

Trials: 28/80 · Workers: 3
████████████░░░░░░░░░░░░░░░░░░  35%    00:02:12  ETA —

Graceful stop requested. Finishing in-flight trials and writing partial artifacts.
```

ETA changes to `—`. Graceful stop message appears. Monitoring and workers sections may be collapsed.

### Dashboard-Only Mode

`arbiter run --dashboard` renders Stage 2 and Stage 3 without brand block or frozen rail. Status strip still appears.

### Stage 2 Sentinel

Entry sentinel: `── PROGRESS ──`. PTY tests match with prefix check: any line starting with `── PROGRESS `.

## Stage 3: Receipt

### Composition

Receipt renders below Stage 2's final snapshot (progress at 100%). Five ruled sections:

1. `── RECEIPT ──` — stop banner and interpretation hint.
2. `── SUMMARY ──` — key-value run summary.
3. `── GROUPS ──` — conditional, only when group data exists.
4. `── ARTIFACTS ──` — file list.
5. `── REPRODUCE ──` — rerun command.

### Screen Target

```text
› arbiter  run / receipt                                                 00:25
───────────────────────────────────────────────────────────────────────────────

[frozen rail summary — all ✔, in fg.muted]
[final Stage 2 snapshot — progress at 100%]

── RECEIPT ─────────────────────────────────────────────────────────────────

Stopped: novelty saturation
Stopping indicates diminishing novelty, not correctness.

── SUMMARY ─────────────────────────────────────────────────────────────────

Stop reason     novelty saturation
Trials          80 / 80 / 76 (planned / completed / eligible)
Duration        00:05:47
Usage           122k tokens (est.)
Protocol        Independent
Models          gpt-5, gpt-4.1-mini
Personas        neutral_analyst, skeptical_reviewer

── ARTIFACTS ───────────────────────────────────────────────────────────────

config.source.json    config.resolved.json    manifest.json
trials.jsonl          monitoring.jsonl         receipt.txt

── REPRODUCE ───────────────────────────────────────────────────────────────

arbiter run --config ./arbiter.config.json

───────────────────────────────────────────────────────────────────────────────
Run complete.
```

`Run complete.` in `fg.muted`. Repro command in `fg.primary`.

### Groups (Conditional)

```text
── GROUPS ──────────────────────────────────────────────────────────────────

Top group sizes
12, 8, 6, 4, 3

Groups reflect embedding similarity, not semantic categories.
```

Rendered only when embedding group data exists. Caveat in `fg.muted`.

### Artifacts

1. Three per row when width allows, single column at narrow widths.
2. Only list files that actually exist in the output directory.
3. If no embeddings due to zero eligible trials: `No embeddings were generated because there were zero eligible trials.`

### Stage 3 Sentinel

Entry sentinel: `── RECEIPT ──`. PTY tests match with prefix check: any line starting with `── RECEIPT `.

## Width Behavior

The inline rail is width-agnostic. One rendering path for all widths.

1. Rail, labels, and content flow as a single column.
2. Long text wraps at word boundaries within content region.
3. Status strip context labels may truncate at narrow widths.
4. Master progress bar scales: `min(30, termWidth - 40)`.
5. Worker bars: fixed 10 chars.
6. Key-value alignment: fixed 16-char key width.
7. LOCKED copy wraps, never clips.
8. Minimum supported width: 60 columns.

## Sentinels and Test Contracts

### Sentinel Values

| Sentinel | Purpose | Replaces |
|----------|---------|----------|
| `── PROGRESS ──` | Stage 2 start | `═══ RUN ═══` |
| `── RECEIPT ──` | Stage 3 start | `═══ RECEIPT ═══` |

### Atomic Update Rule

When sentinel values change, ALL of these must be updated in one commit:

1. `docs/product-specs/tui-copy-deck.md` — LOCKED values.
2. `test/e2e/tui-pty.test.mjs` — assertion strings.
3. `scripts/tui-visual-capture.mjs` — wait targets.
4. `src/ui/run-lifecycle-hooks.ts` — sentinel strings.
5. `src/ui/copy.ts` — `UI_COPY.runHeader` and `UI_COPY.receiptHeader`.
6. This screen deck.

### Testable Assertions

PTY tests should verify these strings and ordering:

```text
Stage 1 entry:
  waitForText("A R B I T E R")           // brand block on Step 0
  waitForText("Choose how to start")      // entry path prompt

Stage 1 progression:
  waitForText("✔  Entry Path")            // completed step in rail
  waitForText("◆  Research Question")     // active step marker

Stage 2 entry:
  waitForText("── PROGRESS")              // sentinel (prefix match)
  waitForText("Trials:")                  // progress summary line

Stage 3 entry:
  waitForText("── RECEIPT")               // sentinel (prefix match)
  waitForText("Stopped:")                 // completion banner

Scrollback ordering (assert indexOf A < indexOf B):
  "✔  Entry Path"  <  "── PROGRESS"
  "── PROGRESS"    <  "── RECEIPT"
  "── RECEIPT"     <  "Run complete."
```

## Implementation Guide

### Rendering Primitives

Add to `src/ui/wizard-theme.ts` (or new `src/ui/rail-renderer.ts`):

```typescript
import type { Formatter } from "./fmt.js";

// --- Types ---

type RailStepState = "completed" | "active" | "pending";

type RailStep = {
  label: string;
  state: RailStepState;
  summary?: string;        // required when state == "completed"
  contentLines?: string[]; // required when state == "active"
};

type WorkerRow = {
  id: number;
  pct: number;
  state: "running" | "idle" | "finishing" | "error";
  trialId: number;
  model: string;
};

// --- Constants ---

const SUMMARY_COLUMN = 22;
const CONTENT_INDENT = 4;    // "│   "
const KV_KEY_WIDTH = 16;
const MASTER_BAR_MAX = 30;
const WORKER_BAR_WIDTH = 10;

// --- Functions ---

/** One rail step line. Returns string (no trailing newline). */
function renderRailStep(
  step: RailStep,
  fmt: Formatter,
  dimmed?: boolean
): string;

/** Content lines with │-indent and breathing lines. Returns multi-line string. */
function renderRailContent(lines: string[], fmt: Formatter): string;

/** ── LABEL ────── ruled header. Returns string. */
function renderRuledSection(
  label: string,
  width: number,
  fmt: Formatter
): string;

/** Bracketless progress bar. Returns string. */
function renderProgressBar(
  pct: number,
  width: number,
  fillColor: (s: string) => string,
  fmt: Formatter
): string;

/** Letter-spaced brand block with status rows. Returns multi-line string. */
function renderBrandBlock(
  version: string,
  apiKeyPresent: boolean,
  runMode: string | null,
  configCount: number,
  fmt: Formatter
): string;

/** › arbiter  {context}  {time} top line. Returns string. */
function renderStatusStrip(
  context: string,
  elapsedMs: number,
  width: number,
  fmt: Formatter
): string;

/** Key-value pair with fixed key width. Returns string. */
function renderKV(
  key: string,
  value: string,
  fmt: Formatter,
  keyWidth?: number
): string;

/** One worker activity row. Returns string. */
function renderWorkerRow(worker: WorkerRow, fmt: Formatter): string;

/** Full-width separator line. Returns string. */
function renderSeparator(width: number, fmt: Formatter): string;
```

### Rail Step Conversion

Convert existing `StepFrame` data to `RailStep[]`:

```typescript
const RAIL_ITEMS: Array<{ label: string; stepIndex: number }> = [
  { label: "Entry Path",        stepIndex: 0 },
  { label: "Run Mode",          stepIndex: 0 },  // Step 0 phase 2
  { label: "Research Question", stepIndex: 1 },
  { label: "Protocol",          stepIndex: 2 },
  { label: "Models",            stepIndex: 3 },
  { label: "Personas",          stepIndex: 4 },
  { label: "Decode Params",     stepIndex: 5 },
  { label: "Advanced Settings", stepIndex: 6 },
  { label: "Review and Confirm",stepIndex: 7 },
];

// Rail item indices (not step indices) for the two Step 0 phases.
const ENTRY_PATH_RAIL = 0;
const RUN_MODE_RAIL = 1;

function toRailSteps(
  currentRailIndex: number,  // index into RAIL_ITEMS (0-8), NOT step index
  railSummaries: Map<number, string>,  // keyed by rail index
  activeContent: string[],
  showRunMode: boolean  // false until Entry Path completes
): RailStep[] {
  return RAIL_ITEMS
    .filter((item, railIdx) => {
      if (railIdx === RUN_MODE_RAIL && !showRunMode) return false;
      return true;
    })
    .map((item) => {
      // Use the original rail index from RAIL_ITEMS for state comparison,
      // NOT the filtered array index.
      const originalIdx = RAIL_ITEMS.indexOf(item);
      const state: RailStepState =
        originalIdx < currentRailIndex ? "completed" :
        originalIdx === currentRailIndex ? "active" :
        "pending";
      return {
        label: item.label,
        state,
        summary: state === "completed" ? railSummaries.get(originalIdx) : undefined,
        contentLines: state === "active" ? activeContent : undefined,
      };
    });
}
```

**Important**: `currentRailIndex` is an index into `RAIL_ITEMS` (0–8), not a wizard step index (0–7). Entry Path = rail 0, Run Mode = rail 1, Research Question = rail 2, etc. The mapping between rail indices and wizard step indices is defined in the `RAIL_ITEMS` array above.

Summary strings for each rail item are defined by the copy deck's Rail confirmation patterns.

### Return-Type Contract

All rendering functions return a string. Strings include internal newlines but **no trailing newline**. The caller joins fragments with `\n` and writes to stdout in a single `process.stdout.write()` call.

```typescript
// Composition example (Stage 1):
const parts: string[] = [];
parts.push(renderStatusStrip(context, elapsed, width, fmt));
parts.push(renderSeparator(width, fmt));
if (isStep0EntryPath) {
  parts.push(renderBrandBlock(version, apiKey, runMode, configCount, fmt));
}
for (const step of railSteps) {
  parts.push(renderRailStep(step, fmt));
  if (step.state === "active" && step.contentLines) {
    parts.push(renderRailContent(step.contentLines, fmt));
  }
}
parts.push(renderSeparator(width, fmt));
parts.push(footerText);
process.stdout.write(parts.join("\n") + "\n");
```

### Stage 2 Composition

`buildRunDashboardText(snapshot, width, fmt)` returns a string containing only the Stage 2 content region — everything between (and including) `── PROGRESS ──` and the footer. It does **not** include the frozen rail or the status strip.

```typescript
function buildRunDashboardText(
  snapshot: DashboardSnapshot,
  width: number,
  fmt: Formatter
): string {
  const parts: string[] = [];

  // Status strip
  parts.push(renderStatusStrip("run / monitoring", snapshot.elapsedMs, width, fmt));
  parts.push(renderSeparator(width, fmt));

  // PROGRESS section
  parts.push(renderRuledSection("PROGRESS", width, fmt));
  parts.push("");  // blank line after rule
  parts.push(`Trials: ${snapshot.completed}/${snapshot.planned} · Workers: ${snapshot.workerCount}`);
  parts.push(renderProgressBar(snapshot.pct, Math.min(30, width - 40), fmt.brand, fmt)
    + `    ${formatElapsed(snapshot.elapsedMs)}  ETA ${formatEta(snapshot.eta)}`);

  // MONITORING section
  parts.push("");
  parts.push(renderRuledSection("MONITORING", width, fmt));
  parts.push("");
  parts.push(renderKV("Novelty rate", `${snapshot.noveltyRate} (threshold ${snapshot.threshold})`, fmt));
  parts.push(renderKV("Patience", `${snapshot.patience}/${snapshot.patienceMax}`, fmt));
  parts.push(renderKV("Status", snapshot.samplingStatus, fmt));
  parts.push("");
  parts.push(fmt.muted("Stopping indicates diminishing novelty, not correctness."));

  // WORKERS section (omit when workerCount == 1)
  if (snapshot.workerCount > 1) {
    parts.push("");
    parts.push(renderRuledSection("WORKERS", width, fmt));
    parts.push("");
    for (const worker of snapshot.workers) {
      parts.push(renderWorkerRow(worker, fmt));
    }
  }

  // Footer
  parts.push("");
  parts.push(renderSeparator(width, fmt));
  parts.push(fmt.muted("Ctrl+C graceful stop"));

  return parts.join("\n");
}
```

**In-place update loop**: The caller stores `previousLineCount`. On each update:

```typescript
// Move cursor up to overwrite previous frame
process.stdout.write(`\x1b[${previousLineCount}A\x1b[J`);
const frame = buildRunDashboardText(snapshot, width, fmt);
process.stdout.write(frame + "\n");
previousLineCount = frame.split("\n").length;
```

### Stage 3 Composition

```typescript
function buildReceiptText(
  result: RunResult,
  width: number,
  fmt: Formatter
): string {
  const parts: string[] = [];

  // Status strip
  parts.push(renderStatusStrip("run / receipt", result.elapsedMs, width, fmt));
  parts.push(renderSeparator(width, fmt));

  // RECEIPT section — stop banner + interpretation hint
  parts.push(renderRuledSection("RECEIPT", width, fmt));
  parts.push("");
  parts.push(`Stopped: ${result.stopReasonLabel}`);
  parts.push(fmt.muted("Stopping indicates diminishing novelty, not correctness."));

  // SUMMARY section — key-value rows
  parts.push("");
  parts.push(renderRuledSection("SUMMARY", width, fmt));
  parts.push("");
  parts.push(renderKV("Stop reason", result.stopReasonLabel, fmt));
  parts.push(renderKV("Trials", `${result.planned} / ${result.completed} / ${result.eligible} (planned / completed / eligible)`, fmt));
  parts.push(renderKV("Duration", formatElapsed(result.elapsedMs), fmt));
  parts.push(renderKV("Usage", result.usageSummary, fmt));
  parts.push(renderKV("Protocol", result.protocolLabel, fmt));
  parts.push(renderKV("Models", result.modelsSummary, fmt));
  parts.push(renderKV("Personas", result.personasSummary, fmt));

  // GROUPS section — conditional
  if (result.groups) {
    parts.push("");
    parts.push(renderRuledSection("GROUPS", width, fmt));
    parts.push("");
    parts.push("Top group sizes");
    parts.push(result.groups.topSizes.join(", "));
    parts.push("");
    parts.push(fmt.muted("Groups reflect embedding similarity, not semantic categories."));
  }

  // ARTIFACTS section
  parts.push("");
  parts.push(renderRuledSection("ARTIFACTS", width, fmt));
  parts.push("");
  // Three per row when width allows, single column at narrow widths
  parts.push(formatArtifactGrid(result.artifacts, width));

  // REPRODUCE section
  parts.push("");
  parts.push(renderRuledSection("REPRODUCE", width, fmt));
  parts.push("");
  parts.push(`arbiter run --config ${result.configPath}`);

  // Footer
  parts.push("");
  parts.push(renderSeparator(width, fmt));
  parts.push(fmt.muted("Run complete."));

  return parts.join("\n");
}
```

### Frozen Rail Render Boundary

The frozen rail is **written once** to the normal screen buffer during the Stage 1 → Stage 2 transition. It is never part of Stage 2's render loop.

Transition sequence:

```typescript
// 1. Exit alt-screen (returns to normal screen buffer)
process.stdout.write("\x1b[?1049l");

// 2. Write frozen rail (one-time, in fg.muted)
const frozenRail = railSteps.map(step =>
  renderRailStep({ ...step, state: "completed" }, fmt, /* dimmed */ true)
).join("\n");
process.stdout.write(frozenRail + "\n\n");

// 3. Start Stage 2 render loop (only content below frozen rail is updated in-place)
previousLineCount = 0;
startDashboardLoop();
```

The in-place update cursor movement (`\x1b[{n}A`) only covers `previousLineCount` lines — the frozen rail sits above and is not touched. It scrolls into terminal scrollback naturally as Stage 2 content accumulates.

### Activity Indicator

The "120ms animation timer" drives **worker state text cycling**, not a spinner glyph. No spinner is rendered. The timer triggers a re-render of the Stage 2 content region, which picks up new worker states (`running`/`idle`/`finishing`/`error`) and progress percentages from the event stream. No additional animation glyphs are needed — the progress bar fill and worker state text provide sufficient visual activity.

If a future version adds a spinner (e.g., `⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏` cycle on idle workers), define it in this section. For v1, the timer is purely functional.

### Dashboard-Only Mode

`arbiter run --dashboard` skips Stage 1 entirely. No alt-screen, no brand block, no frozen rail.

```text
› arbiter  run / monitoring                                              00:19
───────────────────────────────────────────────────────────────────────────────

── PROGRESS ────────────────────────────────────────────────────────────────

Trials: 28/80 · Workers: 3
████████████░░░░░░░░░░░░░░░░░░  35%    00:02:12  ETA 00:04:03

── MONITORING ──────────────────────────────────────────────────────────────

Novelty rate    0.18 (threshold 0.05)
Patience        2/4
Status          sampling continues

Stopping indicates diminishing novelty, not correctness.

── WORKERS ─────────────────────────────────────────────────────────────────

W1  ░███░░░░░  running   trial 28  gpt-5
W2  ⠋░░░░░░░░░  idle      trial 19  gpt-4.1-mini
W3  ░░███░░░░  running   trial 27  gpt-5

───────────────────────────────────────────────────────────────────────────────
Ctrl+C graceful stop
```

Same as the standard Stage 2 wireframe minus the frozen rail above it. `buildRunDashboardText()` produces identical output in both modes — the only difference is whether the frozen rail was written to scrollback before the loop starts.

Receipt renders identically in dashboard-only mode. The receipt composition function does not reference Stage 1 state.

### File Changes

| File | Action |
|------|--------|
| `src/ui/fmt.ts` | Change `accent` 256→109, 16→cyan. Change `warn` 256→172. |
| `src/ui/copy.ts` | Letter-space brand: `"A R B I T E R"`. Update sentinels: `runHeader` → `"── PROGRESS ──"`, `receiptHeader` → `"── RECEIPT ──"`. |
| `src/ui/wizard-theme.ts` | Delete `renderCard()`, `renderMasthead()`, `renderProgressSpine()`. Add primitives above. |
| `src/ui/wizard/app.ts` | Rewrite `renderStepFrame()` to: clearScreen → renderStatusStrip → renderSeparator → persistent Stage 1 brand block → rail loop → renderSeparator → footer. Remove three-block stacking. |
| `src/ui/run-lifecycle-hooks.ts` | Rewrite `buildRunDashboardText()` to use `renderRuledSection()` + `renderKV()`. Bracketless bars. New sentinels. |
| `scripts/tui-visual-capture.mjs` | Update wait strings: `═══ RUN ═══` → `── PROGRESS`, `═══ RECEIPT ═══` → `── RECEIPT`. Update step detection strings. |
| `test/e2e/tui-pty.test.mjs` | Update assertions per Testable Assertions section. |

### Current → New Function Mapping

| Current | Location | Action |
|---------|----------|--------|
| `renderCard(input)` | `wizard-theme.ts` | Delete. Replace call sites with rail content or ruled sections. |
| `renderMasthead(input)` | `wizard-theme.ts` | Delete. Replace with `renderBrandBlock()` (Step 0) + `renderStatusStrip()` (all). |
| `renderProgressSpine(input)` | `wizard-theme.ts` | Delete. Replace with rail loop using `renderRailStep()`. |
| `renderStepFrame(input)` | `wizard/app.ts` | Rewrite. New composition: clearScreen → status strip → separator → persistent Stage 1 brand block → rail loop (with inline content at active step) → separator → footer. |
| `buildRunDashboardText(snapshot)` | `run-lifecycle-hooks.ts` | Rewrite. New: renderRuledSection("PROGRESS") → trial line + master bar → renderRuledSection("MONITORING") → KV rows + caveat → renderRuledSection("WORKERS") → worker rows. |
| receipt builder | `run-lifecycle-hooks.ts` | Rewrite. New: renderRuledSection("RECEIPT") → banner + hint → renderRuledSection("SUMMARY") → KV rows → renderRuledSection("ARTIFACTS") → file list → renderRuledSection("REPRODUCE") → command → `Run complete.` |

### Migration Order

Execute in this order to maintain a working build at each step:

1. **`fmt.ts` palette** — change `accent` and `warn` color codes. Non-breaking: call sites use the same method names.
2. **`copy.ts` constants** — update brand string and sentinel values. Tests will break until step 7.
3. **`wizard-theme.ts` primitives** — add new rendering functions alongside existing ones. Don't delete old functions yet.
4. **`wizard/app.ts` composition** — rewrite `renderStepFrame()` to use new primitives. Delete old functions from wizard-theme after this step compiles.
5. **`run-lifecycle-hooks.ts`** — rewrite dashboard and receipt rendering. Use ruled sections, bracketless bars, new sentinels.
6. **`tui-visual-capture.mjs`** — update wait strings.
7. **`tui-pty.test.mjs`** — update assertions. Tests should pass after this step.

Each step should compile. Steps 2-5 may cause test failures resolved by step 7.
