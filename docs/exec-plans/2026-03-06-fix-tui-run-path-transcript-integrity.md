# ExecPlan: Fix TUI Run-Path Transcript Integrity

Status: superseded
Owner: Codex
Last updated: 2026-03-06

## 1. Purpose / Big Picture

Arbiter's TUI runtime is structurally strong, but the current run path still violates one of the most important end-user invariants:

1. after a dashboard-backed run completes, normal-screen scrollback should contain one final static stack,
2. not repeated live-refresh frames from Stage 2.

This issue is real and user-visible. It invalidates the prior assumption that runtime architecture quality alone was enough to call the run path complete.

The defect is not in the Stage 1 wizard architecture. It is in the Stage 1 → Stage 2 → Stage 3 handoff model:

1. Stage 1 exits alt-screen before Stage 2 begins,
2. Stage 2 redraws its live dashboard directly on the normal screen,
3. cursor repositioning and scroll-region control keep the viewport mostly clean,
4. but repeated full dashboard frames still enter the terminal transcript and appear in scrollback after completion.

Primary outcome:

1. live dashboard redraws no longer pollute normal-screen scrollback,
2. the final normal-screen transcript is written once at completion and reads as:
   - frozen Stage 1 summary (wizard path only),
   - one final Stage 2 snapshot,
   - one Stage 3 receipt,
3. validation proves transcript truth directly rather than inferring it from rendered final state.

## 2. Scope Guardrails

In scope:

1. Stage 1 → Stage 2 → Stage 3 handoff behavior for the wizard `Run now` path,
2. `arbiter run --dashboard` live monitor behavior in TTY mode,
3. terminal-buffer ownership for the live dashboard surface,
4. transcript-truth validation and raw-ANSI assertions,
5. product-spec and runtime-doc updates required to make the corrected model explicit,
6. manual terminal verification requirements for run-path changes.

Out of scope:

1. Stage 1 step flow, review logic, or editable wizard interaction model,
2. dashboard view-model semantics or worker telemetry semantics,
3. receipt content semantics or artifact schemas,
4. broad visual redesign work,
5. migration to a third-party TUI framework,
6. unrelated product-surface polish unless strictly required by the run-path correction.

Sequencing constraints:

1. freeze the corrected run-path model in docs before code changes,
2. preserve the current Stage 1, Stage 2, and Stage 3 rendering modules where possible,
3. change the coordinator and terminal lifecycle model before changing tests,
4. strengthen transcript-truth validation before re-closing the runtime as complete.

## 3. Progress

- [x] M0: run-path model reconciliation
- [x] M1: alt-screen live dashboard correction
- [x] M2: transcript-truth validation expansion
- [ ] M3: manual verification and closeout

## 4. Surprises & Discoveries

1. The current visual-capture and PTY stack validates rendered terminal state, but not the raw main-screen transcript that users actually scroll through after completion.
2. The raw ANSI evidence shows the defect directly:
   - in `output/playwright/tui-visual/2026-03-07T01-55-03-472Z/11-stage3-receipt.ansi`,
   - `run / monitoring` appears 6 times,
   - `Ctrl+C request graceful stop` appears 6 times.
3. This means the problem is not a terminal emulator illusion. The dashboard is genuinely being written into the normal-screen transcript multiple times.
4. The current Stage 2 model can keep the visible viewport clean while still corrupting scrollback history. Those are different invariants and must be tested separately.
5. After the corrective implementation, the final normal-screen transcript extracted from `output/playwright/tui-visual/2026-03-07T02-39-40-654Z/11-stage3-receipt.ansi` contains exactly one frozen summary, one dashboard snapshot, and one receipt.

## 5. Decision Log

1. Decision: the live dashboard must not repeatedly redraw on the normal screen.
   Rationale: no amount of cursor-up or scroll-region control can make repeated main-screen writes behave like a clean final transcript across terminals.

2. Decision: live dashboard rendering will move to an isolated live surface, with the final transcript committed to the normal screen once at completion.
   Rationale: this is the smallest design change that can actually satisfy both requirements:
   - rich live monitor during execution,
   - clean final scrollback after completion.

3. Decision: transcript truth becomes a first-class validation target.
   Rationale: rendered buffer snapshots alone are insufficient for this class of bug.

4. Decision: manual terminal verification is mandatory before closing this plan.
   Rationale: the failure escaped automated review and was discovered only in a real terminal scrollback workflow.

## 6. Context and Orientation

Reviewed before drafting this plan:

1. `AGENTS.md` for TUI workflow, validation expectations, and scope-gate commands.
2. `docs/PLANS.md` for ExecPlan requirements.
3. `docs/TUI-RUNTIME.md` for runtime ownership and terminal lifecycle rules.
4. `docs/TESTING.md` for current TUI validation-lane ownership.
5. `docs/DESIGN.md` for stage-model and run-path semantics.
6. `docs/product-specs/tui-wizard.md` for current Stage 1/2/3 user-facing contract.
7. `docs/product-specs/tui-visual-screen-deck.md` for current screen-buffer and run-path behavior.
8. `src/ui/wizard/app.ts` for the current wizard handoff into `runStudy()`.
9. `src/ui/run-lifecycle-hooks.ts` for the current Stage 2/3 runtime coordinator and direct-write behavior.
10. `src/ui/runtime/dashboard-render.ts`, `src/ui/runtime/receipt-render.ts`, and `src/ui/runtime/live-region.ts` for current rendering and row-budget logic.
11. `scripts/tui-visual-capture.mjs` and `test/e2e/tui-visual-capture.test.mjs` for the current capture and replay model.
12. Raw evidence:
    - `output/playwright/tui-visual/2026-03-07T01-55-03-472Z/10-stage2-run.ansi`
    - `output/playwright/tui-visual/2026-03-07T01-55-03-472Z/11-stage3-receipt.ansi`

Relevant current behavior:

1. Stage 1 exits alt-screen before the run begins in `src/ui/wizard/app.ts`.
2. The frozen Stage 1 summary is written to the normal screen before the dashboard attaches.
3. Stage 2 repeatedly writes the dashboard frame inside a scroll region on the normal screen in `src/ui/run-lifecycle-hooks.ts`.
4. The current tests mostly validate rendered final state, not raw transcript uniqueness.

Non-obvious terms:

1. **Main-screen transcript**: the actual byte stream written to the terminal's normal screen buffer, which determines what the user sees in scrollback after completion.
2. **Live surface**: the terminal surface used for live-updating dashboard frames during execution.
3. **Transcript truth**: correctness of the durable normal-screen output history, not just the final rendered buffer.

## 7. Plan of Work

Ordering principle: fix the faulty runtime model first, then validate the specific user-facing invariant that was previously missed.

1. Reconcile the product and runtime docs around the corrected run-path model.
2. Move live dashboard redraws off the normal screen and onto an isolated live surface.
3. Rebuild the final normal-screen output as a one-time static transcript write.
4. Expand tests so they assert transcript truth directly.
5. Re-run captures and manually verify in a real terminal before calling the issue closed.

## 8. Milestones and Gates

### M0: Run-path model reconciliation

Outcome:

1. The governing docs explicitly describe the corrected live-run model.

Entry:

1. The failure mode is reproduced and evidenced in raw ANSI artifacts.

Exit evidence:

1. `docs/TUI-RUNTIME.md` describes that live dashboard redraws must not pollute normal-screen transcript history.
2. `docs/product-specs/tui-wizard.md` and `docs/product-specs/tui-visual-screen-deck.md` are updated so the run-path model is unambiguous.
3. `docs/TESTING.md` states that transcript truth is a required invariant for run-path TUI changes.

Rollback boundary:

1. Docs-only.

### M1: Alt-screen live dashboard correction

Outcome:

1. The live dashboard no longer emits repeated frames into normal-screen scrollback.

Entry:

1. M0 is committed.

Exit evidence:

1. Wizard `Run now` path keeps the live dashboard in an isolated live surface during execution.
2. `arbiter run --dashboard` TTY path uses the same corrected live-surface model.
3. On completion:
   - wizard path writes one final static transcript to the normal screen:
     - frozen Stage 1 summary,
     - one final Stage 2 snapshot,
     - one Stage 3 receipt,
   - direct `--dashboard` path writes one final static transcript:
     - one final Stage 2 snapshot,
     - one Stage 3 receipt.
4. `src/ui/run-lifecycle-hooks.ts` and `src/ui/wizard/app.ts` reflect the new ownership clearly without reopening broader runtime architecture.

Rollback boundary:

1. The correction remains localized to the run-path handoff and runtime coordinator.

### M2: Transcript-truth validation expansion

Outcome:

1. The validation stack can catch this exact class of bug before a user does.

Entry:

1. M1 is green locally enough to produce representative ANSI/capture artifacts.

Exit evidence:

1. PTY and/or capture tests assert raw transcript invariants directly, not only xterm-replayed final state.
2. Required assertions cover:
   - no repeated Stage 2 monitor frames in the final normal-screen transcript,
   - exactly one final Stage 2 snapshot in the final transcript,
   - exactly one Stage 3 receipt in the final transcript,
   - wizard path transcript includes frozen Stage 1 summary once,
   - direct `--dashboard` path transcript excludes Stage 1 summary.
3. Existing rendered-state checks remain in place for layout/content truth.

Rollback boundary:

1. Raw-transcript checks may be refined, but not removed, without replacement coverage.

### M3: Manual verification and closeout

Outcome:

1. The defect is closed at the actual user-experience layer, not only in automated tests.

Entry:

1. M1 and M2 pass.

Exit evidence:

1. Required validation commands pass:
   - `npm run test:ui`
   - `npm run test:e2e:tui`
   - `npm run test:unit`
   - `npm run test:guards`
   - `npm run capture:tui`
2. Fresh raw ANSI artifacts show no repeated live dashboard frames in the final normal-screen transcript.
3. Manual terminal verification confirms:
   - no repeated refresh frames when scrolling up after completion,
   - both wizard `Run now` and `arbiter run --dashboard` behave correctly.
4. The plan records the final evidence and any remaining residual risk truthfully.

Rollback boundary:

1. None; this becomes the corrected run-path baseline.

## 9. Concrete Steps

### M0

1. Update `docs/TUI-RUNTIME.md` to define transcript truth as a first-class runtime invariant for live run paths.
2. Update `docs/product-specs/tui-wizard.md` so the Stage 1 → Stage 2 → Stage 3 contract reflects the corrected live-surface model.
3. Update `docs/product-specs/tui-visual-screen-deck.md` screen-buffer guidance to match the new run-path design.
4. Update `docs/TESTING.md` so TUI run-path changes must validate transcript truth directly.

### M1

1. Rework `src/ui/wizard/app.ts` and `src/ui/run-lifecycle-hooks.ts` so Stage 2 live redraw stays off the normal screen.
2. Preserve existing Stage 2/3 render modules:
   - `src/ui/runtime/dashboard-vm.ts`
   - `src/ui/runtime/dashboard-render.ts`
   - `src/ui/runtime/receipt-render.ts`
3. Introduce the corrected final transcript write path:
   - assemble the frozen summary + final dashboard snapshot + receipt once,
   - emit it to the normal screen only after live execution completes.
4. Ensure direct `--dashboard` TTY mode follows the same corrected pattern without Stage 1 content.

### M2

1. Extend `scripts/tui-visual-capture.mjs` so it can expose transcript-truth evidence explicitly, not just replayed final state.
2. Update `test/e2e/tui-visual-capture.test.mjs` and/or `test/e2e/tui-pty.test.mjs` to assert raw transcript uniqueness.
3. Keep rendered `.txt` assertions for structural final-state truth.
4. Add at least one explicit test for direct `arbiter run --dashboard` transcript correctness.

### M3

1. Run the full required validation stack serially.
2. Generate a fresh capture pack.
3. Inspect raw `*.ansi` transcript counts directly.
4. Do a real-terminal manual verification pass.
5. Record results and mark the plan complete only if the scrollback defect is actually gone.

## 10. Validation and Acceptance

Acceptance criteria:

1. No repeated Stage 2 dashboard frames appear in the final normal-screen transcript after completion.
2. Wizard run path scrollback shows exactly one final frozen Stage 1 summary, one final Stage 2 snapshot, and one Stage 3 receipt.
3. Direct `arbiter run --dashboard` scrollback shows exactly one final Stage 2 snapshot and one Stage 3 receipt.
4. Existing runtime behavior remains intact:
   - resize handling,
   - undersized fallback,
   - receipt artifact separation,
   - worker/dashboard semantics.
5. Both automated and manual verification support the same conclusion.

Required commands:

1. `npm run test:ui`
2. `npm run test:e2e:tui`
3. `npm run test:unit`
4. `npm run test:guards`
5. `npm run capture:tui`

Expected evidence:

1. raw ANSI transcript checks fail before the fix and pass after it,
2. the latest capture pack contains one final run-path transcript, not repeated refresh frames,
3. manual terminal verification confirms the issue is gone in real scrollback.

## 11. Idempotence and Recovery

1. The run-path correction should be implementable incrementally:
   - docs first,
   - coordinator/handoff correction,
   - validation tightening.
2. If the live-surface correction introduces regressions, fall back to the current coordinator behavior only behind explicit reopened-risk documentation.
3. Do not weaken transcript-truth assertions to make the suite green. If they fail, treat that as evidence, not noise.
4. Keep code changes localized to the run-path coordinator/handoff layer unless a broader runtime change is proven necessary.

## 12. Interfaces and Dependencies

Primary files expected to change:

1. `src/ui/wizard/app.ts`
2. `src/ui/run-lifecycle-hooks.ts`
3. `scripts/tui-visual-capture.mjs`
4. `test/e2e/tui-pty.test.mjs`
5. `test/e2e/tui-visual-capture.test.mjs`
6. `docs/TUI-RUNTIME.md`
7. `docs/TESTING.md`
8. `docs/product-specs/tui-wizard.md`
9. `docs/product-specs/tui-visual-screen-deck.md`

Likely unchanged if the work stays properly scoped:

1. `src/ui/runtime/dashboard-vm.ts`
2. `src/ui/runtime/dashboard-render.ts`
3. `src/ui/runtime/receipt-render.ts`
4. `src/ui/wizard-theme.ts`
5. `src/ui/runtime-view-models.ts`

## 13. Handoffs and Ownership

If this work is handed off mid-stream, the handoff must include:

1. which run-path model is currently implemented,
2. whether live dashboard is still on the normal screen or already isolated,
3. which transcript-truth tests are failing or passing,
4. which manual terminal checks have actually been performed,
5. the latest raw ANSI artifact path showing evidence.

## 14. Artifacts and Notes

Current failure evidence:

1. `output/playwright/tui-visual/2026-03-07T01-55-03-472Z/10-stage2-run.ansi`
2. `output/playwright/tui-visual/2026-03-07T01-55-03-472Z/11-stage3-receipt.ansi`

Observed counts from the current broken baseline:

1. `run / monitoring` appears 6 times in the final receipt ANSI transcript.
2. `Ctrl+C request graceful stop` appears 6 times.

These counts should drop to one final transcript occurrence after the correction.

## 15. Plan Change Notes

1. This plan reopens the run-path correctness question despite prior runtime closeout work, because transcript-truth validation was previously insufficient.
2. The prior runtime A+ closeout remains valid for structural modularity and runtime ownership, but not for this specific end-user scrollback invariant until this plan is completed.
3. Superseded by `docs/exec-plans/2026-03-06-replace-stage2-alt-screen-with-normal-screen-overwrite.md`, which replaces the Stage 2 mechanism rather than continuing to refine the alt-screen approach.
