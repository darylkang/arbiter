# Complete TUI Visual Reboot to Premium Instrument Experience

This ExecPlan is a living document and must be updated as work proceeds.
This plan follows `docs/PLANS.md`.

## Purpose / Big Picture
Deliver a complete visual reboot of Arbiter's TUI so the product feels premium, memorable, and intentional rather than restrained or clinical.

This is a design-system and presentation reboot, not an engine/UX semantics rewrite:

1. preserve the existing Stage 0/1/2/3 behavior contract and CLI contract,
2. preserve research-honest language constraints and artifact integrity,
3. replace the visual language, density, hierarchy, and finish quality end-to-end.

Primary user-visible outcome:
`arbiter` should look like a first-class flagship terminal product in real use, not just in docs.

## Progress
- [x] (2026-03-04 04:34Z) reboot plan drafted from benchmark research and post-implementation misalignment analysis (`proposed`)
- [x] (2026-03-04 13:40Z) review round A complete (internal spec coherence and ambiguity audit)
- [x] (2026-03-04 13:52Z) review round B complete (expanded screen-deck pass integrated)
- [ ] (pending) visual reboot contract freeze complete (style, hierarchy, motion, hero treatment)
- [ ] (pending) copy and visual cohesion freeze complete (cross-stage tone + layout pairing)
- [ ] (pending) Stage 1 visual reboot implemented and screenshot-audited
- [ ] (pending) Stage 2 visual reboot implemented and screenshot-audited
- [ ] (pending) Stage 3 visual reboot implemented and screenshot-audited
- [ ] (pending) final visual sign-off evidence captured and docs synchronized (`completed`)

## Surprises & Discoveries
- Observation: the prior completed visual plan delivered coherent structure but under-shot perceived premium quality for target taste.
  Evidence: post-implementation user feedback and screenshot review in thread.
- Observation: text/contract validation alone can pass while visual quality is still unsatisfactory.
  Evidence: all test gates passing despite explicit end-user quality rejection.
- Observation: high-quality terminal tools emphasize hierarchy, contrast, rhythm, and compositional confidence more than raw color count.
  Evidence: reference reviews of `lazygit`, `lazydocker`, `k9s`, `btop`, `glow`.
- Observation: no single industry-standard AI-agent TUI visual QA stack exists; successful teams compose PTY + emulator + screenshot tooling.
  Evidence: VHS architecture (`ttyd` + browser renderer), Textual framework snapshot model, termwright direction.

## Decision Log
- Decision: run a net-new visual reboot plan instead of incremental polish patches.
  Rationale: current baseline is materially misaligned with target quality bar.
  Date/Author: 2026-03-04, Codex thread.
- Decision: preserve behavior semantics and contracts from `docs/product-specs/tui-wizard.md`; only visual/copy finish changes in this phase.
  Rationale: avoid reopening execution semantics while fixing quality of presentation.
  Date/Author: 2026-03-04, Codex thread.
- Decision: benchmark-driven design constraints are mandatory.
  Rationale: prevent subjective drift and overcorrection into either garishness or sterile restraint.
  Date/Author: 2026-03-04, Codex thread.
- Decision: visual acceptance requires rendered screenshot evidence from end-user-equivalent terminal emulation.
  Rationale: code-path audits are necessary but insufficient for UI quality.
  Date/Author: 2026-03-04, Codex thread.
- Decision: adopt dual visual audit paths.
  Rationale: in-repo path is portable and immediate; `ttyd` path is interactive and mirrors VHS-style tooling.
  Date/Author: 2026-03-04, Codex thread.
- Decision: Stage 2/3 sentinel headers (`═══ RUN ═══` and `═══ RECEIPT ═══`) are in visual reboot scope and may be upgraded during M0 contract freeze.
  Rationale: sentinels are high-visibility visual identity elements; if changed, copy deck LOCKED values and PTY assertions must be updated atomically in the same milestone commit.
  Date/Author: 2026-03-04, Codex thread.

## Context and Orientation
Reviewed before drafting this plan:

1. `AGENTS.md` for invariants, quality gates, and architecture boundaries.
2. `docs/PLANS.md` and `docs/exec-plans/README.md` for ExecPlan requirements and status conventions.
3. `docs/product-specs/tui-wizard.md` for immutable behavior contracts.
4. `docs/product-specs/tui-copy-deck.md` for copy ownership and runtime language constraints.
5. `docs/product-specs/tui-visual-screen-deck.md` for concrete visual layout targets by stage and width tier.
6. `docs/exec-plans/2026-03-02-wizard-visual-polish-overhaul.md` for prior design decisions and what was delivered.
7. `src/ui/wizard/app.ts`, `src/ui/wizard-theme.ts`, `src/ui/run-lifecycle-hooks.ts`, `src/ui/fmt.ts` for current implementation seams.
8. `scripts/tui-visual-capture.mjs`, `scripts/tui-terminal-viewer.html` for current visual inspection pipeline.
9. External reference projects:
   - `https://github.com/jesseduffield/lazygit`
   - `https://github.com/jesseduffield/lazydocker`
   - `https://github.com/derailed/k9s`
   - `https://github.com/aristocratos/btop`
   - `https://github.com/charmbracelet/glow`
   - `https://github.com/charmbracelet/bubbletea`
   - `https://github.com/charmbracelet/lipgloss`
   - `https://github.com/charmbracelet/vhs`
   - `https://github.com/tsl0922/ttyd`
10. Local OpenCLAW references:
   - `/Users/darylkang/Developer/openclaw/src/tui/theme/theme.ts`
   - `/Users/darylkang/Developer/openclaw/src/terminal/palette.ts`

Non-obvious terms:

1. Premium reboot: complete visual language replacement across all runtime surfaces without changing behavior semantics.
2. Hero treatment: persistent brand/masthead treatment with strong typographic and compositional identity.
3. Hierarchy rhythm: consistent spacing, border weight, and contrast cadence that makes screen scanning effortless.
4. Visual audit pack: ordered screenshot set of every major stage and transition from the same captured run.

High-risk areas:

1. overcorrecting into visual noise (too many accents/motion),
2. aesthetic drift across Stage 1/2/3 due to uncentralized render primitives,
3. rendering mismatch between local terminal and QA emulator pipeline,
4. accidental behavior regressions while restructuring visual composition.

## Plan of Work
Ordering principle: lock premium quality rubric and audit method first, then implement stage-by-stage with screenshot-based gates.

Pre-implementation review-cycle rule:

1. run at least two documented review cycles before M2 code implementation starts,
2. each review cycle must produce concrete doc deltas (not comments only),
3. unresolved P1-level ambiguities block M2 start.

Milestones:

1. M0: review round A and B completed; visual contract freeze complete (including explicit sentinel header format decision).
2. M1: audit contract freeze complete (what must be captured, how reviewed, pass/fail criteria).
3. M2: Stage 1 reboot implementation (hero, spine, cards, selectors, controls).
4. M3: Stage 2 reboot implementation (dashboard hierarchy, motion, density, status clarity).
5. M4: Stage 3 reboot implementation (receipt prominence, closure quality, final scrollback composition).
6. M5: cross-stage harmony pass. Gate: side-by-side screenshots confirm consistent card border grammar, card width constraints, accent usage pattern, and spacing rhythm across Stage 1/2/3.
7. M6: validation, evidence packaging, and doc sync.

Design constraints for this reboot:

1. no “clinical minimalism” failure mode,
2. no novelty gimmicks (CRT filters, heavy blink, chaotic effects),
3. rich but disciplined color hierarchy with amber/teal dual-accent,
4. clearly distinctive brand character at first glance (letter-spaced `A R B I T E R` nameplate),
5. stable readability in long sessions and any terminal width (minimum 60 columns),
6. **inline rail composition**: Stage 1 renders as a single vertical document where content expands under the active `◆` marker, indented by `│` continuation lines. Completed steps show `✔` with inline summaries. No box-bordered cards.
7. glyph-native selectors for prompt options (`○/●`, `□/■`) instead of bracket checkboxes,
8. app-shell composition with top status strip, primary content region, and command footer,
9. **width-agnostic layout**: no split-pane or narrow/wide mode switching. One rendering path for all widths.
10. Stage 2 shows one master progress bar plus one progress bar per async worker,
11. brand identity block appears only on Step 0 entry path; subsequent steps and stages use status strip,
12. no borrowed tab/navigation rows are introduced unless behavior is explicitly specified in `tui-wizard.md`,
13. preflight rows use checklist semantics (`✓`, `⚠`, `✗`), not navigation glyph semantics,
14. **ruled-section grammar**: Stage 2/3 sections use `── LABEL ──` horizontal rules instead of bordered cards,
15. **bracketless progress bars**: `████░░░ {pct}%` without `[` `]` wrapping,
16. each glyph has exactly one semantic role — rail glyphs (`◆/◇/✔`), selection glyphs (`●/○`, `■/□`), preflight glyphs (`✓/⚠/✗`) are never mixed.

Concrete visual targets (frozen in M0 before implementation):

Source of truth:

1. `docs/product-specs/tui-visual-screen-deck.md` is the canonical stage-by-stage visual layout deck.
2. The examples below summarize anchor screens for quick scan and must remain aligned with the visual screen deck.

1. Stage 0 + Step 0 composition target (inline rail with brand identity block):

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

2. Stage 2 dashboard composition target (frozen rail + ruled sections + bracketless bars):

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

W1  ████████░░  42%  running  trial 28  gpt-5
W2  ██████████  58%  idle     trial 19  gpt-4.1-mini
W3  ███████░░░  21%  running  trial 27  gpt-5

───────────────────────────────────────────────────────────────────────────────
Ctrl+C graceful stop
```

3. Stage 3 receipt composition target (ruled sections, key-value summary):

```text
[frozen rail summary — all steps ✔]
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

M0 freeze deliverables:

1. screen deck approved for Step 0 through Step 7, Stage 2, and Stage 3 with inline-rail wireframes,
2. sentinel decision recorded: `── PROGRESS ──` replaces `═══ RUN ═══`, `── RECEIPT ──` replaces `═══ RECEIPT ═══`,
3. brand treatment frozen: letter-spaced `A R B I T E R` nameplate on Step 0 only, status strip on all other screens,
4. copy deck and screen deck cross-checked for LOCKED/FLEX alignment,
5. glyph vocabulary frozen: rail (`◆/◇/✔`), selection (`●/○`, `■/□`), preflight (`✓/⚠/✗`), progress (`█/░`),
6. color palette frozen: amber (`#fabd2f`) primary accent, teal (`#83a598`) structural accent, with 256-color and 16-color fallback codes.

## Visual Evaluation Framework (End-User Reality Loop)
This framework is mandatory for every reboot milestone. Code-level review alone is insufficient.

Evaluation inputs (both required):

1. Deterministic emulator pass:
   - PTY snapshot capture + xterm.js replay screenshots (`scripts/tui-visual-capture.mjs`, `scripts/tui-terminal-viewer.html`).
   - Purpose: stable, repeatable side-by-side comparisons.
2. End-user runtime pass:
   - Real `arbiter` flow in a live TTY environment representative of actual user usage.
   - Record terminal profile evidence (`TERM`, `COLORTERM`, `NO_COLOR`) plus screenshots.
   - Purpose: verify what users actually see, not just emulator output.

Evaluation scorecard (1-5 each; weighted):

1. hierarchy clarity under scan (20%)
2. compositional confidence and rhythm (15%)
3. brand distinctiveness/memorability (15%)
4. status readability and semantic color clarity (15%)
5. data-density legibility in Stage 2 (15%)
6. motion quality (functional, non-distracting) (10%)
7. fallback robustness across terminal capability tiers (10%)

Score calibration anchors:

1. 5/5 hierarchy clarity: primary action and current step are immediately obvious in under two seconds with no visual hunting.
2. 3/5 hierarchy clarity: current step is discoverable but competes with secondary information.
3. 5/5 brand distinctiveness: first screen is unmistakably Arbiter without relying on novelty effects.
4. 3/5 brand distinctiveness: competent but interchangeable with generic CLI cards.
5. 5/5 data-density legibility: Stage 2 shows all critical metrics without cramped wrapping at target widths.
6. 3/5 data-density legibility: complete but visually dense enough to slow scan speed.

Gate thresholds:

1. no category below 4.0
2. weighted overall score at least 4.3 / 5.0
3. zero “critical visual defects” (layout break, illegible status, clipped content, severe contrast miss, inconsistent stage grammar)

Critical visual defects (automatic gate failure):

1. user cannot quickly identify current step or primary action,
2. warning/error/success states are visually ambiguous,
3. stage composition appears broken or unstable,
4. key UI text appears cramped, clipped, or visually noisy,
5. product reads “generic/basic” in first-screen impression review.

Milestone advancement rule:

1. A milestone is not complete until the scorecard passes on both deterministic and end-user runtime inputs.
2. If scores conflict between deterministic and end-user runtime passes, end-user runtime result is authoritative.

Evaluator role:

1. implementing agent captures screenshots and assembles the evidence pack.
2. milestone scoring is performed by the user or a designated review agent that did not implement the milestone.
3. implementing-agent self-scores are advisory only and cannot independently advance a milestone.
4. if no independent reviewer is available, user approval of the screenshot pack is required to advance.

## Concrete Steps
Working directory: repository root.

1. Run review round A (internal coherence and ambiguity audit) on:
   - `docs/exec-plans/2026-03-04-premium-visual-reboot.md`
   - `docs/product-specs/tui-copy-deck.md`
   - `docs/product-specs/tui-visual-screen-deck.md`
   Commands:
   - `rg -n "LOCKED|FLEX|Stage 0|Study Summary|RUN|RECEIPT|COLUMNS" docs/product-specs docs/exec-plans/2026-03-04-premium-visual-reboot.md -S`
   Expected evidence: ambiguity log resolved with explicit wording updates.

2. Run review round B (independent critique pass) and integrate required edits.
   Commands:
   - N/A (review feedback integration step)
   Expected evidence: second-round critique items mapped to doc changes with no unresolved P1 blockers.

3. Baseline current visuals for fail-before evidence.
   Commands:
   - `npm run build`
   - `node scripts/tui-visual-capture.mjs`
   Expected evidence: ANSI checkpoints saved under `output/playwright/tui-visual/<timestamp>/`.

4. Render baseline screenshots from ANSI checkpoints.
   Commands:
   - `python -m http.server 4173 --bind 127.0.0.1`
   - use Playwright MCP to load `scripts/tui-terminal-viewer.html`, replay checkpoints, and save PNGs.
   Expected evidence: baseline screenshot pack with Stage 0, Step 3, Step 7, Stage 2, Stage 3.

5. Capture baseline end-user runtime screenshots (non-emulated).
   Commands:
   - `echo "TERM=$TERM COLORTERM=$COLORTERM NO_COLOR=${NO_COLOR:-}"` (in user runtime shell)
   - run `arbiter` in real TTY and capture screenshots for Stage 0, Step 3, Step 7, Stage 2, Stage 3.
   Expected evidence: baseline real-usage screenshot pack and terminal profile metadata.

6. Freeze premium visual rubric in this plan (no code changes yet).
   Commands:
   - N/A (doc update step)
   Expected evidence: rubric section complete with weighted criteria and rejection criteria, and M0 records whether sentinels are retained or replaced.

7. Freeze visual audit standard in this plan.
   Commands:
   - N/A (doc update step)
   Expected evidence: required screenshot sequence, viewport, terminal profile, and approval checklist defined.

8. Implement Stage 1 reboot against frozen contract.
   Commands:
   - `rg -n "renderStepFrame|renderMasthead|renderProgressSpine|renderCard|selectOne|selectMany|Research Question" src/ui -S`
   - `npm run build && npm run test:ui`
   Expected evidence: Stage 1 screenshots visibly match contract and pass behavior tests.

9. Implement Stage 2 reboot against frozen contract.
   Commands:
   - `rg -n "buildRunDashboardText|Master progress|Monitoring|Workers|Usage|renderTick" src/ui -S`
   - `npm run build && npm run test:ui`
   Expected evidence: Stage 2 screenshot quality and motion meet contract; no behavior regressions.

10. Implement Stage 3 reboot against frozen contract.
   Commands:
   - `rg -n "receipt|RECEIPT|readReceiptText|receipt.txt" src/ui -S`
   - `npm run build && npm run test:ui`
   Expected evidence: Stage 3 closure quality improved while preserving plain-text artifact integrity.

11. Run visual evaluation loop and scorecard before final test gates.
   Commands:
   - regenerate deterministic screenshot pack
   - regenerate end-user runtime screenshot pack
   - score both packs against framework and record decisions in an evaluation report.
   Expected evidence: completed scorecard with pass/fail per category and explicit defect log.

12. Run full quality gates and package evidence.
   Commands:
   - `npm run check:types`
   - `npm run check:schemas`
   - `npm run test:mock-run`
   - `npm run test:templates`
   - `npm run test:verify`
   - `npm run test:debate`
   - `npm run test:clustering`
   - `npm run test:embeddings`
   - `npm run test:pack`
   - `npm run test:ui`
   - `npm run test:cli-contracts`
   - `npm run test:unit`
   Expected evidence: all pass + before/after visual pack.

## Validation and Acceptance
Behavior acceptance (must remain true):

1. Step order, validation gating, and commit-point semantics remain as specified in `docs/product-specs/tui-wizard.md`.
2. Headless CLI behavior remains unchanged.
3. `receipt.txt` remains ANSI-free and semantically stable.
4. Stage-stack behavior remains: brand identity block (Step 0 only), frozen Stage 1 rail summary, Stage 2 live/final snapshot, Stage 3 appended receipt.
5. M2+ implementation does not begin until M0 review rounds A/B and contract freeze are complete.

Premium visual acceptance (must all pass):

1. First-screen impression test: Step 0 with letter-spaced `A R B I T E R` brand immediately reads as premium and distinctive, not generic.
2. Hierarchy test: current action, warnings, and status-critical data are visually obvious within two seconds.
3. Rhythm test: spacing cadence is consistent across Stage 1/2/3 — inline rail, ruled sections, key-value rows all share the same vertical rhythm.
4. Density test: Stage 2 is information-rich without crowding.
5. Restraint test: motion is functional and non-distracting; no decorative animation.
6. Distinctiveness test: UI is recognizable as Arbiter, not interchangeable with stock TUIs.
7. Readability test: no layout breakage at any width (`>=60` cols) and no semantic ambiguity in status colors.
8. Copy+visual cohesion test: tone and visual prominence align (no severe mismatch between “premium look” and flat wording).
9. Inline-rail test: Stage 1 uses inline rail where content expands under active `◆` marker. No box-bordered cards. No detached spine list.
10. Selector-glyph test: binary and multi-select prompts use glyph-native controls (no `[ ]` or `[x]`).
11. App-shell test: each major surface includes top status strip + primary region + command footer.
12. Ruled-section test: Stage 2/3 sections use `── LABEL ──` ruled headers, not bordered cards.
13. Multi-progress test: Stage 2 shows one bracketless master progress bar and one per-worker bracketless progress bar for each visible worker row.
14. Color-presence test: amber/teal dual-accent is visible. Focus, status, and progress states are colorized in runtime captures (not monochrome/basic look), while staying within disciplined palette rules.
15. Width-agnostic test: same rendering algorithm works at 60, 80, 100, and 120 columns without layout mode switching.

Required visual evidence pack:

1. Step 0 entry
2. Step 0 run mode
3. Step 1 question
4. Step 2 protocol
5. Step 3 models
6. Step 4 personas
7. Step 5 decode
8. Step 6 advanced
9. Step 7 review
10. Stage 2 run dashboard (mid-run and terminal state near completion)
11. Stage 3 final receipt
12. Step 0 entry at narrow width (`COLUMNS=60`) — verifies width-agnostic rendering,
13. Stage 2 dashboard at narrow width (`COLUMNS=60`) — verifies width-agnostic rendering,
14. Stage 2 dashboard at higher parallelism (`workers=8`) with one master bar plus one worker bar per visible worker.

Required evaluation artifacts:

1. deterministic screenshot pack (`output/playwright/tui-visual/<timestamp>/`)
2. end-user runtime screenshot pack (`output/playwright/tui-user-runtime/<timestamp>/` or equivalent documented location)
3. visual scorecard report with category scores, weighted result, and gating decision
4. defect log (resolved vs deferred), with screenshot references
5. reviewer sign-off record (user or designated independent reviewer)

Visual audit tooling acceptance:

1. In-repo PTY pipeline works:
   - `scripts/tui-visual-capture.mjs`
   - `scripts/tui-terminal-viewer.html`
2. Optional live-webtty pipeline documented and reproducible when `ttyd` is installed:
   - `ttyd -p 7681 node dist/cli/index.js`
   - Playwright navigates to `http://127.0.0.1:7681` and captures equivalent flow screenshots.

## Idempotence and Recovery
Safe rerun boundaries:

1. visual capture scripts are non-mutating to source code and can be rerun repeatedly.
2. each milestone is isolated by stage; rollback is file-level via git commit boundaries.
3. if a stage implementation degrades behavior tests, revert only that milestone commit and keep prior stage commits.

Recovery procedure:

1. restore last known-good commit,
2. regenerate baseline screenshots,
3. reapply stage-specific changes with smaller diff chunks,
4. rerun quality gates before proceeding.

## Interfaces and Dependencies
Code interfaces:

1. `src/ui/fmt.ts` (formatter seam),
2. `src/ui/wizard-theme.ts` (theme/layout primitives),
3. `src/ui/wizard/app.ts` (Stage 1 composition),
4. `src/ui/run-lifecycle-hooks.ts` (Stage 2/3 composition).

Audit dependencies:

1. existing: `@homebridge/node-pty-prebuilt-multiarch`, Playwright MCP.
2. optional external for live webtty audits: `ttyd` binary.

## Artifacts and Notes
Benchmark rubric (weighted):

1. hierarchy clarity under scan (20%)
2. compositional confidence and rhythm (15%)
3. brand distinctiveness/memorability (15%)
4. status readability and semantic color clarity (15%)
5. data-density legibility in Stage 2 (15%)
6. motion quality (functional, non-distracting) (10%)
7. fallback robustness across terminal capability tiers (10%)

Scorecard template (per milestone):

1. hierarchy clarity under scan: `<score>/5` (weight: 20%)
2. compositional confidence and rhythm: `<score>/5` (weight: 15%)
3. brand distinctiveness/memorability: `<score>/5` (weight: 15%)
4. status readability and semantic color clarity: `<score>/5` (weight: 15%)
5. data-density legibility in Stage 2: `<score>/5` (weight: 15%)
6. motion quality (functional, non-distracting): `<score>/5` (weight: 10%)
7. fallback robustness across terminal capability tiers: `<score>/5` (weight: 10%)
8. weighted overall: `<computed>/5` (pass threshold `>= 4.3`)

Weighted overall is computed as the sum of each category score multiplied by its weight percentage.

Reference-derived adopt patterns:

1. `lazygit`/`lazydocker`: action-first hierarchy and keybinding discoverability.
2. `k9s`: skin/theme mindset with high information density.
3. `btop`: rich but legible visual telemetry and terminal capability adaptation.
4. `glow`/Charm stack: style-seam centralization and layout composability.
5. OpenCLAW local codebase: centralized palette+theme API and consistent component consumption.

Reference-derived avoid patterns:

1. overreliance on subtle grayscale hierarchy,
2. decorative animation that competes with content,
3. inconsistent card/header grammar between stages,
4. strict design decisions made from text-only audits without rendered screenshots.

## Plan Change Notes
- 2026-03-04 04:34Z: initial reboot plan created after explicit user rejection of prior restrained visual outcome and benchmark-driven research pass.
- 2026-03-04 12:10Z: hardened reboot gates with independent evaluator ownership, weighted scorecard alignment, measurable M5 criteria, narrow-width evidence requirements, and concrete ASCII target layouts.
- 2026-03-04 12:20Z: expanded to full review-cycle workflow with explicit pre-implementation two-round critique requirement and cross-links to canonical visual screen deck.
- 2026-03-04 13:52Z: completed two doc hardening rounds, added score calibration anchors, and promoted full-stage visual deck to canonical layout source.
- 2026-03-05 00:13Z: incorporated premium motif constraints from rendered benchmark review (border-integrated rail, timeline markers, glyph-native selectors) and elevated them to acceptance gates.
- 2026-03-05 00:21Z: escalated visual contract toward Claude Code/OpenClaw parity with app-shell framing, split-pane emphasis, and upgraded ASCII targets for Step 0 run mode, Step 4 personas, and narrow-mode shells.
- 2026-03-05 00:37Z: added explicit color-system contract and Stage 2 multi-progress-bar requirement (one master plus per-worker bars), including acceptance and evidence updates.
- 2026-03-05 01:07Z: adopted Round C aesthetic hardening updates (compact hero, strict split-card Stage 1 grammar, preflight checklist symbols, metadata badges, and table-grade Stage 2 readout alignment).
- 2026-03-05 01:09Z: removed tab-artifact styling from models wireframes, separated rail vs multi-select glyph semantics, and aligned narrow-mode examples with stacked-rail rules.
- 2026-03-05 02:30Z: complete visual direction overhaul to inline-rail composition. Replaced bordered split-card grammar with single-column inline rail where content expands under active `◆` marker. Replaced box-bordered cards with `── LABEL ──` ruled sections. Added bracketless progress bars, letter-spaced brand nameplate, amber/teal dual-accent color scheme. Eliminated width-tier switching (now width-agnostic). Updated sentinels (`═══ RUN ═══` → `── PROGRESS ──`, `═══ RECEIPT ═══` → `── RECEIPT ──`). Replaced frozen Study Summary card with frozen rail summary. Added implementation guide with file-level mapping for Codex.
