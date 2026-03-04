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
5. `docs/exec-plans/2026-03-02-wizard-visual-polish-overhaul.md` for prior design decisions and what was delivered.
6. `src/ui/wizard/app.ts`, `src/ui/wizard-theme.ts`, `src/ui/run-lifecycle-hooks.ts`, `src/ui/fmt.ts` for current implementation seams.
7. `scripts/tui-visual-capture.mjs`, `scripts/tui-terminal-viewer.html` for current visual inspection pipeline.
8. External reference projects:
   - `https://github.com/jesseduffield/lazygit`
   - `https://github.com/jesseduffield/lazydocker`
   - `https://github.com/derailed/k9s`
   - `https://github.com/aristocratos/btop`
   - `https://github.com/charmbracelet/glow`
   - `https://github.com/charmbracelet/bubbletea`
   - `https://github.com/charmbracelet/lipgloss`
   - `https://github.com/charmbracelet/vhs`
   - `https://github.com/tsl0922/ttyd`
9. Local OpenCLAW references:
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

Milestones:

1. M0: freeze premium visual contract and benchmark rubric, including explicit sentinel header format decision.
2. M1: freeze audit contract (what must be captured, how reviewed, pass/fail criteria).
3. M2: Stage 1 reboot implementation (hero, spine, cards, selectors, controls).
4. M3: Stage 2 reboot implementation (dashboard hierarchy, motion, density, status clarity).
5. M4: Stage 3 reboot implementation (receipt prominence, closure quality, final scrollback composition).
6. M5: cross-stage harmony pass. Gate: side-by-side screenshots confirm consistent card border grammar, card width constraints, accent usage pattern, and spacing rhythm across Stage 1/2/3.
7. M6: validation, evidence packaging, and doc sync.

Design constraints for this reboot:

1. no “clinical minimalism” failure mode,
2. no novelty gimmicks (CRT filters, heavy blink, chaotic effects),
3. rich but disciplined color hierarchy,
4. clearly distinctive brand character at first glance,
5. stable readability in long sessions and narrow terminal widths.

Concrete visual targets (frozen in M0 before implementation):

1. Stage 0 + Step 0 composition target:

```text
╭─ ARBITER ───────────────────────────────────────────────────────────────╮
│ Distributional reasoning harness                                         │
│ Version x.y.z                                                            │
│ Environment  API key: detected  Mode: Mock  Configs in CWD: 3            │
╰───────────────────────────────────────────────────────────────────────────╯

╭─ Stage 1 / Setup ────────────────────────────────────────────────────────╮
│ ◆ Research Question                                                      │
│ · Protocol                                                               │
│ · Models                                                                 │
│ · Personas                                                               │
│ · Decode Parameters                                                      │
│ · Advanced Settings                                                      │
│ · Review and Confirm                                                     │
╰───────────────────────────────────────────────────────────────────────────╯

╭─ Entry Path ─────────────────────────────────────────────────────────────╮
│ ▸ Create new study                                                       │
│   Run existing config (unavailable)                                      │
╰───────────────────────────────────────────────────────────────────────────╯
```

2. Stage 2 dashboard composition target:

```text
[frozen masthead]
[frozen study summary card]

╭─ RUN ─────────────────────────────────────────────────────────────────────╮
│ Progress  28/80  [███████████░░░░░░░░░░░░░░] 35%                        │
│ Elapsed 00:02:12  ETA 00:04:03                                           │
╰───────────────────────────────────────────────────────────────────────────╯

╭─ Monitoring ─────────────────────────────────────────────────────────────╮
│ Novelty rate: 0.18     Patience: 2/4     Stop signal: continue           │
│ Stopping indicates diminishing novelty, not correctness.                 │
╰───────────────────────────────────────────────────────────────────────────╯
```

3. Stage 3 receipt composition target:

```text
[frozen masthead]
[frozen study summary card]
[final Stage 2 snapshot]

╭─ RECEIPT ─────────────────────────────────────────────────────────────────╮
│ Stopped: novelty saturation                                               │
│ Trials completed: 64 / 80                                                 │
│ Eligible: 60  Failed: 4                                                   │
│ Artifacts written: manifest.json, trials.jsonl, monitoring.jsonl, ...    │
│ Stopping indicates diminishing novelty, not correctness.                  │
╰───────────────────────────────────────────────────────────────────────────╯
```

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

1. Baseline current visuals for fail-before evidence.
   Commands:
   - `npm run build`
   - `node scripts/tui-visual-capture.mjs`
   Expected evidence: ANSI checkpoints saved under `output/playwright/tui-visual/<timestamp>/`.

2. Render baseline screenshots from ANSI checkpoints.
   Commands:
   - `python -m http.server 4173 --bind 127.0.0.1`
   - use Playwright MCP to load `scripts/tui-terminal-viewer.html`, replay checkpoints, and save PNGs.
   Expected evidence: baseline screenshot pack with Stage 0, Step 3, Step 7, Stage 2, Stage 3.

3. Capture baseline end-user runtime screenshots (non-emulated).
   Commands:
   - `echo "TERM=$TERM COLORTERM=$COLORTERM NO_COLOR=${NO_COLOR:-}"` (in user runtime shell)
   - run `arbiter` in real TTY and capture screenshots for Stage 0, Step 3, Step 7, Stage 2, Stage 3.
   Expected evidence: baseline real-usage screenshot pack and terminal profile metadata.

4. Freeze premium visual rubric in this plan (no code changes yet).
   Commands:
   - N/A (doc update step)
   Expected evidence: rubric section complete with weighted criteria and rejection criteria, and M0 records whether sentinels are retained or replaced.

5. Freeze visual audit standard in this plan.
   Commands:
   - N/A (doc update step)
   Expected evidence: required screenshot sequence, viewport, terminal profile, and approval checklist defined.

6. Implement Stage 1 reboot against frozen contract.
   Commands:
   - `rg -n "renderStepFrame|renderMasthead|renderProgressSpine|renderCard|selectOne|selectMany|Research Question" src/ui -S`
   - `npm run build && npm run test:ui`
   Expected evidence: Stage 1 screenshots visibly match contract and pass behavior tests.

7. Implement Stage 2 reboot against frozen contract.
   Commands:
   - `rg -n "buildRunDashboardText|Master progress|Monitoring|Workers|Usage|renderTick" src/ui -S`
   - `npm run build && npm run test:ui`
   Expected evidence: Stage 2 screenshot quality and motion meet contract; no behavior regressions.

8. Implement Stage 3 reboot against frozen contract.
   Commands:
   - `rg -n "receipt|RECEIPT|readReceiptText|receipt.txt" src/ui -S`
   - `npm run build && npm run test:ui`
   Expected evidence: Stage 3 closure quality improved while preserving plain-text artifact integrity.

9. Run visual evaluation loop and scorecard before final test gates.
   Commands:
   - regenerate deterministic screenshot pack
   - regenerate end-user runtime screenshot pack
   - score both packs against framework and record decisions in an evaluation report.
   Expected evidence: completed scorecard with pass/fail per category and explicit defect log.

10. Run full quality gates and package evidence.
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
4. Stage-stack behavior remains: Stage 0 masthead, frozen Stage 1 summary, Stage 2 live/final snapshot, Stage 3 appended receipt.

Premium visual acceptance (must all pass):

1. First-screen impression test: Stage 0 immediately reads as branded and high-quality, not generic.
2. Hierarchy test: current action, warnings, and status-critical data are visually obvious within two seconds.
3. Rhythm test: spacing and border cadence is consistent across Stage 1/2/3.
4. Density test: Stage 2 is information-rich without crowding.
5. Restraint test: motion is functional and non-distracting; no decorative animation.
6. Distinctiveness test: UI is recognizable as Arbiter, not interchangeable with stock TUIs.
7. Readability test: no layout breakage at narrow mode (`<100` cols) and no semantic ambiguity in status colors.
8. Copy+visual cohesion test: tone and visual prominence align (no severe mismatch between “premium look” and flat wording).

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
12. Step 0 entry at narrow width (`COLUMNS=90`)
13. Stage 2 dashboard at narrow width (`COLUMNS=90`)

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
- 2026-03-04 17:10Z: hardened reboot gates with independent evaluator ownership, weighted scorecard alignment, measurable M5 criteria, narrow-width evidence requirements, and concrete ASCII target layouts.
