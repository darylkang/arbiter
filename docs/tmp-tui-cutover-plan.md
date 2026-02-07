# TEMP: TUI Clean Cutover Plan (Ink/React -> Transcript-First Runtime)

Status: Draft for implementation
Owner: Codex (this migration round)
Created: 2026-02-06
Delete before final merge: Yes (unless user asks to keep)

---

## 1) Objective

Replace Arbiter's current page-wizard Ink/React UI with a transcript-first premium TUI stack, with no runtime legacy paths left behind.

This is a hard cutover because the package is unreleased.

UI implementation is intentionally deferred until the non-UI foundation reaches the `RunLifecycleHooks` boundary in `/Users/darylkang/Developer/arbiter/docs/tmp-foundation-rebuild-plan.md`.

---

## 2) Hard constraints (from AGENTS.md and repo architecture)

- Keep engine/artifact determinism and provenance behavior unchanged.
- Preserve architecture boundary: engine emits events, UI subscribes; engine must not import UI code.
- Keep schema-first rule intact (expected: no schema changes for this migration).
- Keep generated types untouched unless schemas change (expected: none).
- End with passing required checks:
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

---

## 3) Current state (legacy surface to remove)

Legacy UI entrypoints and dependencies are currently wired through:

- CLI wizard launch:
  - `src/cli/index.ts` (`runPremiumWizard`, `--wizard` help text)
  - `src/cli/intent.ts` (`forceWizard`, `--wizard` parsing)
- Ink-specific runtime branch:
  - `src/run/run-service.ts` (`forceInk`, `renderReceiptInk`, `useInk`)
  - `src/cli/commands.ts` (`forceInk` in run command options)
- Legacy UI implementation:
  - `src/ui/premium/*`
  - `src/ui/ink/*`
  - `src/ui/receipt-ink.ts`
- Legacy UI tests/scripts:
  - `scripts/ui-routing.mjs`
  - `scripts/ui-headless.mjs`
  - `scripts/ui-warning-sink.mjs` (uses `forceInk`)
- Legacy package deps:
  - `ink`
  - `react`
  - `@types/react`

---

## 4) Target UX (cutover definition)

Transcript-first, always-on shell:

- Persistent regions:
  - header/status
  - scrollable transcript/log
  - input/editor
  - footer hint strip
- Overlay-based interactions:
  - yes/no bubble selectors
  - arrow-key list selectors
  - settings/checklist style controls (space/enter behavior)
- Navigation model:
  - conversation flow, not page-to-page FSM
  - prior run/report/verify outputs appended to transcript with clear sections

Reference inspirations:

- OpenClaw transcript UX patterns
- Claude Code interaction model

These are design references only. They must not force coupling into engine/run/planning layers.

---

## 5) Proposed stack

- Primary runtime: `@mariozechner/pi-tui`
- Prompt-oriented overlays (as needed): `@clack/prompts` (or pure pi-tui selectors where better)
- Keep existing non-UI helpers:
  - `src/ui/receipt-model.ts`
  - `src/ui/receipt-text.ts`
  - `src/ui/receipt-writer.ts`
  - `src/ui/execution-log.ts` (rename/move if needed, but no Ink coupling)

Decision notes:

- No parallel Ink path.
- No React renderer in runtime UI.
- Keep UI runtime behind a small adapter so framework swaps remain low-cost.
- Keep command semantics aligned to stable backend commands (`resolve`, `mock-run`, `run`, `verify`, `report`).

---

## 6) Implementation phases

Precondition before starting Phase C:

- `/Users/darylkang/Developer/arbiter/src/run/run-service.ts` is UI-agnostic.
- `RunLifecycleHooks` contract is stable and versioned.
- Event envelope versioning is in place for transcript consumption.

### Phase A: Scaffold new transcript TUI

Add a new TUI module tree (exact filenames can shift during implementation):

- `src/ui/transcript/app.ts`
- `src/ui/transcript/chat-log.ts`
- `src/ui/transcript/layout.ts`
- `src/ui/transcript/selectors.ts`
- `src/ui/transcript/theme.ts`
- `src/ui/transcript/commands.ts`
- `src/ui/transcript/run-controller.ts`

Responsibilities:

- bootstrap terminal + render loop
- append/update transcript entries from command actions and run events
- expose overlay manager for selectors/settings
- provide canonical keymap (arrows, enter, space, esc, ctrl+c)

### Phase B: Port wizard behavior to transcript flows

Port current user capabilities from `src/ui/premium/wizard.tsx` into transcript commands/overlays:

- new study setup (question/profile/template)
- run mode selection (mock/live)
- run progress and completion summary
- analyze existing run
- report/verify/receipt follow-up actions
- warning surfacing and toggles

Expected user-visible commands (draft):

- `/new`
- `/profile`
- `/run mock`
- `/run live`
- `/analyze <run_dir?>`
- `/report`
- `/verify`
- `/receipt`
- `/help`
- `/quit`

### Phase C: CLI wiring cutover

Replace legacy launch logic:

- `src/cli/index.ts`
  - remove `runPremiumWizard` import and call
  - launch new transcript UI when no command + TTY (or equivalent desired behavior)
  - update usage text to remove wizard-specific flags
- `src/cli/intent.ts`
  - remove `forceWizard` and `--wizard` handling
  - simplify mode resolution to only supported modes
- `src/cli/commands.ts` and `src/run/run-service.ts`
  - remove `forceInk` option plumbing
  - remove `renderReceiptInk` path
  - keep deterministic run behavior unchanged

### Phase D: Remove legacy code and dependencies

Delete legacy implementation:

- `src/ui/premium/` (entire tree)
- `src/ui/ink/` (entire tree)
- `src/ui/receipt-ink.ts`

Update package deps:

- remove `ink`, `react`, `@types/react`
- add new runtime deps used by transcript UI

### Phase E: Replace UI tests for new contract

Replace/rewire old UI scripts:

- remove/replace:
  - `scripts/ui-routing.mjs` (wizard route assumptions)
  - `scripts/ui-headless.mjs` (wizard usage assumptions)
  - `scripts/ui-warning-sink.mjs` (`forceInk`-specific assumption)
- add new checks for transcript behavior:
  - CLI entry behavior with no args + headless mode
  - key interaction smoke (selector navigation and confirm/cancel)
  - warning sink behavior without direct stdout/stderr noise
  - signal handler cleanup (retain/extend existing test)

---

## 7) "No legacy trace" acceptance criteria

All of the following must be true before finalizing:

1. No legacy imports/usages in source:

```bash
rg -n 'from "ink"|from "react"|runPremiumWizard|forceInk|--wizard|ui/premium|ui/ink|receipt-ink' src scripts
```

Expected: no matches (except intentionally documented migration notes, if any).

2. No legacy deps installed:

```bash
npm ls ink react @types/react
```

Expected: all absent.

3. New transcript UI is the only interactive TUI path:

- no conditional fallback to Ink/legacy wizard
- no dead code preserving previous screen FSM

4. Required AGENTS.md checks pass (full list in section 2).

5. `npm pack` validation remains clean (`npm run test:pack` already enforces pack expectations).

---

## 8) Commit strategy for this migration

Use Conventional Commits with bullet-only body lines. Prefer incremental commits by phase:

1. `feat(ui): scaffold transcript tui runtime`
2. `feat(ui): port wizard flows to transcript interactions`
3. `refactor(cli): remove wizard and force-ink mode plumbing`
4. `chore(ui): delete legacy ink/premium codepaths`
5. `test(ui): replace wizard-era smoke tests with transcript contracts`

If changes are too coupled, squash into fewer commits while keeping clear scopes.

---

## 9) Risks and mitigations

Risk: behavior regressions in setup/run flow.
- Mitigation: port flow in small slices, run smoke scripts after each phase.

Risk: hidden references to deleted modules break build late.
- Mitigation: aggressive `rg` scans and compile after each deletion step.

Risk: UI tests become too shallow after rewrite.
- Mitigation: define concrete transcript interaction contracts (not visual snapshots only).

---

## 10) End-of-migration cleanup

Before final handoff:

- Delete this temporary plan file:
  - `docs/tmp-tui-cutover-plan.md`
- Re-run build + required gates.
- Provide concise migration summary + commit list.
