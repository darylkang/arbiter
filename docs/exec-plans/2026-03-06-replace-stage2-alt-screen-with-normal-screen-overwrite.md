# ExecPlan: Replace Interactive TUI Alt-Screen Rendering with Normal-Screen Overwrite

Status: completed
Owner: Codex
Last updated: 2026-03-06

## 1. Purpose / Big Picture

Arbiter originally tried to achieve transcript cleanliness by running the wizard and dashboard inside the alternate screen buffer and then committing one final normal-screen transcript at completion.

That mechanism was wrong for the target terminals.

Real iTerm verification showed two distinct problems:

1. Stage 2 dashboard frames could leak into session history even after the earlier transcript-integrity fix.
2. Stage 1 wizard frames could also leak into session history, which meant fixing Stage 2 alone was insufficient.

The corrected design is now:

1. Stage 1 wizard uses normal-screen overwrite, not alt-screen.
2. Stage 2 dashboard uses bounded normal-screen overwrite, not alt-screen.
3. `Run now` clears the transient Stage 1 region, writes one frozen durable prefix, then starts the Stage 2 overwrite loop beneath it.
4. On completion, Stage 2 clears its live region and appends one final durable transcript:
   - Stage 0 header,
   - frozen Stage 1 summary,
   - final Stage 2 snapshot,
   - Stage 3 receipt.
5. `arbiter run --dashboard` uses the same overwrite model and appends only:
   - final Stage 2 snapshot,
   - Stage 3 receipt.

This matches the normal-screen cursor-management pattern used by transient CLI dashboards and removes dependence on emulator-specific alternate-screen scrollback behavior.

## 2. Scope Guardrails

In scope:

1. Stage 1 runtime ownership and redraw mechanism.
2. Stage 1 -> Stage 2 handoff behavior for the wizard `Run now` path.
3. `arbiter run --dashboard` Stage 2/3 runtime behavior.
4. Removing alt-screen usage from all interactive TUI surfaces.
5. Transcript-truth validation for both wizard and direct dashboard paths.
6. A macOS/iTerm smoke harness and documented manual verification path.
7. Product/runtime/testing doc updates required to make the new contract explicit.

Out of scope:

1. redesigning the inline rail wizard interaction model,
2. changing Stage 2 view-model semantics or stop semantics,
3. changing artifact schemas or receipt semantics,
4. migration to Ink or another third-party TUI framework,
5. visual redesign beyond what is required to preserve current layout under overwrite rendering.

## 3. Progress

- [x] M0: contract reconciliation and plan freeze
- [x] M1: Stage 1 normal-screen overwrite runtime
- [x] M2: Stage 2/3 normal-screen overwrite runtime
- [x] M3: transcript-truth validation and iTerm smoke coverage
- [x] M4: closeout and sign-off preparation

## 4. Surprises & Discoveries

1. The earlier Stage 2-only fix improved the final transcript but did not solve the broader product issue because the wizard still relied on alt-screen.
2. Real iTerm testing proved that even when alternate-screen scrollback preservation is disabled, Arbiter’s full wizard path could still leak intermediate frames into session contents.
3. This means the defect was not “Stage 2 only” or “iTerm settings only”; it was a product/runtime contract mismatch around all interactive TUI surfaces.
4. Once Stage 1 and Stage 2 both moved to normal-screen overwrite, the same iTerm smoke harness showed exactly one durable header, one frozen summary, one final dashboard snapshot, and one receipt.

## 5. Decision Log

1. Decision: remove alt-screen from the interactive TUI runtime entirely.
   Rationale: transcript cleanliness must not depend on emulator-specific alternate-screen behavior.

2. Decision: keep the Stage 1 inline rail wizard.
   Rationale: the rail wizard remains the strongest interaction surface; only the terminal rendering mechanism changed.

3. Decision: persist Stage 0 in the durable transcript.
   Rationale: the final transcript should preserve the application header and brand identity once, above the frozen Stage 1 summary.

4. Decision: use real iTerm smoke validation as a required lane for transcript-integrity changes on macOS.
   Rationale: PTY and headless buffer validation alone were insufficient for this class of defect.

5. Decision: do not pursue Ink for this issue.
   Rationale: the defect was not a component-structure problem. It was a terminal transcript mechanism problem.

## 6. Context and Orientation

Reviewed and updated during execution:

1. `AGENTS.md`
2. `docs/PLANS.md`
3. `docs/DESIGN.md`
4. `docs/TUI-RUNTIME.md`
5. `docs/TESTING.md`
6. `docs/product-specs/tui-wizard.md`
7. `docs/product-specs/tui-copy-deck.md`
8. `docs/product-specs/tui-visual-screen-deck.md`
9. `src/ui/wizard/app.ts`
10. `src/ui/wizard/frame-manager.ts`
11. `src/ui/run-lifecycle-hooks.ts`
12. `src/ui/runtime/live-region.ts`
13. `scripts/tui-visual-capture.mjs`
14. `scripts/tui-iterm-smoke.mjs`
15. `test/e2e/tui-pty.test.mjs`
16. `test/e2e/tui-visual-capture.test.mjs`

## 7. Implementation Summary

Ordering principle: first fix the product/runtime contract, then validate against real transcript truth.

1. Reworked `src/ui/wizard/frame-manager.ts` from alt-screen ownership to normal-screen overwrite ownership.
2. Kept Stage 1 shell composition and inline rail rendering intact.
3. Preserved the frozen transcript prefix and expanded it to include the Stage 0 header.
4. Removed Stage 2 alt-screen usage from `src/ui/run-lifecycle-hooks.ts`.
5. Preserved Stage 2/3 view-model and pure-render modules while changing only the overwrite mechanism.
6. Added a real iTerm smoke harness and integrated it into testing guidance.
7. Updated transcript extraction so automated checks validate the durable transcript rather than stale overwritten frames.

## 8. Milestones and Gates

### M0: Contract reconciliation and plan freeze

Outcome:

1. The governing docs describe normal-screen overwrite as the TUI runtime contract.

Exit evidence:

1. `docs/TUI-RUNTIME.md` describes overwrite-based runtime ownership.
2. `docs/product-specs/tui-wizard.md` describes the durable transcript as Stage 0 header -> frozen Stage 1 summary -> final Stage 2 snapshot -> Stage 3 receipt.
3. `docs/product-specs/tui-visual-screen-deck.md` describes Stage 1 and Stage 2 as overwrite-based surfaces.
4. `docs/TESTING.md` records transcript-truth plus iTerm smoke expectations.

### M1: Stage 1 normal-screen overwrite runtime

Outcome:

1. The wizard no longer uses alt-screen and no longer leaks intermediate wizard frames into real iTerm session history.

Exit evidence:

1. `src/ui/wizard/frame-manager.ts` contains no alt-screen enter/exit sequences.
2. `Run now` still preserves the inline rail wizard UX while clearing the transient wizard region before the durable prefix is written.
3. Wizard save-without-run behavior remains unchanged.

### M2: Stage 2/3 normal-screen overwrite runtime

Outcome:

1. Stage 2 no longer uses alt-screen and no longer depends on emulator scrollback policy for transcript cleanliness.

Exit evidence:

1. `src/ui/run-lifecycle-hooks.ts` contains no alt-screen enter/exit logic.
2. The dashboard redraw path uses normal-screen cursor-up overwrite based on previous-frame line count.
3. Final transcript still contains:
   - Stage 0 header,
   - frozen Stage 1 summary on wizard path,
   - one final Stage 2 snapshot,
   - one Stage 3 receipt.
4. Direct `arbiter run --dashboard` uses the same mechanism and excludes the Stage 0 header / Stage 1 summary.

### M3: Transcript-truth validation and iTerm smoke coverage

Outcome:

1. The new overwrite model is validated against the actual durable transcript and against real iTerm session history.

Exit evidence:

1. PTY/capture tests assert exactly one final Stage 2 snapshot and one receipt in the durable transcript.
2. The macOS/iTerm smoke path verifies no repeated dashboard frames in session history after completion.
3. Wizard-path iTerm smoke verifies exactly one durable header and one frozen summary after completion.

### M4: Closeout and sign-off preparation

Outcome:

1. The overwrite-based transcript model becomes the new baseline.

Exit evidence:

1. Required TUI validation commands pass.
2. Fresh capture artifacts confirm the new transcript shape.
3. This plan records the implemented mechanism rather than the superseded alt-screen model.
4. Residual risks are documented honestly.

## 9. Validation

Required commands run during implementation:

1. `npm run build`
2. `npm run test:ui`
3. `npm run test:e2e:tui`
4. `npm run test:unit`
5. `npm run test:guards`
6. `npm run capture:tui`
7. `node scripts/tui-iterm-smoke.mjs`

Fresh capture evidence:

1. `/Users/darylkang/Developer/arbiter/output/playwright/tui-visual/2026-03-07T04-48-10-908Z`

Real-emulator evidence:

1. iTerm 3.6.1 smoke run now verifies exactly one:
   - `A R B I T E R`
   - `✔  Entry Path`
   - `── PROGRESS`
   - `run / monitoring`
   - `── RECEIPT`

## 10. Residual Risks

1. The macOS/iTerm smoke harness is environment-specific and should remain advisory rather than part of the merge gate.
2. Other terminal emulators may still differ in session-history presentation, so manual verification remains the final check for transcript-contract changes.
3. The overwrite model depends on the current single-width glyph set; future introduction of wide glyphs would require revisiting line-counting assumptions.

## 11. Final State

The corrected baseline is:

1. Stage 1 inline rail wizard on the normal screen using overwrite rendering,
2. Stage 0 header persisted once in the final durable transcript,
3. Stage 2 monitor on the normal screen using overwrite rendering,
4. Stage 3 receipt appended once,
5. no reliance on alternate-screen behavior for transcript correctness.

This plan supersedes the narrower Stage 2-only approach because real-emulator evidence proved the wizard surface had to move as well.
