# Overhaul Wizard Visual and Copy System for Warm Instrument Clarity

This ExecPlan is a living document and must be updated as work proceeds.
This plan follows `docs/PLANS.md`.

## Purpose / Big Picture
Deliver a premium visual and copy overhaul for Arbiter's Wizard/Dashboard/Receipt surfaces, including a persistent run-path stage stack (Stage 0 masthead + frozen Stage 1 summary + Stage 2/3), while preserving run semantics and artifact guarantees.

This plan is intentionally pre-implementation heavy. It defines the visual system, copy system, component contracts, motion rules, and validation method before any code changes.

Target visual direction:

1. Warm instrument clarity: structured, calm, information-dense.
2. Gruvbox-inspired palette tuned for extended terminal reading.
3. Rounded bubble/card composition language (inspired by OpenClaw's TUI polish pattern, not a copy).
4. Compact, distinctive title treatment with strong brand presence (no oversized figlet-style block art).
5. Shared design-system seam (tokens + render primitives), no one-off ANSI styling.
6. Premium touches through disciplined glyphs and restrained motion.
7. Product-grade copy system: clear, coherent, research-honest language with consistent terminology and interaction text patterns.

Observable user outcomes:

1. `arbiter` wizard no longer looks barebones; it looks deliberate and first-class.
2. Stage 1, Stage 2, and Stage 3 feel like one product, not separate outputs.
3. Information hierarchy is clearer: what is primary vs secondary is visually obvious.
4. Visual/copy polish does not alter study semantics, keybindings, or artifact behavior.
5. Non-TTY/headless behavior remains unchanged.
6. Copy reads as deliberate and premium across all stages, with no terminology drift or mixed voice.
7. Run-path layout preserves experiment context via a persistent masthead and frozen Study Summary above live/final run surfaces.

Scope guardrails:

1. In scope: visual language, color, spacing, borders, typography hierarchy, glyph usage, motion cues, rendering abstractions, user-facing copy rewrite for Stage 1-3 surfaces, and staged run-path composition (persistent masthead + frozen Stage 1 summary + stacked Stage 2/3).
2. Out of scope: step order, keybinding contract, protocol semantics, artifact semantics, stop logic, CLI command surface.
3. Out of scope: engine semantics, sampling behavior, stop-decision logic, and non-UI artifact contract changes.
4. Styling restraint is mandatory: no visual noise, no aggressive blinking, no novelty animation.
5. Design-first rule: visual contract decisions lead; UI tests are updated to reflect approved design output, not vice versa.
6. Copy-first rigor rule: copy decisions must remain research-honest and semantically accurate; polish must not add scientific or correctness claims.

## Progress
- [x] (2026-03-03 02:21Z) initial plan drafted (`proposed`)
- [x] (2026-03-03 02:39Z) design freeze spec expanded with exact tokens, glyph, motion, and component contracts
- [x] (2026-03-03 02:37Z) external review incorporated: blocker fixes and scope hardening added
- [ ] (pending) milestone 0 complete: visual and copy contracts ratified after external review
- [ ] (pending) milestone 1 complete: shared visual/copy seams and stage-stack scaffold implemented
- [ ] (pending) milestone 2 complete: Stage 1 visual and copy restyle implemented
- [ ] (pending) milestone 3 complete: Stage 2 visual and copy restyle implemented
- [ ] (pending) milestone 4 complete: Stage 3 visual and copy restyle implemented
- [ ] (pending) milestone 5 complete: cross-stage copy consistency verification and forbidden-term audit complete
- [ ] (pending) milestone 6 complete: validation evidence captured and docs synchronized (`completed`)

## Surprises & Discoveries
- Observation: current wizard rendering is concentrated in one file with inline frame output, which increases style drift risk if patched incrementally.
  Evidence: `src/ui/wizard/app.ts`.
- Observation: formatter already has color capability detection and gruvbox-adjacent values; that seam can be extended rather than replaced.
  Evidence: `src/ui/fmt.ts`.
- Observation: OpenClaw's maintainable polish pattern is not specific glyphs; it is centralized theme ownership and component-level consumption.
  Evidence: `/Users/darylkang/Developer/openclaw/src/terminal/palette.ts`, `/Users/darylkang/Developer/openclaw/src/tui/theme/theme.ts`.
- Observation: Arbiter currently has no dedicated wizard visual module, so first implementation step must be extraction before restyling.
  Evidence: `src/ui/wizard/app.ts`, `src/ui/premium/screens/` (empty).
- Observation: user-visible strings are currently distributed across wizard, lifecycle hooks, and receipt composition paths with no centralized copy contract.
  Evidence: `src/ui/wizard/app.ts`, `src/ui/run-lifecycle-hooks.ts`, `src/ui/receipt-model.ts`, `src/ui/receipt-text.ts`.
- Observation: receipt/dashboard caveat language already uses canonical phrasing and should be preserved, not rewritten for novelty.
  Evidence: `src/ui/receipt-text.ts`, `src/ui/run-lifecycle-hooks.ts`.
- Observation: current run path replaces screen regions via clear-screen and in-place redraw behavior; it does not persist a frozen Stage 1 summary above Stage 2/3.
  Evidence: `src/ui/wizard/app.ts`, `src/ui/run-lifecycle-hooks.ts`.

## Decision Log
- Decision: visual overhaul is phase-isolated from UX and architecture work.
  Rationale: UX contracts were stabilized recently; visual work should not re-open behavior churn.
  Date/Author: 2026-03-02, Codex thread.
- Decision: adopt "restrained expressiveness" as explicit visual doctrine.
  Rationale: premium feel should increase clarity, not theatrics.
  Date/Author: 2026-03-02, Codex thread.
- Decision: preserve all research-honest copy and terminology constraints.
  Rationale: styling cannot imply correctness/convergence claims.
  Date/Author: 2026-03-02, Codex thread.
- Decision: use a capability-tiered rendering strategy (unicode/color/no-color) instead of assuming modern terminal support.
  Rationale: prevents regressions for CI/headless/older terminal environments.
  Date/Author: 2026-03-03, Codex thread.
- Decision: visual design contract is authoritative; PTY sentinel test expectations must adapt atomically to approved design changes.
  Rationale: prevents legacy test literals from constraining the final design language.
  Date/Author: 2026-03-03, Codex thread.
- Decision: preserve `receipt.txt` as plain ANSI-free artifact and apply visual styling only at TTY display render pass.
  Rationale: artifact integrity and downstream parsing must not depend on terminal styling behavior.
  Date/Author: 2026-03-03, Codex thread.
- Decision: v1 responsiveness is two-tier (`>=100` wide, `<100` narrow), not four-tier.
  Rationale: keeps this phase design-only and avoids scope creep into layout-engine feature work.
  Date/Author: 2026-03-03, Codex thread.
- Decision: visual identity is warm instrument clarity, not retro pastiche or franchise homage.
  Rationale: Arbiter is a research instrument; visual language should communicate competence, warmth, and craftsmanship without IP mimicry or nostalgia gimmicks.
  Date/Author: 2026-03-03, Codex thread.
- Decision: copy overhaul ships in the same phase as visual overhaul, with a frozen copy contract before implementation.
  Rationale: visual polish without language coherence leaves the product feeling unfinished and inconsistent.
  Date/Author: 2026-03-03, Codex thread.
- Decision: all Stage 1-3 user-facing strings must be sourced from explicit copy contract ownership points (central module or equivalent).
  Rationale: prevents tone drift and terminology regressions during future edits.
  Date/Author: 2026-03-03, Codex thread.
- Decision: adopt hybrid stack composition for run path: persistent Stage 0 masthead, frozen Stage 1 Study Summary card, Stage 2 live region, Stage 3 receipt appended below Stage 2 final snapshot.
  Rationale: preserves experiment context without persisting full editable step transcripts.
  Date/Author: 2026-03-03, Codex thread.

## Context and Orientation
Reviewed before finalizing this plan:

1. `AGENTS.md` for invariants, quality gates, and architecture boundaries.
2. `docs/PLANS.md` for required ExecPlan structure.
3. `docs/product-specs/tui-wizard.md` for immutable behavior contract.
4. `docs/DESIGN.md` for run semantics and claims discipline.
5. `src/ui/wizard/app.ts` for current stage rendering and input interaction.
6. `src/ui/run-lifecycle-hooks.ts` for Stage 2 and Stage 3 display lifecycle.
7. `src/ui/receipt-text.ts`, `src/ui/receipt-model.ts` for receipt printout structure.
8. `src/ui/fmt.ts` for terminal capability detection and baseline style helpers.
9. `scripts/tui-intent.mjs`, `scripts/tui-headless.mjs`, `scripts/tui-command-smoke.mjs`, `test/e2e/tui-pty.test.mjs` for behavior regression guards.
10. `/Users/darylkang/Developer/openclaw/src/terminal/palette.ts`, `/Users/darylkang/Developer/openclaw/src/tui/theme/theme.ts` for maintainable theme architecture patterns.
11. `docs/product-specs/tui-wizard.md` terminology rules and wording constraints for research-honest copy.
12. `docs/product-specs/tui-copy-deck.md` as the canonical per-surface copy source for implementation and review.

Non-obvious terms used in this plan:

1. Visual seam: dedicated internal module exposing all style tokens and rendering helpers.
2. Bubble/card: grouped content inside soft-corner frame treatment with consistent padding and header style.
3. Capability tier:
   - tier A: unicode + color (extended color capable),
   - tier B: color + ASCII box fallback,
   - tier C: plain ASCII/no-color fallback.
4. Motion budget: strict allowed animation set, cadence, and screen coverage limits.

High-risk components:

1. Accidental behavior changes while extracting rendering out of `src/ui/wizard/app.ts`.
2. ANSI-heavy styling causing wrap/cropping issues in narrower terminals.
3. Motion effects interfering with readability or logs.
4. Inconsistent stage styling if Stage 2/3 are restyled without shared primitives.
5. Copy drift causing mixed terminology (`cluster` vs `group`, correctness language, inconsistent stop-reason phrasing).
6. Stage-stack composition regressions (for example Stage 1 summary disappearing during Stage 2 redraws).

## Plan of Work
Ordering principle: freeze stage-composition + visual+copy contracts first, then implement shared seams and stack scaffold, then migrate stages sequentially, then validate behavior and language parity.

Implementation sequence:

1. Freeze visual contract in this plan:
   - exact token table,
   - glyph vocabulary and allowed contexts,
   - motion vocabulary and cadence,
   - color usage budget,
   - width breakpoints and fallback rules.
2. Freeze copy contract in this plan:
   - voice/tone attributes,
   - terminology canon and forbidden terms,
   - component-level microcopy patterns,
   - stage-by-stage required strings and caveat lines.
3. Freeze stage-composition contract:
   - persistent Stage 0 masthead in run path,
   - frozen Stage 1 Study Summary card after `Run now`,
   - Stage 2 region below summary,
   - Stage 3 appended below final Stage 2 snapshot.
4. Implement shared visual seam module(s), copy seam module(s), and staged stack rendering scaffold.
5. Extract Stage 1 rendering into delegated renderer helpers before styling (behavior callbacks remain in place).
6. Restyle and rewrite Stage 1 copy (wizard intake) and define frozen Study Summary card rendering.
7. Restyle and rewrite Stage 2 copy (dashboard) using same primitives and stack constraints.
8. Restyle and rewrite Stage 3 copy (receipt) with static, high-legibility output and no interactive follow-up UI.
9. Run contract-focused tests and capture before/after output evidence.

Milestones:

1. Milestone 0: visual and copy contract freeze and review.
2. Milestone 1: shared visual/copy seam extraction and stage-stack scaffold.
3. Milestone 2: Stage 1 visual and copy migration with frozen summary card.
4. Milestone 3: Stage 2 visual and copy migration in stacked layout.
5. Milestone 4: Stage 3 visual and copy migration in stacked layout.
6. Milestone 5: cross-stage copy consistency verification and forbidden-term audit.
7. Milestone 6: test/capture/docs verification.

Milestone entry and exit gates:

1. Milestone 0 exit gate:
   - token table, glyph set, motion set, breakpoints, fallback map, copy contract, and stage-composition contract are complete and review-ready.
   - `docs/product-specs/tui-copy-deck.md` exists with Stage 1-3 copy coverage and `LOCKED` vs `FLEX` line ownership.
2. Milestone 1 exit gate:
   - no stage path uses ad-hoc ANSI literals for palette/border/chip styles.
   - no stage path uses unmanaged inline user-facing copy literals (outside approved copy ownership modules).
   - all stage style and copy calls route through shared seam helpers/modules.
   - seam module path(s) are explicitly recorded in this plan at Milestone 1 entry.
   - `rg -n "\\x1b\\[[0-9;]*m" src/ui --glob '!fmt.ts'` returns zero SGR style ANSI escapes outside the recorded seam module path(s).
   - terminal control sequences for screen/cursor control are allowed inline.
   - copy-seam boundary checks confirm canonical strings are centralized only where required by the ownership boundary contract.
   - run-path scaffold preserves fixed Stage 0/Stage 1 summary region while allowing Stage 2 redraws below.
3. Milestone 2 exit gate:
   - Stage 1 visuals and copy upgraded.
   - Stage 1 rendering functions delegate to renderer seam helpers; key handling and validation callbacks remain in `src/ui/wizard/app.ts`.
   - `Run now` transition freezes Stage 1 into a non-editable Study Summary card.
   - step order, validation, and keybinding behavior unchanged.
4. Milestone 3 exit gate:
   - Stage 2 visuals and copy upgraded with unchanged status semantics and graceful interrupt behavior.
   - Stage 2 live updates occur below the frozen Stage 1 summary without erasing it.
5. Milestone 4 exit gate:
   - Stage 3 visuals and copy upgraded.
   - Stage 3 receipt renders below final Stage 2 snapshot in run path.
   - receipt remains scrollback-safe and auto-exit semantics unchanged.
6. Milestone 5 exit gate:
   - cross-stage copy audit confirms canonical terminology used and forbidden terms absent from runtime UI surfaces.
   - warning/error/helper/confirmation copy patterns verified consistent across stages.
   - this milestone produces no new code unless audit reveals drift introduced during Milestones 2-4.
7. Milestone 6 exit gate:
   - required tests pass.
   - before/after captures exist for required surfaces.
   - docs still align with behavior contract.

## Concrete Steps
Working directory: repository root.

1. Capture baseline outputs before any styling changes.
   Commands:
   - `npm run build`
   - `npm run test:ui`
   - `node dist/cli/index.js --help`
   - `script -q /tmp/arbiter-baseline.txt node dist/cli/index.js`
   Expected evidence: baseline output transcript and passing tests.

2. Map current style emission points.
   Commands:
   - `rg -n "\\x1b\\[|clearScreen|ARBITER|Progress:|RUN|RECEIPT|warn:|error:" src/ui src/cli -S`
   - `rg -n "statusChip|warnBlock|errorBlock|header|divider|createFormatter" src/ui src/cli -S`
   Expected evidence: explicit ownership map for style extraction.

3. Map current copy emission points and terminology drift hotspots.
   Commands:
   - `rg -n "Run existing config|Create new study|Run now|Save config|Review|Stopped:|novelty|cluster|group|correct|converged|truth|semantic categories" src/ui docs/product-specs/tui-wizard.md -S`
   - `rg -n "\"[^\"]{8,}\"" src/ui/wizard/app.ts src/ui/run-lifecycle-hooks.ts src/ui/receipt-model.ts src/ui/receipt-text.ts -S`
   Expected evidence: explicit ownership map for copy extraction and rewrite.

4. Introduce shared visual seam, shared copy seam, and Stage 1 rendering delegation seam.
   Commands:
   - `rg -n "from \"../fmt|createStdoutFormatter|createFormatter" src/ui -S`
   - `rg -n "renderStepFrame|selectOne|selectMany|renderBody|clearScreen|Study Summary|run-lifecycle-hooks" src/ui/wizard/app.ts src/ui/run-lifecycle-hooks.ts -S`
   Expected evidence: centralized style/copy APIs consumed by Stage 1/2/3 codepaths, Stage 1 rendering delegated through a renderer helper interface/module while key handling stays in place, and stack scaffold anchor points identified.

5. Apply Stage 1 restyle and copy rewrite against frozen contracts.
   Commands:
   - `rg -n "renderStepFrame|selectOne|selectMany|WIZARD_STEP_LABELS|Step 0|Step 7|Study Summary" src/ui/wizard/app.ts -S`
   - `rg -n "Research Question|Protocol|Models|Personas|Decode|Advanced Settings|Review|Run now|Save config" src/ui/wizard -S`
   Expected evidence: updated frame/card/list visuals, coherent copy, and Stage 1 frozen Study Summary card emitted on `Run now` transition.

6. Apply Stage 2 restyle and copy rewrite against frozen contracts.
   Commands:
   - `rg -n "RUN|progress|worker|novelty|ETA|usage|Ctrl\\+C|render\\(|lastRenderedLineCount" src/ui/run-lifecycle-hooks.ts src/ui -S`
   - `rg -n "Stopped:|novelty saturation|diminishing novelty|embedding groups|semantic categories|usage not applicable|estimate" src/ui/run-lifecycle-hooks.ts src/ui -S`
   Expected evidence: upgraded dashboard hierarchy, subtle functional motion, canonical caveat/status language, and Stage 2 redraw region constrained below frozen Stage 1 summary.

7. Apply Stage 3 restyle and copy rewrite against frozen contracts.
   Commands:
   - `rg -n "RECEIPT|receipt|artifact|stop reason|diminishing novelty|scrollback" src/ui/receipt-*.ts src/ui/run-lifecycle-hooks.ts -S`
   - `rg -n "\\x1b\\[" src/ui/receipt-text.ts -S`
   - `rg -n "Stopped: novelty saturation|Stopped: max trials reached|Stopped: user requested graceful stop|Stopped: sampling complete|Stopped: run failed|diminishing novelty, not correctness|embedding similarity, not semantic categories" src/ui/receipt-*.ts src/ui/run-lifecycle-hooks.ts -S`
   Expected evidence: branded static receipt display with unchanged semantic content, canonical stop-reason language, Stage 3 appended below final Stage 2 snapshot, and `src/ui/receipt-text.ts` remains ANSI-free artifact formatter.

8. Validate behavior parity and capability fallbacks.
   Commands:
   - `npm run check:types`
   - `npm run test:ui`
   - `npm run test:cli-contracts`
   - `npm run test:mock-run`
   - `npm run test:pack`
   - `node --test test/e2e/*.test.mjs`
   - `NO_COLOR=1 node dist/cli/index.js --help`
   - `COLUMNS=90 node dist/cli/index.js --help`
   Expected evidence: no contract regressions; readable output in fallback scenarios.

9. Enforce restraint and style-governance checks.
   Commands:
   - `rg -n "blink|rapid|rainbow|party|strobe" src/ui -S`
   - `rg -n "\\x1b\\[[0-9;]*m" src/ui --glob '!fmt.ts' -S`
   Expected evidence: motion/color behavior is governed by seam helpers and approved motion set.

10. Enforce copy governance checks.
   Commands:
   - `rg -n "['\\\"][^'\\\"]*\\b(cluster|clusters|converged|quickstart|truth)\\b[^'\\\"]*['\\\"]" src/ui -S`
   - `rg -n "['\\\"][^'\\\"]*\\bcorrectness\\b[^'\\\"]*['\\\"]" src/ui -S | rg -v "diminishing novelty, not correctness"`
   - `rg -n "['\\\"][^'\\\"]*\\bsemantic categories\\b[^'\\\"]*['\\\"]" src/ui -S | rg -v "Groups reflect embedding similarity, not semantic categories\\."`
   - `rg -n "embedding groups|similarity groups|novelty saturation|diminishing novelty, not correctness" src/ui -S`
   - `rg -n "TTY not detected\\. Showing headless help\\.|Dashboard requested without TTY; continuing in headless mode\\." src/ui src/cli -S`
   Expected evidence: forbidden terms absent from runtime UI display strings and required canonical/headless phrases present where contract requires them.
   Note: internal code identifiers and enum values (for example stop-reason code `converged`, config namespace `clustering`) are not user-facing copy and are excluded from this check; governance targets rendered string literals.

## Validation and Acceptance
Behavioral acceptance criteria:

1. Wizard flow and keybinding contracts from `docs/product-specs/tui-wizard.md` remain unchanged.
2. Stage 2 graceful `Ctrl+C` behavior remains unchanged.
3. Stage 3 auto-exit and scrollback visibility remain unchanged.
4. Headless/non-TTY behavior remains unchanged.
5. PTY E2E text assertions are updated atomically to reflect approved visual output; tests validate behavior, not legacy literal styling.
6. `receipt.txt` artifact remains plain ANSI-free output.
7. Run-mode behavior and protocol semantics remain unchanged; copy polish does not alter execution decisions.
8. Run-path stage composition follows contract: persistent Stage 0 masthead, frozen Stage 1 Study Summary, Stage 2 live region below summary, Stage 3 appended below final Stage 2 snapshot.
9. `arbiter run --dashboard` remains a Stage 2/3-only display path without Stage 0/Stage 1 stacked composition.

Visual acceptance criteria:

1. One coherent visual system across Stage 1/2/3 (same token semantics, border grammar, and component language).
2. Title treatment is materially stronger than baseline and remains legible in all tiers.
3. Bubble/card framing is consistent across step content, dashboard cards, and receipt summary blocks.
4. Color hierarchy is clear and restrained:
   - one accent family,
   - semantic status colors only where meaningful,
   - muted text for secondary context.
5. Glyph semantics are consistent across product surfaces.
6. Motion remains subtle and functional:
   - used only for active progress/work states,
   - absent on static receipt,
   - no distracting perpetual effects.
7. Tiered fallback renders remain readable:
   - tier A: full polish,
   - tier B: no unicode corners but retained structure,
   - tier C: no-color ASCII readability.
8. Run-path stacked hierarchy remains visually legible and stable across updates:
   - Stage 0 masthead persists,
   - Stage 1 summary remains fixed,
   - Stage 2 updates in-place below,
   - Stage 3 appends below.

Copy acceptance criteria:

1. Stage 1-3 copy adheres to one voice system: precise, calm, declarative, and action-oriented.
2. Canonical terminology is used consistently:
   - `Independent`, `Debate`,
   - `embedding groups`/`similarity groups`,
   - `novelty saturation` and `diminishing novelty`.
3. Forbidden wording is absent from runtime UI copy:
   - `converged`, `truth`, `quickstart`, `clusters`.
   - `correctness` as a result or quality claim.
   - `semantic categories` except in the required caveat sentence.
4. Stop-reason labels are canonical and consistent across dashboard/receipt:
   - `Stopped: novelty saturation`,
   - `Stopped: max trials reached`,
   - `Stopped: user requested graceful stop`,
   - `Stopped: sampling complete`,
   - `Stopped: run failed`.
5. Every warning/error message follows the same pattern: condition, impact, and next action (or explicit no-action-needed note).
6. Caveat language appears only where relevant:
   - `Stopping indicates diminishing novelty, not correctness.` always in monitoring/receipt interpretation context.
   - `Groups reflect embedding similarity, not semantic categories.` only when group outputs are shown.
7. Stage 1 completion spine confirmations are concise and consistently structured.
8. Stage 0 masthead and Stage 1 frozen Study Summary copy remain consistent and visible in Stage 2/3 run-path renders.

Validation commands:

1. `npm run check:types`
2. `npm run test:ui`
3. `npm run test:cli-contracts`
4. `npm run test:mock-run`
5. `npm run test:pack`
6. `npm run test:unit`
7. `node --test test/e2e/*.test.mjs`
8. `rg -n "['\\\"][^'\\\"]*\\b(cluster|clusters|converged|quickstart|truth)\\b[^'\\\"]*['\\\"]" src/ui -S` (expects no user-facing display-string matches)
9. `rg -n "['\\\"][^'\\\"]*\\bcorrectness\\b[^'\\\"]*['\\\"]" src/ui -S | rg -v "diminishing novelty, not correctness"` (expects no matches)
10. `rg -n "['\\\"][^'\\\"]*\\bsemantic categories\\b[^'\\\"]*['\\\"]" src/ui -S | rg -v "Groups reflect embedding similarity, not semantic categories\\."` (expects no matches)
11. `rg -n "TTY not detected\\. Showing headless help\\.|Dashboard requested without TTY; continuing in headless mode\\." src/ui src/cli -S` (expects canonical headless strings present)
12. `rg -n "Study Summary|Starting run|lastRenderedLineCount|\\x1b\\[[0-9]+A\\x1b\\[J" src/ui/wizard/app.ts src/ui/run-lifecycle-hooks.ts -S` (expects explicit frozen-summary and dashboard-redraw-boundary signals in run-path stack codepaths)

Required evidence artifacts:

1. Before/after captures for:
   - Step 0 welcome,
   - Step 7 review,
   - Stage 2 dashboard during active run,
   - Stage 3 receipt.
2. One no-color capture (`NO_COLOR=1`) for each stage entry surface.
3. One narrow-width capture (`COLUMNS=90`) for Stage 1 and Stage 2.
4. One "motion audit" capture proving active-only motion and static receipt calmness.
5. One stacked run-path capture showing Stage 0 masthead + frozen Stage 1 Study Summary + Stage 2 final snapshot + Stage 3 receipt in order.

## Idempotence and Recovery
1. Implement in milestone-sized commits so each stage can be reverted independently.
2. Keep compatibility by preserving current rendering path until each stage migrates fully.
3. If a stage regression appears, revert only that stage milestone commit and keep shared seam intact.
4. If unicode rendering issues appear, drop to ASCII border set while preserving spacing and hierarchy.
5. If motion is judged distracting, disable non-essential motion via a single seam-level switch without altering layout.

## Interfaces and Dependencies
Primary files expected to change:

1. `src/ui/fmt.ts` and/or new wizard visual seam module(s) under `src/ui/`.
2. `src/ui/wizard/app.ts`.
3. `src/ui/run-lifecycle-hooks.ts`.
4. `src/ui/receipt-model.ts` only if presentation fields need formatting helpers.
5. copy ownership module(s) under `src/ui/` (for example `src/ui/copy.ts` or staged equivalents).
6. `scripts/tui-*.mjs` and `test/e2e/tui-pty.test.mjs` only where output assertions need alignment with polished visuals.

Copy seam ownership boundary:

1. Centralized in copy module: terminology-canon strings, stop-reason labels, caveat lines, forbidden-term-adjacent phrases, and strings shared across multiple stages.
2. Inline in component modules: structural/layout strings (column headers, control hints, one-off helper text that does not include canon terms).
3. Rationale: centralize strings that require consistency governance; keep mechanical/local strings inline to avoid abstraction overhead.

Dependencies and constraints:

1. Existing formatter capability detection should be reused, not duplicated.
2. Stage 2/3 rendering must remain downstream of run events and lifecycle hooks.
3. No new runtime dependency is required for this plan unless proven necessary during implementation.
4. `src/ui/receipt-text.ts` is artifact formatting and must remain ANSI-free; any styled receipt rendering belongs in display-layer codepaths.
5. Copy contracts in `docs/product-specs/tui-wizard.md` remain authoritative for terminology restrictions and semantic caveats.
6. `docs/product-specs/tui-copy-deck.md` is the runtime copy source of truth; ad-hoc string authoring outside ownership modules is not allowed.

## Artifacts and Notes
Design north star: Arbiter's visual identity is warm instrument clarity. Every surface communicates information hierarchy through structured composition, warm muted tones, and typographic confidence. If a visual choice does not serve clarity, it does not belong.

### A. Frozen Visual Token Contract
Color tokens (tier A; hex truth):

| Token | Hex | Use |
| --- | --- | --- |
| `bg.base` | `#282828` | conceptual canvas reference (not emitted as global background ANSI) |
| `bg.surface` | `#32302f` | card/surface reference tone where supported |
| `fg.primary` | `#ebdbb2` | primary text |
| `fg.secondary` | `#d5c4a1` | secondary labels |
| `fg.muted` | `#a89984` | hints/meta |
| `accent.primary` | `#fabd2f` | primary accent, active selections |
| `accent.secondary` | `#fe8019` | small highlight accents |
| `status.success` | `#b8bb26` | success states |
| `status.warn` | `#d79921` | warning states |
| `status.error` | `#fb4934` | error states |
| `status.info` | `#83a598` | info states |
| `border.subtle` | `#504945` | nested/secondary borders |
| `border.default` | `#665c54` | card/frame borders |
| `border.strong` | `#7c6f64` | focused card borders |

Tier B mapping (16-color-safe ANSI approximations):

| Semantic token | ANSI fallback |
| --- | --- |
| `fg.primary` | `\x1b[37m` (white) |
| `fg.secondary` | `\x1b[37m` (white, non-bold) |
| `fg.muted` | `\x1b[90m` (bright black) |
| `accent.primary` | `\x1b[93m` (bright yellow) |
| `accent.secondary` | `\x1b[33m` (yellow) |
| `status.success` | `\x1b[32m` (green) |
| `status.warn` | `\x1b[33;1m` (bold yellow) |
| `status.error` | `\x1b[31m` (red) |
| `status.info` | `\x1b[36m` (cyan) |
| `border.subtle` | `\x1b[90m` (bright black) |
| `border.default` | `\x1b[90m` (bright black) |
| `border.strong` | `\x1b[37m` (white) |

Background token rule: `bg.*` tokens are reference values and are never emitted as ANSI background codes in any tier.

Tier C (no color): use text labels and symbol prefixes only.

### B. Color Usage Budget Contract
Per rendered screen:

1. Accent family: max 2 hues (`accent.primary`, `accent.secondary`).
2. Status hues: only on status chips/lines and explicit alerts.
3. Body copy: `fg.primary` and `fg.secondary`; `fg.muted` for hints.
4. No rainbow rows, alternating color stripes, or per-character color effects.

### C. Typography and Spacing Contract
Terminal hierarchy:

1. H0 (brand title): compact two-line or spaced-caps treatment with accent rule, not oversized block art.
2. H1 (stage title): bold + accent or strong foreground.
3. H2 (section header): bold + secondary foreground.
4. Body: normal weight primary foreground.
5. Meta/hints: muted foreground.

Spacing grid:

1. 1 blank line between major sections.
2. 2 spaces horizontal inset inside cards.
3. Card header separated from card body by one rule line or one blank line (not both).
4. Stepper/sidebar keeps fixed visual rhythm with one line per step.

### D. Glyph Vocabulary Contract
Approved semantic glyphs (tier A):

1. Progress/current step: `▸`.
2. Completed step: `◆`.
3. Pending step: `·`.
4. Success chip: `✔`.
5. Warning chip: `▲`.
6. Error chip: `✖`.
7. Info chip: `●`.
8. Direction/tip: `›`.

Card border sets:

1. Unicode rounded set (tier A): `╭ ╮ ╰ ╯ ─ │`.
2. ASCII fallback (tier B/C): `+ - |`.

No decorative emoji in core rendering paths.

### E. Motion Contract
Allowed motion effects:

1. Spinner for active work in Stage 2.
2. Static progress bar fill updates at data boundaries (no shimmer in v1).

Motion cadence:

1. Spinner update interval: 110-140ms (default target 120ms).
2. Spinner feel should be mechanical and calm, not rapid.
3. Max concurrent animated elements: 2.

Motion prohibition:

1. No animation in Stage 1 static forms except active input cursor context.
2. No animation in Stage 3 receipt.
3. No blinking text, rapid flashing, or high-contrast strobe transitions.
4. Prefer existing ASCII spinner frames as baseline compatibility path; unicode spinner may be tier-A optional when rendering quality is verified.

### F. Breakpoint and Layout Contract
Width tiers:

1. `>=100 cols`: wide layout with two-pane framing where applicable.
2. `<100 cols`: narrow layout with stacked sections and simplified borders.

Stage-specific layout invariants:

1. Stage 0 masthead remains persistent in run-path output.
2. Stage 1 editable mode shows active step context and completion spine (collapsed representation allowed on narrow widths).
3. After `Run now`, Stage 1 is represented by a frozen Study Summary card above Stage 2/3 regions.
4. Stage 2 always keeps master progress visible, even when worker table overflows.
5. Stage 3 always prints completion banner + summary card + artifacts list in readable order below final Stage 2 snapshot.
6. `arbiter run --dashboard` renders Stage 2/3 only and does not include persistent Stage 0/Stage 1 stacked regions.

Stage-stack redraw mechanism:

1. Frozen region (Stage 0 masthead + Stage 1 Study Summary) is written once at run start transition.
2. Dashboard redraw tracks dashboard-region line count independently from frozen-region line count.
3. Cursor-up redraw operations must never exceed dashboard-region line count.
4. Dashboard redraw must not erase or rewrite the frozen region above.

Height constraint:

1. If terminal height minus frozen-region height leaves fewer than 10 visible rows for Stage 2, frozen content may scroll into terminal scrollback naturally.
2. In short-terminal fallback, Stage 2 rendering remains legible and interactive in visible rows.
3. Frozen content is not repeatedly re-rendered once scrolled out of viewport.

### G. Component-Level Style Contracts
Implementation ownership map:

1. Stage 1 shell and step widgets: `src/ui/wizard/app.ts` plus extracted visual seam module.
2. Stage 0 masthead and Stage 1 summary persistence composition: `src/ui/wizard/app.ts` and `src/ui/run-lifecycle-hooks.ts`.
3. Stage 2 dashboard composition: `src/ui/run-lifecycle-hooks.ts`.
4. Stage 3 display composition: `src/ui/run-lifecycle-hooks.ts` (TTY display only).
5. Stage 3 artifact text: `src/ui/receipt-text.ts` (ANSI-free artifact output only; not display styling).
6. Shared color/glyph/motion helpers: `src/ui/fmt.ts` and/or dedicated wizard visual seam module.

Wizard shell components:

1. Brand header block.
2. Environment status strip.
3. Progress spine card.
4. Main step content card.
5. Frozen Study Summary card (run path).
6. Inline validation/error row style.
7. Key-hint row style.

Dashboard components:

1. Run summary strip.
2. Master progress card.
3. Worker activity card/table.
4. Monitoring card with caveat styling.
5. Usage line/chip treatment.

Receipt components:

1. Completion banner.
2. Summary card.
3. Optional groups card.
4. Artifact list card.
5. Repro command callout card.
6. Interpretation-hint footer line.

### H. Must-Not-Change Contract
The following must remain behaviorally identical:

1. step order and gating,
2. keybinding semantics,
3. review commit-point behavior,
4. Stage 2 graceful stop behavior,
5. Stage 3 auto-exit behavior,
6. CLI headless fallback behavior,
7. behavioral E2E assertions remain valid after visual updates (test literals updated atomically when presentation strings change),
8. `receipt.txt` artifact output remains ANSI-free plain text.
9. `receipt.txt` text content may be aligned with frozen copy contract wording, but artifact structure and field semantics must remain unchanged.
10. run-path stacked order remains stable: Stage 0 masthead, frozen Stage 1 summary, Stage 2 region, then Stage 3 receipt.

### I. Pre-Implementation Review Checklist (for Opus pass)
Checklist to clear before Milestone 1 starts:

1. Token table is complete and non-conflicting.
2. Glyph set avoids ambiguity and noise.
3. Motion contract is strict enough to prevent over-design.
4. Breakpoint strategy covers narrow terminals explicitly.
5. Must-not-change contract maps to existing tests.
6. Validation evidence requirements are concrete and collectible.

### J. Frozen Copy Contract
Voice and style system:

1. Tone: calm, precise, competent, and concise.
2. Sentence style: declarative, active voice, one primary idea per line.
3. Framing: operational and research-honest; never persuasive or hype-driven.
4. Reading rhythm: short lines for terminal scanability; avoid dense paragraph blocks in live screens.
5. Quality benchmark: Google/Stripe-style clarity (direct language, high signal, consistent structure, no filler).

Terminology canon:

1. Protocol labels: `Independent`, `Debate`.
2. Grouping labels: `embedding groups` and `similarity groups` (never `clusters` in user-facing UI).
3. Stopping language: `novelty saturation`, `diminishing novelty`, and explicit caveat that stopping is not correctness.
4. Stop-reason display labels:
   - `Stopped: novelty saturation`
   - `Stopped: max trials reached`
   - `Stopped: user requested graceful stop`
   - `Stopped: sampling complete`
   - `Stopped: run failed`

Forbidden terminology in runtime UI copy:

1. `converged`
2. `correctness` as a result or quality claim
3. `truth`
4. `semantic categories` except in the required caveat sentence
5. `clusters` (use `embedding groups` or `similarity groups`)
6. `quickstart`

Microcopy pattern contracts:

1. Step headers: short imperative or noun phrase.
   Examples: `Research Question`, `Protocol`, `Models`, `Decode Params`, `Review and Confirm`.
2. Helper text: one sentence, ends with concrete intent or caveat.
   Examples: `Arbiter samples responses to characterize distributional behavior.`, `Select models to include in the sampling pool.`
3. Validation errors: explicit fix path.
   Examples: `Fix required: select at least one model.`, `Fix required: enter a research question to continue.`, `Fix required: temperature must be within [0.0, 2.0].`
4. Warnings: condition + risk + recommendation.
   Examples: `Warning: no API key detected. Live mode requires OPENROUTER_API_KEY. Set the key or use Mock mode.`, `Warning: free-tier models selected. Availability may be limited. Use paid models for publishable research.`
5. Success confirmations: compact summary with stable format in the spine.
   Examples: `✔ Question: "What is..." (42 chars)`, `✔ Protocol: Independent`, `✔ Models: 3 selected`.
6. Receipt hints: one-line interpretation guidance, research-honest and non-prescriptive.
   Examples: `Stopping indicates diminishing novelty, not correctness.`, `Groups reflect embedding similarity, not semantic categories.`

## Plan Change Notes
- 2026-03-03 02:21Z: initial draft created for UI-only premium polish phase after v0.1.0 release.
- 2026-03-03 02:39Z: expanded to full pre-implementation design contract (exact token/glyph/motion/breakpoint/component rules) for external review before coding.
- 2026-03-03 02:37Z: integrated external critique: split warning/accent tokens, added explicit Tier B table, narrowed responsiveness scope, added renderer extraction seam, and clarified receipt artifact vs display styling boundary.
- 2026-03-03 02:37Z: set design-first rule: tests adapt atomically to approved visual output rather than constraining design choices.
- 2026-03-03 02:46Z: adopted follow-up critique refinements: reframed identity to warm instrument clarity, fixed Tier B accent/warn differentiation, made ANSI gate seam-path-aware, and formalized non-emission of `bg.*` tokens.
- 2026-03-03 03:02Z: expanded scope to include full Stage 1-3 copy overhaul with frozen voice/terminology/microcopy contract and copy-specific gates.
- 2026-03-03 03:08Z: aligned copy quality bar to Google/Stripe-style clarity and tightened milestone/progress wording for visual+copy parity.
- 2026-03-03 03:16Z: linked `docs/product-specs/tui-copy-deck.md` as canonical copy-deck artifact for implementation and external review.
- 2026-03-03 03:29Z: adopted Opus critique refinements: literal-targeted copy governance checks, receipt artifact text-boundary clarification, Milestone 5 audit-only framing, explicit copy seam ownership boundary, and microcopy calibration examples.
- 2026-03-03 03:42Z: adopted follow-up alignment fixes: unified success glyph (`✔`), added missing receipt stop labels, aligned forbidden-term policy with caveat exception handling, added disabled-option copy pattern, and added headless-copy verification checks.
- 2026-03-03 03:55Z: tightened Milestone 1 ANSI gate to SGR-only detection and explicitly allowed inline terminal control sequences.
- 2026-03-03 04:14Z: updated plan for hybrid stack composition direction: persistent Stage 0 masthead, frozen Stage 1 Study Summary, Stage 2/3 stacked rendering, and corresponding gates/validation updates.
- 2026-03-03 04:33Z: resolved stacked-composition audit gaps: removed Stage 0/Step 0 header duplication, clarified dashboard-only (`--dashboard`) path semantics, added redraw-boundary and short-terminal fallback contract, and aligned stop-reason wording to copy-deck canonical labels.
