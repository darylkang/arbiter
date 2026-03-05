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

## Premium Signature Contract

These motifs are required for the premium reboot and supersede plain utility styling.

1. Navigation spine is integrated into container borders, not rendered as a separate list card.
2. Stage 1 rail uses timeline semantics:
   - `◆` current section,
   - `◇` non-current section anchors,
   - `│` vertical continuation.
3. Choice controls use glyph selectors:
   - single-choice: `○` unselected, `●` selected,
   - multi-choice: `◇` unselected, `◆` selected.
4. Primary focus cursor uses `▸` only for current actionable row.
5. Bracket checkbox styling (`[ ]`, `[x]`) is not used in premium mode.
6. Hero lockup must read as deliberate brand treatment (block/glyph title or compact premium caps), not plain one-line label text.

## Stage 1 Panel Template (Border-Integrated Rail)

This template defines the Stage 1 composition grammar used by all steps.

```text
╭─ {Stage Heading} ────────────────────────────────────────────────────────╮
│ ◆ {Current step label}                                                   │
│ │ {current step helper/fields...}                                        │
│ │ {current step helper/fields...}                                        │
│ ◇ {Next step label}                                                      │
│ ◇ {Next step label}                                                      │
│ ◇ {Next step label}                                                      │
│                                                                           │
│ {context/validation/warning lines}                                       │
│ {controls hint line}                                                     │
╰───────────────────────────────────────────────────────────────────────────╯
```

Interpretation:

1. the rail runs inside the left edge of the same primary container.
2. current-step content appears adjacent to the `◆` and `│` rail.
3. pending steps are listed as compact `◇` anchors.

## Width Tiers

Tier definitions:

1. Wide: `COLUMNS >= 100`
2. Narrow: `COLUMNS < 100`

Tier behavior:

1. Wide uses full two-card composition in Stage 1 (spine + active card).
2. Narrow stacks spine above active card.
3. Wide Stage 2 shows monitoring and usage as separate cards.
4. Narrow Stage 2 collapses to one merged operational card when needed.
5. No clipping of LOCKED copy in either tier; wrap at word boundaries.

## Stage 0 + Stage 1 Screen Deck (Wide)

### Step 0: Entry Path

```text
╭─ ARBITER ───────────────────────────────────────────────────────────────╮
│  Distributional reasoning harness                                       │
│  Version {version}                                                      │
│  Environment  API key: {detected|not detected}  Mode: {—|Mock|Live}     │
│  Configs in CWD: {count}                                                │
╰──────────────────────────────────────────────────────────────────────────╯

╭─ Stage 1 / Setup ────────────────────────────────────────────────────────╮
│ ◆ Entry Path                                                              │
│ │ Choose how to start                                                     │
│ │                                                                         │
│ │ ▸ ● Create new study (guided wizard)                                    │
│ │   ○ Run existing config (unavailable)                                   │
│ ◇ Research Question                                                       │
│ ◇ Protocol                                                                │
│ ◇ Models                                                                  │
│ ◇ Personas                                                                │
│ ◇ Decode Params                                                           │
│ ◇ Advanced Settings                                                       │
│ ◇ Review and Confirm                                                      │
╰───────────────────────────────────────────────────────────────────────────╯
```

### Step 0: Run Mode

```text
╭─ Stage 1 / Setup ────────────────────────────────────────────────────────╮
│ ◆ Run Mode                                                                │
│ │ Choose run mode                                                         │
│ │                                                                         │
│ │ ▸ ● Mock (no API calls)                                                 │
│ │   ○ Live (OpenRouter)                                                   │
│ │ Live mode is unavailable: OPENROUTER_API_KEY not detected.             │
│ ◇ Research Question                                                       │
│ ◇ Protocol                                                                │
│ ◇ Models                                                                  │
│ ◇ Personas                                                                │
│ ◇ Decode Params                                                           │
│ ◇ Advanced Settings                                                       │
│ ◇ Review and Confirm                                                      │
╰───────────────────────────────────────────────────────────────────────────╯
```

### Step 1: Research Question

```text
╭─ Stage 1 / Setup ─────────────────╮  ╭─ Research Question ──────────────╮
│  ◆ Research Question              │  │  Include all relevant context.   │
│  · Protocol                       │  │  Arbiter samples responses to    │
│  · Models                         │  │  characterize distributional      │
│  · Personas                       │  │  behavior.                        │
│  · Decode Params                  │  │                                   │
│  · Advanced Settings              │  │  Question                         │
│  · Review and Confirm             │  │  {multiline input}                │
│                                   │  │                                   │
│  ✔ Run mode: Mock                 │  │  Controls: Enter continue · Esc   │
╰───────────────────────────────────╯  ╰───────────────────────────────────╯
```

### Step 2: Protocol

```text
╭─ Stage 1 / Setup ─────────────────╮  ╭─ Protocol ───────────────────────╮
│  ✔ Research Question              │  │  Select how each trial is        │
│  ◆ Protocol                       │  │  structured.                      │
│  · Models                         │  │                                   │
│  · Personas                       │  │  ▸ Independent                    │
│  · Decode Params                  │  │    Debate                         │
│  · Advanced Settings              │  │                                   │
│  · Review and Confirm             │  │  Controls: ↑/↓ move · Enter      │
╰───────────────────────────────────╯  ╰───────────────────────────────────╯
```

### Step 3: Models

```text
╭─ Stage 1 / Setup ────────────────────────────────────────────────────────╮
│ ◆ Models                                                                  │
│ │ Select one or more models for sampling.                                 │
│ │                                                                         │
│ │ ▸ ◆ openai/gpt-5                                                        │
│ │   ◇ anthropic/claude-sonnet-4                                           │
│ │   ◆ openai/gpt-4.1-mini                                                 │
│ │                                                                         │
│ │ Warning: free-tier models selected...                                   │
│ ◇ Personas                                                                │
│ ◇ Decode Params                                                           │
│ ◇ Advanced Settings                                                       │
│ ◇ Review and Confirm                                                      │
╰───────────────────────────────────────────────────────────────────────────╯
```

### Step 4: Personas

```text
╭─ Stage 1 / Setup ────────────────────────────────────────────────────────╮
│ ◆ Personas                                                                │
│ │ Select one or more personas for sampling.                               │
│ │                                                                         │
│ │ ▸ ◆ neutral_analyst                                                     │
│ │   ◆ skeptical_reviewer                                                  │
│ │   ◇ policy_formalist                                                    │
│ │                                                                         │
│ │ Controls: ↑/↓ move · Space toggle · Enter confirm                      │
│ ◇ Decode Params                                                           │
│ ◇ Advanced Settings                                                       │
│ ◇ Review and Confirm                                                      │
╰───────────────────────────────────────────────────────────────────────────╯
```

### Step 5: Decode Params

```text
╭─ Stage 1 / Setup ─────────────────╮  ╭─ Decode Params ──────────────────╮
│  ✔ Research Question              │  │  Set temperature and seed        │
│  ✔ Protocol                       │  │  behavior for trial sampling.     │
│  ✔ Models                         │  │                                   │
│  ✔ Personas                       │  │  Temperature mode: ▸ Single value │
│  ◆ Decode Params                  │  │  Temperature: 0.70                │
│  · Advanced Settings              │  │  Seed mode: ▸ Random              │
│  · Review and Confirm             │  │                                   │
│                                   │  │  Controls: Enter confirm · Esc    │
╰───────────────────────────────────╯  ╰───────────────────────────────────╯
```

### Step 6: Advanced Settings

```text
╭─ Stage 1 / Setup ─────────────────╮  ╭─ Advanced Settings ──────────────╮
│  ✔ Research Question              │  │  Use defaults or customize        │
│  ✔ Protocol                       │  │  execution and stopping settings. │
│  ✔ Models                         │  │                                   │
│  ✔ Personas                       │  │  ▸ Use defaults (recommended)     │
│  ✔ Decode Params                  │  │    Customize                      │
│  ◆ Advanced Settings              │  │                                   │
│  · Review and Confirm             │  │  Controls: ↑/↓ move · Enter      │
╰───────────────────────────────────╯  ╰───────────────────────────────────╯
```

### Step 7: Review and Confirm

```text
╭─ Stage 1 / Setup ────────────────────────────────────────────────────────╮
│ ◆ Review and Confirm                                                      │
│ │ Preflight                                                               │
│ │ ◆ Schema validation                                                     │
│ │ ◆ Output path writable                                                  │
│ │ ◇ Live connectivity check                                               │
│ │                                                                         │
│ │ ▸ ● Run now                                                             │
│ │   ○ Save config and exit                                                │
│ │   ○ Revise                                                              │
│ │   ○ Quit without saving                                                 │
│ ◇ Completed setup summary                                                 │
╰───────────────────────────────────────────────────────────────────────────╯
```

## Run-Path Stack Deck (Wide)

### Frozen Summary + Stage 2 Mid-Run

```text
[persistent masthead]

╭─ Study Summary ──────────────────────────────────────────────────────────╮
│  Question: {question_excerpt}                                            │
│  Protocol: {protocol_summary}                                            │
│  Models: {models_summary}                                                │
│  Personas: {personas_summary}                                            │
│  Decode: {decode_summary}                                                │
│  Execution: workers {workers}, batch {batch}, K_max {k_max}             │
│  Output dir: {out_dir}                                                   │
╰───────────────────────────────────────────────────────────────────────────╯

═══ RUN ═══

╭─ Master progress ─────────────────────────────────────────────────────────╮
│  Trials: {completed}/{planned} | Workers: {workers}                      │
│  Master progress [███████████░░░░░░░░░░░░░] {pct}%                       │
│  Elapsed: {elapsed}   ETA: {eta_or_dash}                                 │
╰───────────────────────────────────────────────────────────────────────────╯

╭─ Monitoring ──────────────────────────────────────────────────────────────╮
│  Novelty rate: {value} (threshold {threshold})                           │
│  Patience: {current}/{target}   Status: {sampling_status}                │
│  Stopping indicates diminishing novelty, not correctness.                │
╰───────────────────────────────────────────────────────────────────────────╯
```

### Final Stage 3 Receipt

```text
[persistent masthead]
[frozen study summary]
[final run snapshot]

═══ RECEIPT ═══

╭─ Receipt Summary ─────────────────────────────────────────────────────────╮
│  Stopped: {stop_reason_label}                                            │
│  Summary                                                                  │
│  Stop reason: {stop_reason_label}                                        │
│  Trials (planned/completed/eligible): {planned}/{completed}/{eligible}   │
│  Duration: {duration}                                                     │
│  Usage: {usage_summary}                                                   │
│  Artifacts: {artifact_summary}                                            │
│  Stopping indicates diminishing novelty, not correctness.                 │
╰───────────────────────────────────────────────────────────────────────────╯
```

## Narrow Tier Overrides (`COLUMNS < 100`)

Narrow rules:

1. stage spine stacks above active card,
2. cards use short labels where needed but preserve LOCKED terminology,
3. long summaries truncate with ellipsis in frozen Study Summary card,
4. Stage 2 merges monitoring and usage when vertical space is constrained.

Narrow Step 3 shape:

```text
╭─ Stage 1 / Setup ────────────────────────────────────────────────────────╮
│  ◆ Models  ◇ Personas  ◇ Decode Params  ◇ Advanced  ◇ Review             │
╰───────────────────────────────────────────────────────────────────────────╯

╭─ Models ──────────────────────────────────────────────────────────────────╮
│  ▸ ◆ openai/gpt-5                                                         │
│    ◇ anthropic/claude-sonnet-4                                            │
│    ◆ openai/gpt-4.1-mini                                                  │
╰───────────────────────────────────────────────────────────────────────────╯
```

Narrow Stage 2 shape:

```text
[masthead]
[frozen summary (truncated)]

═══ RUN ═══

╭─ Master progress ─────────────────────────────────────────────────────────╮
│  {completed}/{planned}  [{bar}] {pct}%                                   │
│  elapsed {elapsed}  eta {eta_or_dash}                                    │
│  novelty {value}  patience {current}/{target}                            │
╰───────────────────────────────────────────────────────────────────────────╯
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
