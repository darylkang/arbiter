# AGENTS.md

Purpose: this file is the project-local operating contract for contributors and AI agents working in Arbiter.

It governs how to work in this repository: what is authoritative, what must be read first, what must not be broken, and what validation is required before claiming success.

It does not replace product or schema truth. Keep product semantics in `docs/DESIGN.md`, `schemas/`, and the relevant product-spec docs.

## Mission Alignment

Arbiter exists to support research on reasoning as a distribution under heterogeneous, budget-matched sampling.

Engineering work must preserve this posture:

- measure distributional behavior, not correctness,
- treat configuration distribution `Q(c)` as estimand-defining,
- treat measurement procedure `M` as result-defining and provenance-relevant,
- report uncertainty and provenance rigorously,
- keep artifacts reproducible and auditable.

## Authority and Precedence

This file governs agent behavior, not semantic truth.

For implementation truth, use this order:

1. `schemas/` for config and artifact contracts.
2. `docs/DESIGN.md` for semantics, architecture, invariants, and interpretation boundaries.
3. Product-spec docs for UI work:
   - `docs/product-specs/tui-wizard.md` for behavior and interaction,
   - `docs/product-specs/tui-copy-deck.md` for locked and flexible copy,
   - `docs/product-specs/tui-visual-screen-deck.md` for visual layout and QA targets.
4. `docs/TUI-RUNTIME.md` for internal TUI runtime architecture, renderer ownership, and migration rules.
5. `README.md` for operator and developer workflow.
6. `docs/PLANS.md` for ExecPlan requirements and execution behavior.

Precedence within the TUI product-spec set:

1. `docs/product-specs/tui-wizard.md`
2. `docs/product-specs/tui-copy-deck.md`
3. `docs/product-specs/tui-visual-screen-deck.md`

If docs disagree with schemas, schemas win.
If implementation disagrees with the governing docs, treat that as either:

1. a bug to fix, or
2. an explicit migration step tracked in an ExecPlan.

## Required Orientation

Before major work, always do the minimum orientation needed for the specific change.

Always read:

1. `AGENTS.md`
2. `docs/DESIGN.md`
3. `README.md`

Read `docs/PLANS.md` when the work is non-trivial: complex features, significant refactors, migrations, cross-cutting changes, or anything with material unknowns or risk.

Read these before editing the corresponding areas:

- `schemas/` before schema, artifact, config-shape, provenance, contract, or verification work.
- `docs/TUI-RUNTIME.md` before changing TUI renderer architecture, frame ownership, layout primitives, or TUI testing infrastructure.
- `docs/product-specs/tui-wizard.md`, `docs/product-specs/tui-copy-deck.md`, and `docs/product-specs/tui-visual-screen-deck.md` before changing wizard, dashboard, receipt, terminal rendering, or TUI copy.
- touched modules and their existing tests before making behavioral changes.

Do not infer contract truth from implementation alone when a governing schema or product-spec doc exists.

## Multi-Agent Safety

Assume this repository may be hot.

- Never revert, overwrite, or restage changes you did not make unless the user explicitly asks.
- Keep edits tightly scoped to the requested area.
- Stage and commit only the files you own in the current round.
- If a file you need changes unexpectedly while you are working, stop and coordinate rather than guessing.
- If you must hand off mid-stream, include decisions made, files touched, validation run, residual risks, and the recommended next action.

## Non-Negotiable Invariants

- **Schema-first workflow**: change schemas before code that depends on new contracts.
- **Generated types are read-only**: never hand-edit `src/generated/*`.
- **Determinism**:
  - `trial_id` is assigned deterministically before async execution.
  - trial planning is seeded and recorded.
  - monitoring and grouping updates are applied in `trial_id` order at batch boundaries.
- **Artifacts**:
  - JSONL outputs are append-only during execution.
  - finalization is atomic (`tmp` then rename).
  - `config.resolved.json` is immutable once execution starts.
- **Architecture boundary**:
  - engine emits events,
  - UI and `ArtifactWriter` subscribe,
  - engine must not import UI code.
- **Provenance**:
  - requested and actual model identifiers must be logged,
  - `actual_model` comes from the OpenRouter response body `model` field when available,
  - embeddings store `generation_id` when provided.
- **Research significance**:
  - changes to `Q(c)` or `M` are not cosmetic; treat them as research-significant and document them accordingly.
- **UI role boundary**:
  - UI may present state, but must not change scheduling, trial selection, or stop decisions.

## Research Claims Discipline

These rules apply to docs, code comments, reports, and implementation messaging.

- Do not claim convergence implies correctness.
- Do not claim embedding groups are semantic truth.
- Do not claim interaction protocols are inherently superior; interaction is one rung in a broader heterogeneity ladder.
- Distinguish clearly:
  - decision uncertainty: dispersion under `Q(c)`,
  - estimation uncertainty: finite-sample uncertainty in estimated signals.
- If a result depends on a changed `Q(c)` or `M`, say so explicitly.

## Required Workflows

### Schema and Contract Workflow

When changing schemas, config shapes, artifacts, or contract-derived outputs:

1. edit the relevant schema in `schemas/`,
2. regenerate generated types with `npm run gen:types`,
3. update implementation code,
4. update governing docs if semantics or artifact expectations changed,
5. run `npm run check:types` and `npm run check:schemas`.

Versioning rule: keep schema version bumps intentional and minimal; avoid breaking changes unless explicitly required.

### TUI Workflow

When changing wizard, dashboard, receipt, TTY routing, terminal rendering, or TUI copy:

1. read the three governing TUI product-spec docs first,
2. run `npm run capture:tui` and inspect the generated artifacts,
3. use the generated `*.txt` files for agent review of rendered terminal state,
4. use `scripts/tui-terminal-viewer.html` with the paired `*.ansi` files for human color and composition review,
5. run `npm run test:ui`, `npm run test:e2e:tui`, and `npm run test:unit`.

Operational rule:

- run build-backed TUI commands serially, not in parallel,
- specifically: do not overlap `npm run build`, `npm run capture:tui`, or `npm run test:e2e:tui`,
- these commands rebuild `dist/`, and concurrent runs can create false negatives or inconsistent PTY/capture results.

When sentinel strings, stage headers, or TUI copy/layout contracts change, update all dependent docs/tests/scripts in the same change. At minimum, check:

- `docs/product-specs/tui-copy-deck.md`
- `docs/product-specs/tui-visual-screen-deck.md`
- `scripts/tui-visual-capture.mjs`
- `test/e2e/tui-pty.test.mjs`
- `test/e2e/tui-visual-capture.test.mjs`
- `src/ui/copy.ts`
- `src/ui/run-lifecycle-hooks.ts`

Keep this workflow lightweight:

- `*.txt` snapshots are for layout and content verification, not color truth,
- prefer a few stable checkpoint assertions over full golden snapshot lock-in.

## Validation Policy

There are two validation levels: scope gate and merge gate.

### Scope Gate

Before claiming a scoped change is complete, run the commands that directly exercise the touched area.

Minimum by change type:

- **TUI changes**:
  - `npm run test:ui`
  - `npm run test:e2e:tui`
  - `npm run test:unit`
  - `npm run capture:tui`
- **Schema / config / artifact shape changes**:
  - `npm run check:types`
  - `npm run check:schemas`
- **Contracts / parsing changes**:
  - `npm run test:contracts`
  - plus the relevant protocol tests
- **Stopping / monitoring / grouping changes**:
  - `npm run test:clustering`
  - `npm run test:early-stop`
  - `npm run test:mock-run`
  - `npm run test:verify`
- **Artifact / verify / report changes**:
  - `npm run test:verify`
  - `npm run test:report`
  - `npm run test:pack`
- **Packaging / publish changes**:
  - `npm run test:pack`
  - `npm pack` and inspect tarball contents
- **CLI surface changes**:
  - `npm run test:cli-contracts`
  - `npm run test:ui` if TTY behavior changed
- **Provider integration / provenance changes**:
  - `npm run test:provenance`
  - `npm run test:live-smoke` when the live path changed and credentials are available

If you do not run an expected command, say so explicitly and name the residual risk.

### Merge Gate

Before merging implementation changes, run the standard suite:

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
- `npm run test:e2e:tui`
- `npm run test:cli-contracts`
- `npm run test:unit`

Also run these when relevant:

- `npm run test:contracts`
- `npm run test:early-stop`
- `npm run test:report`
- `npm run test:guards`
- `npm run test:provenance`
- `npm run test:live-smoke` when API key is present and live behavior changed

## Common Footguns

- `Math.random` in core execution paths.
- completion-order monitoring or grouping updates.
- UI logic influencing scheduling or stop decisions.
- provenance sourced from headers instead of response body `model`.
- contract parse failures treated as silent success; default usable-text posture is `parse_status=fallback`.
- changing TUI sentinel strings or copy without updating capture scripts, assertions, and product-spec docs together.
- treating current stub IDs or prompt-bank prose as canonical.
- editing `src/generated/*` by hand.

## Stub Content Policy

- Catalog and prompt-bank content may remain in `dev` stage during development.
- Examples may use current stub IDs but must state IDs can change.
- Do not treat stub IDs as canonical in tests or narrative.
- Tests should assert invariants such as schema validity, non-empty content, and hash/content consistency, not fixed IDs or fixed prose.

## Change Mapping

When changing a subsystem, update the governing docs and run the matching validations in the same round.

- **Stopping logic**:
  - update `docs/DESIGN.md` stopping semantics and relevant schemas,
  - run `npm run test:clustering`, `npm run test:early-stop`, and `npm run test:verify`.
- **Provenance fields**:
  - update schemas and generated types,
  - run `npm run test:provenance` and verify `arbiter verify` invariants.
- **Contracts**:
  - update `resources/contracts/` and the resolver/parse path,
  - run `npm run test:contracts` and the relevant protocol tests.
- **Artifacts**:
  - update `docs/DESIGN.md` artifact semantics and any affected schemas,
  - run `npm run test:verify`, `npm run test:report`, and `npm run test:pack`.
- **TUI behavior, copy, or visuals**:
  - update the relevant product-spec docs,
  - update capture and assertion scripts as needed,
  - run `npm run capture:tui`, `npm run test:ui`, and `npm run test:e2e:tui`.
- **CLI routing or command surface**:
  - update `docs/DESIGN.md` and `README.md`,
  - run `npm run test:cli-contracts` and any affected TUI/headless tests.
- **Release or publish path**:
  - update `README.md` when user-facing usage changes,
  - run `npm run test:pack` and `npm pack`,
  - inspect tarball contents and perform a secret-scan sanity check.

## Release and Publish Checklist

Before publishing:

- `npm run check:types`
- `npm run check:schemas`
- `npm run test:pack`
- `npm pack` and inspect tarball contents
- confirm `runs/`, `output/`, and other local artifacts are not included unless intentional
- README accuracy check
- secret-scan sanity check

## Session Closure and Handoff

At the end of each implementation round:

- track touched files,
- summarize what changed,
- name the validation that was run,
- name residual risks or unvalidated areas,
- commit at a logical boundary unless the user explicitly asked not to.

Commit only the files you own.

Use Conventional Commits:

- subject: `type(scope): description`
- body: bullet-only lines
- bullets start lowercase
- preserve natural capitalization for proper nouns and acronyms such as `OpenRouter`, `JSONL`, and `README`

If you do not commit, say why.

## When Uncertain

Consult in this order:

1. `schemas/`
2. `docs/DESIGN.md`
3. relevant product-spec docs for the area you are changing
4. `README.md` for workflow expectations
5. conservative behavior that preserves determinism, provenance, auditability, and research honesty

Document assumptions in round-closure summaries.
