# Arbiter TUI Visual Screen Deck

Status: accepted redesign target
Owner: Arbiter
Last updated: 2026-03-07

## Scope and Precedence

Precedence order for TUI implementation:

1. `docs/product-specs/tui-wizard.md` (behavior and interaction semantics)
2. `docs/product-specs/tui-copy-deck.md` (LOCKED/FLEX copy contract)
3. this visual screen deck (visual layout contract)
4. `docs/TUI-RUNTIME.md` (internal runtime architecture and renderer ownership)

When this visual deck conflicts with behavior semantics, behavior semantics win.
When this visual deck conflicts with LOCKED copy, LOCKED copy wins.

## Design Intent

Arbiter should read as a precision console: warm, technical, and premium without becoming theatrical.

The UI should feel:

1. deliberate, not improvised,
2. instrument-grade, not shell-like,
3. contained and hierarchical, not like a flat formatted log,
4. terminal-native, not a faux GUI,
5. visually confident without becoming noisy.

The current redesign direction is defined by four principles:

1. **Identity panel over floating brand text** — the top of the app is a contained chrome surface, not a loose wordmark.
2. **Stage headers over pseudo-command strips** — `▍ SETUP`, `▍ RUN`, and `▍ RECEIPT` replace shell-like `› arbiter ...` context strips.
3. **Hierarchy over rule spam** — fewer full-width dividers, more hierarchy through color, spacing, containment, and short-prefix subsection labels.
4. **Two-accent structure** — amber marks current/lifecycle emphasis; teal marks structure and grouping.

Retro boundary:

1. premium research instrument first,
2. arcade influence second,
3. use retro influence through warm palette, geometric glyphs, and confident chrome,
4. do not use retro influence through giant ASCII logos, dense box art, playful glyph clutter, or cyberpunk parody.

Never implement:

1. rainbow or decorative multi-color styling,
2. CRT or blink effects,
3. split-pane layouts,
4. bracket-wrapped progress bars (`[███░]`),
5. `[x]` / `[ ]` checkboxes,
6. large ASCII-art logos,
7. framed boxes for every section.

Allowed containment:

1. one rounded-corner identity panel at the top of Stage 0 / Stage 1,
2. no repeated heavy framed panels for Stage 2 or Stage 3.

## Runtime and Transcript Relationship

This file defines the visual contract only. The normal-screen overwrite runtime defined in `docs/TUI-RUNTIME.md` remains authoritative for rendering mechanics.

Durable transcript contract:

1. Stage 0 identity panel appears once at the top of the durable transcript.
2. Stage 1 contributes one frozen study rail summary beneath that identity panel.
3. Stage 2 contributes one final dashboard snapshot beneath the frozen summary.
4. Stage 3 contributes one receipt beneath the final dashboard snapshot.
5. The identity panel is not re-emitted as a heavy framed panel between stages.

## Visual Hierarchy

The UI uses four hierarchy levels.

### Hierarchy Contract

| Level | Purpose | Treatment | Spacing | Borders |
|------|---------|-----------|---------|---------|
| 0 | identity and app presence | compact wordmark, tagline, status rows | most generous vertical rhythm | framed only in the expanded identity panel |
| 1 | stage lifecycle | amber stage header with muted clock | open spacing above and below | no attached full-width rule |
| 2 | subsection grouping | teal short-prefix header | one blank line before content | no box, no trailing fill |
| 3 | content and evidence | muted labels, primary values, restrained caveats | compact scan-oriented spacing | no decorative borders |

### Level 0: Identity Panel

A rounded-corner teal frame containing:

1. compact `ARBITER` wordmark,
2. tagline,
3. one-per-line environment signal rows.

This is the only heavy containment element in the product.

### Level 1: Stage Header

A left-bar lifecycle marker.

```text
▍ SETUP                                                  00:12
▍ RUN                                                    00:00
▍ RECEIPT                                                00:00
```

Rules:

1. `▍` and label use `accent.primary`.
2. Clock is right-aligned in `fg.muted`.
3. No shell prompt glyphs.
4. No full-width rule directly attached to the stage header.

### Level 2: Subsection Header

Short-prefix label, not full-width ruled fill.

```text
── PROGRESS
── MONITORING
── WORKERS
── USAGE
```

Rules:

1. Prefix dashes and label use `accent.secondary`.
2. Bold label, no trailing fill to terminal edge.
3. One blank line before content.
4. Subsection headers are structural, not dramatic.

### Level 3: Content

Body rows, KV pairs, worker rows, artifact rows, helper copy.

Rules:

1. labels/keys in `fg.muted`,
2. values in `fg.primary`,
3. highlighted live values may use `accent.primary`,
4. caveat lines use warning glyph + muted prose.

## Color Strategy

### Primary Accent Roles

- `accent.primary` (amber): lifecycle emphasis, active state, progress bars, stage headers, wordmark
- `accent.secondary` (teal): structure, subsection headers, panel border, rail connector, informational signal dots

### Semantic Roles

- `status.success`: success / completed / available
- `status.warn`: warning / caveat / skipped state
- `status.error`: error / failed state
- `fg.muted`: labels, helper text, secondary metadata
- `fg.primary`: body values and readable content

### Application Rule

Teal is no longer decorative separator color only. It is structural chrome.

## Header Variants

The redesign uses two header states to preserve the identity moment without over-framing later stages.

### Expanded Header

Use for the Welcome / initial setup moment.

Includes:

1. framed identity panel,
2. compact `ARBITER` wordmark,
3. tagline,
4. one-per-line environment status rows.

### Compact Header

Use for later setup screens, run, and receipt when vertical space is constrained.

Target shape:

```text
ARBITER                                              v0.1.0
● API key    detected   ● Run mode    Mock   ● Configs    98
```

Rules:

1. no heavy frame by default,
2. preserve the same color semantics as the expanded header,
3. values may truncate with ellipsis, but labels never wrap,
4. the durable transcript still prints the expanded identity panel once at the top and does not repeat it later.

## Glyph Vocabulary

### Rail Navigation

| Meaning | Glyph | Color | Notes |
|---------|-------|-------|-------|
| completed step | `◆` | `status.success` | filled diamond |
| active step | `▸` | `accent.primary` | active/current |
| pending step | `◇` | `fg.muted` | hollow diamond |
| rail connector | `│` | `accent.secondary` | vertical continuity |

### Controls

| Meaning | Glyph | Color |
|---------|-------|-------|
| single selected | `●` | `accent.primary` |
| single unselected | `○` | `fg.muted` |
| multi selected | `■` | `accent.primary` |
| multi unselected | `□` | `fg.muted` |
| focus cursor | `▸` | `accent.primary` |

The only shared glyph between rail and controls is `▸`, and in both contexts it means “currently active.”

### Preflight and Signals

| Meaning | Glyph |
|---------|-------|
| pass | `✓` |
| warning / skipped | `⚠` |
| fail | `✕` |
| signal dot | `●` |

### Progress and Activity

| Meaning | Glyph |
|---------|-------|
| fill | `█` |
| empty | `░` |

## Identity Panel

The identity panel replaces the loose Stage 0 brand block.

### Target Shape

```text
╭──────────────────────────────────────────────────────────────╮
│                                                              │
│  ARBITER                                             v0.1.0  │
│  Distributional reasoning harness                            │
│                                                              │
│  ● API key    detected                                       │
│  ● Run mode   Mock                                           │
│  ● Configs    98 in current directory                        │
│                                                              │
╰──────────────────────────────────────────────────────────────╯
```

### Rules

1. `ARBITER` is compact bold, no letter-spacing.
2. Panel border is `accent.secondary`.
3. Version is right-aligned in `fg.muted`.
4. Tagline is `fg.muted`.
5. Each environment row gets its own signal dot and line.
6. Dots are context-colored:
   - API key detected → `status.success`
   - run mode → `accent.primary`
   - configs/info → `accent.secondary`
7. The panel persists visually throughout Stage 1.
8. In the durable transcript, it appears once at the top and is not repeated.

## Component Inventory

### ExpandedHeader

- purpose: Welcome / first-impression identity surface
- treatment: teal framed identity panel
- spacing: generous vertical rhythm
- overflow: values truncate at line end, never mid-label

### CompactHeader

- purpose: lightweight brand chrome after the welcome moment
- treatment: one compact brand line plus one compact status row line
- spacing: tighter than the expanded header
- overflow: labels stay intact; values truncate with ellipsis

### StageHeader

- purpose: mark `SETUP`, `RUN`, and `RECEIPT`
- treatment: amber left bar + uppercase label + muted clock
- spacing: one blank line below by default
- overflow: labels never wrap

### StatusRow

- purpose: present environment/runtime state cleanly
- treatment: signal dot + label + value
- spacing: one per line in expanded header; compact grouped row in compact header when width allows
- overflow: values truncate before labels wrap

### ProgressRail

- purpose: show setup progress and frozen setup summary
- treatment: geometric rail markers with aligned summaries
- spacing: consistent summary column and teal connectors
- overflow: summaries truncate with ellipsis rather than deforming rail structure

### ActiveStepCard

- purpose: support the active setup prompt/content region
- treatment: content nested beneath the active rail marker without heavy framing
- spacing: distinct helper, prompt label, and control region spacing
- overflow: helper prose wraps by word

### SectionHeader

- purpose: group dashboard and receipt subsections
- treatment: teal `── Label`
- spacing: one blank line before content
- overflow: labels never wrap

### KVTable

- purpose: align monitoring and summary values
- treatment: muted keys, primary values, fixed key column
- spacing: compact vertical rhythm
- overflow: truncate long values with ellipsis unless the row is prose

### ProgressBar

- purpose: show master and worker activity visually
- treatment: bracketless amber or semantic fill
- spacing: sits inline with percentage/time where appropriate
- overflow: bar shrinks before surrounding labels collapse

### WorkerTable

- purpose: console-grade worker snapshot
- treatment: aligned columns for ID, state, trial, model, activity
- spacing: dense but legible rows
- overflow: model names truncate before table structure wraps

### FooterHint

- purpose: low-emphasis operator affordance
- treatment: muted footer line beneath one muted rule
- spacing: visually separated from main content
- overflow: should stay single-line where possible

### CaveatNote

- purpose: communicate research-honest constraints
- treatment: warning glyph plus muted prose
- spacing: placed close to the metric it qualifies
- overflow: wraps by word only

## Text Flow Rules

1. Never wrap model names, provider names, or filenames mid-token.
2. Prefer truncation with ellipsis over arbitrary wrapping for constrained labels.
3. Paths may wrap only at path separators or be moved to a dedicated line.
4. Warning and caveat prose must wrap by word.
5. Table columns must define truncation behavior before allowing structural wrap.
6. Active or focused rows may expand into a details region instead of forcing dense inline wrapping.
7. Version strings, stage headers, and subsection headers never wrap.
8. File extensions should remain attached to filenames when truncated.

## Stage 1: Setup Surface

Stage 1 consists of:

1. expanded or compact header, depending on stage and available height,
2. `▍ SETUP` stage header,
3. inline study rail,
4. command footer.

### Layout Shape

```text
╭─ identity panel ─╮

▍ SETUP                                                  00:12

  ◆  Entry Path                   Create new study
  │
  ◆  Run Mode                     Mock
  │
  ▸  Research Question
  │
  │   helper text
  │   input / selectors
  │
  ◇  Protocol
  ◇  Models
  ◇  Personas
  ◇  Decode Params
  ◇  Advanced Settings
  ◇  Review and Confirm

  ─────────────────────────────────────────────────────────────
  ↑/↓ move · Enter select · Esc back
```

### Rail Rules

1. Completed rows use `◆`, not `✔`.
2. Active row uses `▸`, not `◆`.
3. Pending rows use `◇`.
4. Rail summaries align to a consistent summary column.
5. Rail connector lines remain teal.
6. Command footer uses one muted full-width rule above it.
7. A split wide-layout setup surface is deferred; the first pass keeps the inline rail/content composition.

### Step 1 Question Surface

The research-question step is the most important input surface and should look intentionally supported.

```text
▍ SETUP                                                  00:11

  ◆  Entry Path                   Create new study
  │
  ◆  Run Mode                     Mock
  │
  ▸  Research Question
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

  ─────────────────────────────────────────────────────────────
  Enter continue · Esc back
```

### Stage 1 Frozen Summary

When `Run now` is selected, the editable rail freezes into a durable study rail summary.

```text
◆  Entry Path                     Create new study
│
◆  Run Mode                       Mock
│
◆  Research Question              "What is the nature..." (30 chars)
│
◆  Protocol                       Independent
│
◆  Models                         GPT-4o Mini (1 selected)
│
◆  Personas                       Neutral (1 selected)
│
◆  Decode Params                  temp 0.7, seed 424242
│
◆  Advanced Settings              defaults
```

Rules:

1. All frozen rows show the completed glyph `◆`.
2. Frozen rail content remains visible above Stage 2 and Stage 3 in the durable transcript.
3. The frozen rail is visually quieter than the live dashboard below, but still readable.

## Stage 1 → Stage 2 Handoff

The handoff seam should feel intentional and not collapsed into the dashboard header.

### Required Sequence

1. Frozen identity panel and study rail remain above.
2. Blank line.
3. `Starting run` transition cue on its own line in `fg.muted`.
4. Blank line.
5. `▍ RUN` stage header.

This handoff seam replaces the current blended `Starting run                › arbiter  run / monitoring` collision.

## Stage 2: Dashboard Surface

Stage 2 consists of:

1. `▍ RUN` stage header,
2. subsection blocks,
3. one muted footer rule,
4. footer control hint.

### Target Shape

```text
▍ RUN                                                    00:00

  ── PROGRESS
  Trials: 20/20 · Workers: 3
  ██████████████████████████████████████████  100%  00:00:00  ETA 00:00:00

  ── MONITORING
  Novelty rate          0.000 (threshold 0.100)
  Patience              3/2
  Status                max trials reached
  Similarity            0.975 (threshold 0.850)
  △ Stopping indicates diminishing novelty, not correctness.

  ── WORKERS
  ID   Activity        State      Trial      Model
  W1   ⠦░░░░░░░░░░░   idle       trial 18   GPT-4o Mini
  W2   ⠦░░░░░░░░░░░   idle       trial 19   GPT-4o Mini
  W3   ⠦░░░░░░░░░░░   idle       trial 17   GPT-4o Mini

  ── USAGE
  Mock mode: usage and cost are not tracked.

  ─────────────────────────────────────────────────────────────
  Ctrl+C to stop gracefully
```

### Rules

1. Remove the old shell-like status strip from Stage 2.
2. Use `▍ RUN` as the only stage-level chrome.
3. Use short-prefix subsection labels (`── PROGRESS`), not full-width ruled fills.
4. Keep one muted full-width footer rule only.
5. Worker model labels must use product display labels, not raw slugs.
6. Stage 2 should feel lighter and more open than the current ruled-section wall.
7. Wide two-column dashboard experiments are deferred optional polish.

## Stage 3: Receipt Surface

Stage 3 should feel like one receipt document with subsections, not like a stack of peer stages.

### Target Shape

```text
▍ RECEIPT                                                00:00

  Stopped: max trials reached
  △ Stopping indicates diminishing novelty, not correctness.

  ── SUMMARY
  Stop reason           max trials reached
  Trials                20 / 20 / 20 (planned / completed / eligible)
  Duration              —
  Usage                 not available
  Protocol              Independent
  Models                1
  Personas              1

  ── ARTIFACTS
  Only generated files are listed.
  config.source.json
  config.resolved.json
  manifest.json
  trial_plan.jsonl
  trials.jsonl
  monitoring.jsonl
  receipt.txt
  embeddings.arrow

  ── REPRODUCE
  arbiter run --config ./runs/20260307T.../config.resolved.json

  ─────────────────────────────────────────────────────────────
  → Run complete.
```

### Rules

1. `▍ RECEIPT` is the parent-level stage header in amber.
2. `── SUMMARY`, `── ARTIFACTS`, `── REPRODUCE`, and conditional `── GROUPS` are child-level subsection headers in teal.
3. Artifact ledger remains vertical, one file per line.
4. Completion footer should be visually quiet and conclusive.

## Dashboard-Only Mode

`arbiter run --dashboard` uses the same Stage 2 and Stage 3 visual system, but omits:

1. the identity panel,
2. the frozen Stage 1 rail summary.

It still uses:

1. `▍ RUN`,
2. `▍ RECEIPT`,
3. the same subsection header grammar.

## Width and Spacing Rules

1. Minimum supported width remains 60 columns.
2. Keep the current normal-screen overwrite runtime model.
3. Use blank lines aggressively enough to preserve hierarchy, but not so many that the transcript feels sparse.
4. Identity panel must remain readable at minimum supported width; it may compact vertically but should not collapse into the old floating wordmark treatment.
5. Subsection headers should never trail-fill to the terminal edge.
6. Footer rules remain full-width and muted.

## Deferred Polish

Not required for the first implementation pass:

1. animated completion pulse or reveal transitions,
2. split Stage 1 wide layout,
3. responsive multi-column Stage 2 layout,
4. richer usage microcharts or mini-graphs,
5. any additional decorative motion beyond the current runtime behavior.

## Testable Assertions

These strings and relationships should become the high-value capture/PTY targets after implementation.

### Stage 1

```text
waitForText("ARBITER")
waitForText("▍ SETUP")
waitForText("◆  Entry Path")
waitForText("▸  Research Question")
```

### Stage 2

```text
waitForText("▍ RUN")
waitForText("── PROGRESS")
waitForText("── MONITORING")
waitForText("── WORKERS")
```

### Stage 3

```text
waitForText("▍ RECEIPT")
waitForText("── SUMMARY")
waitForText("── ARTIFACTS")
waitForText("── REPRODUCE")
```

### Durable Transcript Ordering

```text
"ARBITER"      < "▍ SETUP"
"▍ SETUP"     < "▍ RUN"
"▍ RUN"       < "▍ RECEIPT"
"▍ RECEIPT"   < "Run complete."
```

## Implementation Notes

This redesign is a rendering-layer overhaul only.

Preserve:

1. current runtime architecture,
2. current view-model / render-function separation,
3. current Stage 0 → Stage 1 → Stage 2 → Stage 3 behavior,
4. current normal-screen overwrite transcript model,
5. current worker animation behavior,
6. current bracketless progress bars.

Do not preserve visually:

1. shell-like status strips,
2. letter-spaced brand wordmark,
3. heavy dependence on full-width ruled section headers,
4. checkmark-based rail completion,
5. flat receipt hierarchy.
