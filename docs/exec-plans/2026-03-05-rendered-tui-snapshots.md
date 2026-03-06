# Add Rendered TUI Snapshots for Human and Agent Review

This ExecPlan is a living document and must be updated as work proceeds.
This plan follows `docs/PLANS.md`.

## Purpose / Big Picture
Add a rendered-snapshot workflow on top of the existing PTY capture pipeline so Arbiter's TUI can be reviewed by both humans and AI coding agents using artifacts that match what a terminal emulator would show.

Primary user-visible outcome:

1. `npm run capture:tui` produces both raw `.ansi` snapshots and rendered `.txt` snapshots for the full Stage 0/1/2/3 journey.
2. humans can keep using the HTML xterm viewer for color and composition review.
3. agents can inspect rendered `.txt` snapshots without having to parse ANSI streams manually.
4. curated snapshot assertions cover a few high-value checkpoints so the workflow is exercised automatically.

## Progress
- [x] (2026-03-06 04:03Z) initial plan drafted
- [x] (2026-03-06 04:09Z) rendered snapshot helper and capture pipeline landed
- [x] (2026-03-06 04:10Z) curated rendered snapshot assertions landed
- [x] (2026-03-06 04:10Z) README and agent-facing workflow docs landed
- [x] (2026-03-06 04:11Z) validation completed and plan retrospective updated

## Surprises & Discoveries
- Observation: replaying ANSI into xterm headless and reading from row `0` returns the top of scrollback, not the currently visible viewport.
  Evidence: initial `stage3-receipt.txt` omitted the receipt even though `11-stage3-receipt.ansi` clearly contained `── RECEIPT` and `Run complete.` later in the buffer; xterm reported `baseY=32` and `viewportY=32` for that capture.

## Outcomes & Retrospective
Delivered:

1. repo-local rendered TUI snapshot support via `@xterm/headless`,
2. paired `.ansi` and `.txt` outputs from the existing capture harness,
3. a stable `npm run capture:tui` entrypoint,
4. one curated rendered-snapshot e2e test covering Step 0, Step 7, Stage 2, and Stage 3,
5. documentation in `README.md` plus a concise workflow pointer in `AGENTS.md`.

Remaining gap:

1. rendered `.txt` snapshots intentionally do not encode color, so final color/composition judgment still requires the HTML viewer.

## Context and Orientation
Reviewed before drafting this plan:

1. `AGENTS.md` for repository invariants, testing expectations, and agent guidance.
2. `README.md` for current developer-facing usage and where to document the workflow.
3. `docs/DESIGN.md` for CLI and artifact constraints.
4. `docs/PLANS.md` for ExecPlan requirements.
5. `scripts/tui-visual-capture.mjs` for the current PTY capture flow and snapshot output.
6. `scripts/tui-terminal-viewer.html` for the current human review path.
7. `test/e2e/tui-pty.test.mjs` for existing PTY-based TUI assertions.
8. `docs/product-specs/tui-visual-screen-deck.md` for current visual QA expectations and sentinel strings.

Non-obvious terms:

1. Raw snapshot: the cumulative `.ansi` byte stream up to a checkpoint.
2. Rendered snapshot: plain-text screen content produced by replaying raw ANSI through a terminal emulator buffer.
3. Curated checkpoint: a small set of representative screens used for automated regression checks rather than full golden-image approval.

High-risk areas:

1. reading the xterm headless buffer before async writes are fully applied,
2. producing brittle snapshot assertions that churn on harmless copy/layout edits,
3. duplicating workflow docs across too many locations and letting them drift.

## Plan of Work
Ordering principle: land the smallest end-to-end path first, then document the workflow at the contributor and agent layers.

Milestones:

1. Add repo-local xterm headless support and a reusable render helper.
2. Extend the existing PTY capture script to emit both `.ansi` and `.txt` files and expose a stable npm entrypoint.
3. Add one automated rendered-snapshot test that checks a few high-value screens only.
4. Document the workflow in `README.md` and add a brief pointer in `AGENTS.md`.

## Concrete Steps
From `/Users/darylkang/Developer/arbiter`:

1. `npm install -D @xterm/headless@6.0.0`
2. update the capture pipeline and viewer version alignment
3. run `npm run build`
4. run `npm run capture:tui`
5. run `npm run test:e2e:tui`
6. inspect one generated snapshot directory under `output/playwright/tui-visual/`

## Validation and Acceptance
Acceptance evidence:

1. `npm run capture:tui` completes successfully and reports a timestamped output directory.
2. the output directory contains paired `.ansi` and `.txt` files for each checkpoint plus an index.
3. at least these rendered snapshots are readable and correct:
   - Step 0 entry
   - Step 7 review
   - Stage 2 progress
   - Stage 3 receipt
4. `npm run test:e2e:tui` passes with the new rendered-snapshot assertions included.
5. `README.md` explains the human review path and the agent review path.
6. `AGENTS.md` tells future agents which command to run for TUI visual validation.

## Idempotence and Recovery
The workflow is safe to rerun:

1. `npm run capture:tui` writes to a new timestamped directory each time.
2. rendered snapshot tests should use a temporary directory and clean up after themselves.
3. if xterm headless integration fails, revert the helper and capture-script changes together; no schema or runtime artifact contracts are affected.

## Interfaces and Dependencies
New dependency:

1. `@xterm/headless@6.0.0` as a dev dependency only.

Interface expectations:

1. use xterm headless as the canonical parser for `.ansi` replay.
2. keep the existing browser viewer path for human color/composition review.
3. do not require any global install or external desktop app.

## Plan Change Notes
- 2026-03-06 04:03Z: initial plan created for repo-local rendered TUI snapshot workflow.
- 2026-03-06 04:11Z: kept detailed workflow docs in `README.md` and a concise pointer in `AGENTS.md` to avoid duplicating step-by-step instructions in the policy file.
