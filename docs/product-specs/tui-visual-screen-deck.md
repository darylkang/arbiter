# Arbiter TUI Visual Screen Deck

Status: accepted implementation target
Owner: Arbiter
Last updated: 2026-03-04

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

╭─ Stage 1 / Setup ─────────────────╮  ╭─ Entry Path ─────────────────────╮
│  ◆ Research Question              │  │  Choose how to start             │
│  · Protocol                       │  │                                   │
│  · Models                         │  │  ▸ Create new study (guided      │
│  · Personas                       │  │    wizard)                        │
│  · Decode Params                  │  │    Run existing config            │
│  · Advanced Settings              │  │                                   │
│  · Review and Confirm             │  │  Controls: ↑/↓ move · Enter      │
╰───────────────────────────────────╯  ╰───────────────────────────────────╯
```

### Step 0: Run Mode

```text
╭─ Stage 1 / Setup ─────────────────╮  ╭─ Run Mode ───────────────────────╮
│  ◆ Research Question              │  │  Choose run mode                 │
│  · Protocol                       │  │                                   │
│  · Models                         │  │  ▸ Mock (no API calls)           │
│  · Personas                       │  │    Live (OpenRouter)             │
│  · Decode Params                  │  │                                   │
│  · Advanced Settings              │  │  Live mode is unavailable:        │
│  · Review and Confirm             │  │  OPENROUTER_API_KEY not detected. │
╰───────────────────────────────────╯  ╰───────────────────────────────────╯
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
╭─ Stage 1 / Setup ─────────────────╮  ╭─ Models ─────────────────────────╮
│  ✔ Research Question              │  │  Select one or more models for   │
│  ✔ Protocol                       │  │  sampling.                        │
│  ◆ Models                         │  │                                   │
│  · Personas                       │  │  [x] openai/gpt-5                │
│  · Decode Params                  │  │  [ ] anthropic/claude-sonnet-4   │
│  · Advanced Settings              │  │  [x] openai/gpt-4.1-mini         │
│  · Review and Confirm             │  │                                   │
│                                   │  │  Warning: free-tier models       │
│                                   │  │  selected...                      │
╰───────────────────────────────────╯  ╰───────────────────────────────────╯
```

### Step 4: Personas

```text
╭─ Stage 1 / Setup ─────────────────╮  ╭─ Personas ───────────────────────╮
│  ✔ Research Question              │  │  Select one or more personas     │
│  ✔ Protocol                       │  │  for sampling.                    │
│  ✔ Models                         │  │                                   │
│  ◆ Personas                       │  │  [x] neutral_analyst             │
│  · Decode Params                  │  │  [x] skeptical_reviewer          │
│  · Advanced Settings              │  │  [ ] policy_formalist            │
│  · Review and Confirm             │  │                                   │
│                                   │  │  Controls: ↑/↓ move · Space      │
╰───────────────────────────────────╯  ╰───────────────────────────────────╯
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
╭─ Stage 1 / Setup ─────────────────╮  ╭─ Review and Confirm ─────────────╮
│  ✔ Research Question              │  │  Preflight                         │
│  ✔ Protocol                       │  │  ✔ Schema validation               │
│  ✔ Models                         │  │  ✔ Output path writable            │
│  ✔ Personas                       │  │  ○ Live connectivity check         │
│  ✔ Decode Params                  │  │                                     │
│  ✔ Advanced Settings              │  │  ▸ Run now                         │
│  ◆ Review and Confirm             │  │    Save config and exit            │
│                                   │  │    Revise                          │
│                                   │  │    Quit without saving             │
╰───────────────────────────────────╯  ╰───────────────────────────────────╯
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
│  ✔ Research Question  ✔ Protocol  ◆ Models  · Personas  · Decode  · Adv │
╰───────────────────────────────────────────────────────────────────────────╯

╭─ Models ──────────────────────────────────────────────────────────────────╮
│  [x] openai/gpt-5                                                         │
│  [ ] anthropic/claude-sonnet-4                                            │
│  [x] openai/gpt-4.1-mini                                                  │
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
