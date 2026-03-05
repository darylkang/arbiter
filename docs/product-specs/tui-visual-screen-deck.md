# Arbiter TUI Visual Screen Deck

Status: accepted implementation target
Owner: Arbiter
Last updated: 2026-03-05

## Purpose

Define concrete visual layout targets for Arbiter's premium TUI reboot so implementation is not based on abstract style guidance alone.

This document is visual-contract focused:

1. layout grammar,
2. card composition,
3. spacing rhythm,
4. stage-by-stage ASCII wireframes.

Behavior semantics remain owned by `docs/product-specs/tui-wizard.md`.
Canonical text copy remains owned by `docs/product-specs/tui-copy-deck.md`.

## Scope and Precedence

Precedence order for TUI implementation:

1. `docs/product-specs/tui-wizard.md` (behavior and interaction semantics),
2. `docs/product-specs/tui-copy-deck.md` (LOCKED/FLEX copy contract),
3. this visual screen deck (visual layout contract),
4. `docs/exec-plans/2026-03-04-premium-visual-reboot.md` (execution and validation workflow).

When this visual deck conflicts with behavior semantics, behavior semantics win.
When this visual deck conflicts with LOCKED copy, LOCKED copy wins.

## Global Visual Grammar

Visual north star: warm instrument clarity with high compositional confidence.

Global rules:

1. Stage 0 masthead is persistent in run path and never duplicated.
2. Stage 1 shows one active step card at a time plus progress spine.
3. Selecting `Run now` freezes Stage 1 into a Study Summary card.
4. Stage 2 renders below frozen summary and updates in place.
5. Stage 3 appends below final Stage 2 snapshot.
6. One separator rhythm only: either a blank line or a rule, not both.
7. Card body horizontal padding: 2 spaces.
8. Card title style is consistent across all stages.
9. Status colors are semantic only (not decorative).
10. Motion is functional only (spinner + progress updates).
11. Every major screen uses app-shell composition: top status strip, primary content region, command footer.
12. Where tabbed subviews exist, tab chrome is rendered in-line and keyboard discoverability is always shown.
13. Stage 2 always shows one master progress bar plus one progress bar per async worker.

## Premium Signature Contract

These motifs are required for the premium reboot and supersede plain utility styling.

1. Navigation spine is integrated into container borders, not rendered as a separate list card.
2. Stage 1 rail uses timeline semantics:
   - `◆` current section,
   - `◇` non-current section anchors,
   - `│` vertical continuation.
3. Choice controls use glyph selectors:
   - single-choice: `○` unselected, `●` selected,
   - multi-choice: `□` unselected, `■` selected.
4. Primary focus cursor uses `▸` only for current actionable row.
5. Bracket checkbox styling (`[ ]`, `[x]`) is not used in premium mode.
6. Hero lockup must read as deliberate brand treatment (block/glyph title or compact premium caps), not plain one-line label text.
7. Split-pane composition is preferred over stacked utility blocks on wide terminals.
8. Focus regions must be visually explicit (accent edge, active tab, or focused selector row).
9. Command footer must summarize active controls using concise glyph-first hints.
10. Visual language must feel like an application surface, not a raw questionnaire.

## Benchmark Parity Cues (Claude Code / OpenClaw)

These cues are mandatory calibration references for premium quality:

1. left rail is structural, not decorative; it communicates progression and focus.
2. major screens expose clear region boundaries (header block, content block, footer controls).
3. list interactions read like native app controls (radio/toggle glyphs, focus marker, hint footer).
4. dense information is grouped by pane, not dumped as undifferentiated text blocks.
5. keyboard affordances are discoverable at the point of use.

## App-Shell Composition Contract

All stages inherit this shell pattern.

```text
› arbiter  {context}                                                     {time}
───────────────────────────────────────────────────────────────────────────────
[optional hero / identity block]
[optional tabs row]
[primary content region with integrated rail]
───────────────────────────────────────────────────────────────────────────────
{command footer / key hints}
```

Shell rules:

1. top strip is single-line and high-contrast, used for identity + runtime context.
2. middle region owns visual weight: panes, cards, rails, and data blocks.
3. bottom strip is always present and never visually noisy.
4. shell separators use consistent border weight across all stages.

## Color System Contract

Color is mandatory in the final product. The reboot must feel vivid and premium, but still disciplined.

Tier A (truecolor/256-color target palette):

1. `fg.primary`: `#ebdbb2`
2. `fg.muted`: `#a89984`
3. `border.default`: `#665c54`
4. `accent.primary`: `#fabd2f` (active focus, current step, primary progress)
5. `accent.secondary`: `#83a598` (secondary highlights, pane accents)
6. `status.success`: `#b8bb26`
7. `status.warn`: `#d79921`
8. `status.error`: `#fb4934`
9. `status.info`: `#8ec07c`

Tier B (16-color fallback mapping):

1. `accent.primary`: bright yellow
2. `accent.secondary`: cyan
3. `status.success`: green
4. `status.warn`: yellow (bold)
5. `status.error`: red
6. `status.info`: cyan
7. `fg.primary`/`fg.muted` and border tones map to white/bright-black equivalents

Color application rules:

1. active row, current rail marker, and focused value always use `accent.primary`.
2. selected options are colorized; unselected options stay neutral.
3. master progress bar uses `accent.primary`; worker bars use semantic color by worker status.
4. warning, error, and success messages always use semantic status colors.
5. no rainbow styling: max two accent hues per screen plus status colors where semantically required.

## Stage 1 Panel Template (Split-Card Grammar)

This template defines the Stage 1 composition grammar used by all steps on wide terminals.

```text
╭─ {Setup} ─────────────────────────────────────────────┬─────────────────────╮
│ ◆ {current step}                                      │ {active content...} │
│ ◇ {next step}                                         │ {active content...} │
│ ◇ {next step}                                         │                     │
│ ◇ {next step}                                         │                     │
│ ◇ {next step}                                         │                     │
├───────────────────────────────────────────────────────┴─────────────────────┤
│ {validation / warnings}                                                     │
│ {controls hint line}                                                        │
╰──────────────────────────────────────────────────────────────────────────────╯
```

Interpretation:

1. Stage 1 wide layout always uses one outer split-card with an internal divider.
2. left pane is fixed-width rail/timeline; right pane is active step content.
3. footer rows use a single grammar per screen (either integrated footer row or shell footer line), not mixed styles.

## Metadata Badge Contract

Model and status metadata should read like aligned UI rows, not prose blobs.

1. capability/economics tags use compact badges: `[paid]`, `[free]`, `[fast]`, `[stable]`.
2. each list row keeps primary label left and badges/status metadata right-aligned where possible.
3. detailed model slug can appear as muted secondary line only when needed.

## Preflight Checklist Grammar

Preflight rows must use checklist semantics, not navigation glyphs.

1. `✓` passed check,
2. `⚠` skipped or warning check,
3. `✗` failed check.

## Stage 2 Table-Grade Rule

Operational readouts should be aligned as key/value rows or table columns.

1. monitoring block uses aligned key/value rows.
2. workers block uses stable columns (`ID`, `Progress`, `State`, `Trial`, `Model`).
3. avoid prose-style metric lines when table alignment is possible.

## Width Tiers

Tier definitions:

1. Wide: `COLUMNS >= 100`
2. Narrow: `COLUMNS < 100`

Tier behavior:

1. Wide uses one split-card Stage 1 composition (rail left, active content right).
2. Narrow stacks rail above active content.
3. Wide Stage 2 shows monitoring and workers as separate panes with aligned table/key-value readouts.
4. Narrow Stage 2 collapses to one merged operational card when needed.
5. No clipping of LOCKED copy in either tier; wrap at word boundaries.
6. Wide Stage 2 shows one worker progress row per visible worker.
7. Narrow Stage 2 may truncate worker rows by height, but each shown row still includes a worker bar and percent.

## Stage 0 + Stage 1 Screen Deck (Wide)

### Step 0: Entry Path

```text
› arbiter  onboarding                                                      00:09
───────────────────────────────────────────────────────────────────────────────
╭─ Arbiter ───────────────────────────────────────┬───────────────────────────╮
│ Arbiter v{version}                              │ API key: {detected|missing}│
│ Distributional experiment harness               │ Run mode: {—|Mock|Live}   │
│                                                 │ Configs in CWD: {count}    │
╰─────────────────────────────────────────────────┴───────────────────────────╯

╭─ Setup ─────────────────────────────────────────┬───────────────────────────╮
│ ◆ Entry Path                                   │ ▸ ● Create new study      │
│ ◇ Research Question                            │   ○ Run existing config   │
│ ◇ Protocol                                     │     (unavailable)         │
│ ◇ Models                                       │                           │
│ ◇ Personas                                     │ Run existing config is    │
│ ◇ Decode Params                                │ unavailable: no config    │
│ ◇ Advanced Settings                            │ files found in directory. │
│ ◇ Review and Confirm                           │                           │
├─────────────────────────────────────────────────┴───────────────────────────┤
│ ↑/↓ move · Enter select · Esc back                                        │
╰─────────────────────────────────────────────────────────────────────────────╯
───────────────────────────────────────────────────────────────────────────────
```

### Step 0: Run Mode

```text
› arbiter  onboarding / mode                                               00:10
───────────────────────────────────────────────────────────────────────────────
╭─ Setup ─────────────────────────────────────────┬───────────────────────────╮
│ ◆ Run Mode                                     │ Choose run mode           │
│ ◇ Research Question                            │                           │
│ ◇ Protocol                                     │ ▸ ● Mock (no API calls)  │
│ ◇ Models                                       │   ○ Live (OpenRouter)    │
│ ◇ Personas                                     │                           │
│ ◇ Decode Params                                │ Live mode is unavailable: │
│ ◇ Advanced Settings                            │ OPENROUTER_API_KEY not    │
│ ◇ Review and Confirm                           │ detected.                 │
├─────────────────────────────────────────────────┴───────────────────────────┤
│ ↑/↓ move · Enter select · Esc back                                        │
╰─────────────────────────────────────────────────────────────────────────────╯
───────────────────────────────────────────────────────────────────────────────
```

### Step 1: Research Question

```text
› arbiter  setup / question                                                00:11
───────────────────────────────────────────────────────────────────────────────
╭─ Setup ───────────────────────────────────────────────────────────╮
│ ◆ Research Question    │  Question                                          │
│ │ Include all relevant │  {multiline input}                                 │
│ │ context. Arbiter     │                                                    │
│ │ samples responses... │                                                    │
│ ◇ Protocol             │                                                    │
│ ◇ Models               │                                                    │
│ ◇ Personas             │                                                    │
│ ◇ Decode Params        │                                                    │
│ ◇ Advanced Settings    │                                                    │
│ ◇ Review and Confirm   │                                                    │
╰──────────────────────────────────────────────────────────────────────────────╯
───────────────────────────────────────────────────────────────────────────────
Enter continue · Esc back
```

### Step 2: Protocol

```text
› arbiter  setup / protocol                                                00:12
───────────────────────────────────────────────────────────────────────────────
╭─ Setup ───────────────────────────────────────────────────────────╮
│ ◆ Protocol              │  Select how each trial is structured.            │
│ │                       │                                                   │
│ │ ▸ ● Independent       │                                                   │
│ │   ○ Debate            │                                                   │
│ ◇ Models                │                                                   │
│ ◇ Personas              │                                                   │
│ ◇ Decode Params         │                                                   │
│ ◇ Advanced Settings     │                                                   │
│ ◇ Review and Confirm    │                                                   │
╰──────────────────────────────────────────────────────────────────────────────╯
───────────────────────────────────────────────────────────────────────────────
↑/↓ move · Enter select · Esc back
```

### Step 3: Models

```text
› arbiter  setup / models                                                  00:13
───────────────────────────────────────────────────────────────────────────────
╭─ Setup ─────────────────────────────────────────┬───────────────────────────╮
│ ◆ Models                                       │ Models to sample          │
│ ◇ Personas                                     │                           │
│ ◇ Decode Params                                │ Search: {input}          │
│ ◇ Advanced Settings                            │                           │
│ ◇ Review and Confirm                           │ ▸ ■ GPT-5         [paid] │
│                                                │   □ Claude Sonnet  [paid] │
│                                                │   ■ GPT-4.1 mini   [paid] │
│                                                │   □ Gemini Flash   [free] │
├─────────────────────────────────────────────────┴───────────────────────────┤
│ At least one model is required.                                            │
│ Warning: free-tier models are for exploration only.                        │
│ ↑/↓ move · Space toggle · Enter confirm · Esc back                         │
╰─────────────────────────────────────────────────────────────────────────────╯
```

### Step 4: Personas

```text
› arbiter  setup / personas                                                00:13
───────────────────────────────────────────────────────────────────────────────
╭─ Setup ───────────────────────────────────────────────────────────╮
│ ◆ Personas              │  Select one or more personas for sampling.       │
│ │                       │                                                   │
│ │ ▸ ■ neutral_analyst   │                                                   │
│ │   ■ skeptical_reviewer│                                                   │
│ │   □ policy_formalist  │                                                   │
│ ◇ Decode Params         │                                                   │
│ ◇ Advanced Settings     │                                                   │
│ ◇ Review and Confirm    │                                                   │
│                         │                                                   │
│                         │                                                   │
╰──────────────────────────────────────────────────────────────────────────────╯
───────────────────────────────────────────────────────────────────────────────
↑/↓ move · Space toggle · Enter confirm · Esc back
```

### Step 5: Decode Params

```text
› arbiter  setup / decode                                                  00:14
───────────────────────────────────────────────────────────────────────────────
╭─ Setup ───────────────────────────────────────────────────────────╮
│ ◆ Decode Params         │  Temperature mode                                │
│ │ Set temperature and   │  ▸ ● Single value                                │
│ │ seed behavior for     │    ○ Range (uniform)                             │
│ │ trial sampling.       │                                                   │
│ ◇ Advanced Settings     │  Temperature: 0.70                               │
│ ◇ Review and Confirm    │  Seed mode: ● Random  ○ Fixed seed              │
│                         │                                                   │
│                         │                                                   │
╰──────────────────────────────────────────────────────────────────────────────╯
───────────────────────────────────────────────────────────────────────────────
↑/↓ move · Enter confirm · Esc back
```

### Step 6: Advanced Settings

```text
› arbiter  setup / advanced                                                00:15
───────────────────────────────────────────────────────────────────────────────
╭─ Setup ───────────────────────────────────────────────────────────╮
│ ◆ Advanced Settings     │  Use defaults or customize execution and         │
│ │                       │  stopping settings.                              │
│ │ ▸ ● Use defaults      │                                                  │
│ │   ○ Customize         │                                                  │
│ ◇ Review and Confirm    │                                                  │
│                         │                                                  │
│                         │                                                  │
│                         │                                                  │
╰──────────────────────────────────────────────────────────────────────────────╯
───────────────────────────────────────────────────────────────────────────────
↑/↓ move · Enter select · Esc back
```

### Step 7: Review and Confirm

```text
› arbiter  setup / review                                                  00:16
───────────────────────────────────────────────────────────────────────────────
╭─ Setup ─────────────────────────────────────────┬───────────────────────────╮
│ ◆ Review and Confirm                           │ Preflight                 │
│ ◇ Summary                                      │ ✓ Schema validation       │
│                                                │ ✓ Output path writable    │
│                                                │ ⚠ Live connectivity check │
│                                                │   (skipped in Mock mode)  │
│                                                │                           │
│                                                │ ▸ ● Run now               │
│                                                │   ○ Save config and exit  │
│                                                │   ○ Revise                │
│                                                │   ○ Quit without saving   │
├─────────────────────────────────────────────────┴───────────────────────────┤
│ ↑/↓ move · Enter select · Esc back                                         │
╰─────────────────────────────────────────────────────────────────────────────╯
```

## Run-Path Stack Deck (Wide)

### Frozen Summary + Stage 2 Mid-Run

```text
› arbiter  run / monitoring                                                00:19
───────────────────────────────────────────────────────────────────────────────
[persistent masthead]
[frozen study summary card]

═══ RUN ═══
╭─ Master progress ─────────────────────────────────────────────────────────╮
│  Trials: {completed}/{planned} | Workers: {workers}                      │
│  [{bar}] {pct}%      Elapsed: {elapsed}      ETA: {eta_or_dash}          │
╰───────────────────────────────────────────────────────────────────────────╯

╭─ Monitoring ─────────────────────────╮╭─ Workers ─────────────────────────╮
│ Novelty rate        {value}         ││ ID  Progress   State    Trial Model│
│ Patience            {cur}/{target}  ││ W1 [{w1_bar}] {w1_pct}%  run  17 g5│
│ Status              {sampling_status}││ W2 [{w2_bar}] {w2_pct}%  idle  —  —│
│ Stop signal         {stop_signal}   ││ W3 [{w3_bar}] {w3_pct}%  run  18 s4│
│ Stopping indicates diminishing      ││ ...                               │
│ novelty, not correctness.           ││ (+{hidden_count} more workers)    │
╰──────────────────────────────────────╯╰────────────────────────────────────╯
───────────────────────────────────────────────────────────────────────────────
Ctrl+C graceful stop
```

Worker progress rule:

1. one worker progress row exists per visible worker.
2. each worker row includes worker label, mini progress bar, percentage, state, trial, and model context.
3. when worker count exceeds available height, render top N workers and `(+{hidden_count} more workers)`.
4. master bar remains the global source of overall progress.

### Final Stage 3 Receipt

```text
[persistent masthead]
[frozen study summary]
[final run snapshot]

═══ RECEIPT ═══

╭─ Completion ─────────────────────────╮╭─ Artifacts ───────────────────────╮
│ Stopped: {stop_reason_label}         ││ config.source.json                │
│ Trials: {planned}/{completed}/{eligible}│ config.resolved.json            │
│ Duration: {duration}                 ││ manifest.json                     │
│ Usage: {usage_summary}               ││ trials.jsonl                      │
│                                      ││ monitoring.jsonl                  │
│ Stopping indicates diminishing       ││ receipt.txt                       │
│ novelty, not correctness.            │╰────────────────────────────────────╯
╰──────────────────────────────────────╯
───────────────────────────────────────────────────────────────────────────────
Run complete.
```

## Narrow Tier Overrides (`COLUMNS < 100`)

Narrow rules:

1. stage spine stacks above active card,
2. cards use short labels where needed but preserve LOCKED terminology,
3. long summaries truncate with ellipsis in frozen Study Summary card,
4. Stage 2 compacts monitoring and workers into short stacked sections when vertical space is constrained.

Narrow Step 3 shape:

```text
› arbiter  setup / models (narrow)                                         00:13
───────────────────────────────────────────────────────────────────────────────
◆ Models  ◇ Personas  ◇ Decode  ◇ Advanced  ◇ Review
───────────────────────────────────────────────────────────────────────────────
Models to sample
  ▸ ■ openai/gpt-5         [paid]
    □ anthropic/claude-sonnet-4 [paid]
    ■ openai/gpt-4.1-mini  [paid]
    □ google/gemini-2.0-flash [free]

Warning: free-tier models are for exploration only.
───────────────────────────────────────────────────────────────────────────────
↑/↓ move · Space toggle · Enter confirm · Esc back
```

Narrow Stage 2 shape:

```text
› arbiter  run / monitoring (narrow)                                       00:19
───────────────────────────────────────────────────────────────────────────────
[masthead]
[frozen summary (truncated)]

═══ RUN ═══
╭─ Master progress ─────────────────────────────────────────────────────────╮
│ {completed}/{planned}  [{bar}] {pct}%                                    │
│ Elapsed: {elapsed}  ETA: {eta_or_dash}                                   │
│ Novelty: {value}  Patience: {current}/{target}                           │
╰───────────────────────────────────────────────────────────────────────────╯
╭─ Workers ─────────────────────────────────────────────────────────────────╮
│ W1 [{w1_bar}] {w1_pct}% · {w1_status} · trial {w1_trial}                │
│ W2 [{w2_bar}] {w2_pct}% · {w2_status} · trial {w2_trial}                │
│ ...                                                                      │
│ (+{hidden_count} more workers)                                           │
╰───────────────────────────────────────────────────────────────────────────╯
───────────────────────────────────────────────────────────────────────────────
Ctrl+C graceful stop
```

## Sentinels

Current LOCKED sentinels in copy deck:

1. `═══ RUN ═══`
2. `═══ RECEIPT ═══`

Reboot rule:

1. if sentinel format is upgraded to card-style headers, update:
   - `docs/product-specs/tui-copy-deck.md` LOCKED values,
   - `test/e2e/tui-pty.test.mjs` assertions,
   - this deck examples,
   in one atomic commit.

## Review Checklist for This Deck

1. every Stage 1 step has an explicit ASCII target,
2. run-path stack composition is explicit,
3. narrow behavior is explicit for at least one Stage 1 and one Stage 2 screen,
4. no duplicate masthead rendering in Stage 1 pages,
5. summary card is present before Stage 2 and Stage 3 in run path,
6. all examples remain compatible with copy deck LOCKED language constraints.
