# ExecPlan: Replace Stage 2 Alt-Screen Rendering with Normal-Screen Overwrite

Status: proposed
Owner: Codex
Last updated: 2026-03-06

## 1. Purpose / Big Picture

Arbiter's current TUI product contract asks the runtime to do two things at once:

1. provide an immersive, full-screen interactive UI,
2. leave behind a clean, durable terminal transcript after the run.

That is the right product goal, but the current Stage 2 mechanism is the wrong implementation strategy.

The dashboard currently runs as a live-updating full-screen surface that depends on alternate-screen behavior for transcript cleanliness. Real-world terminal behavior, especially in iTerm2 and other modern emulators that preserve alternate-screen history by default or via profile settings, breaks that assumption. The result is scrollback pollution with repeated Stage 2 frames.

The corrected design is:

1. Stage 1 remains an alt-screen interactive wizard.
2. Stage 1 exits alt-screen before the run handoff.
3. The frozen Stage 1 summary is written once to the normal screen.
4. Stage 2 runs on the normal screen using cursor-up overwrite, not alt-screen.
5. Stage 3 clears the live dashboard region and writes one final durable transcript:
   - frozen Stage 1 summary (wizard path only),
   - one final Stage 2 snapshot,
   - one Stage 3 receipt.

This matches the industry-standard pattern used by transient CLI dashboards and avoids depending on emulator-specific alternate-screen scrollback behavior.

## 2. Scope Guardrails

In scope:

1. Stage 1 → Stage 2 handoff behavior for the wizard `Run now` path.
2. `arbiter run --dashboard` Stage 2/3 runtime behavior.
3. Replacing Stage 2 alt-screen usage with normal-screen cursor-up overwrite.
4. Transcript-truth validation for both wizard and direct dashboard paths.
5. A macOS/iTerm smoke harness or equivalent scripted manual verification path.
6. Product/runtime doc updates required to make the new contract explicit.

Out of scope:

1. redesigning the Stage 1 rail wizard interaction model,
2. changing Stage 2 view-model semantics or stop semantics,
3. changing artifact schemas or receipt semantics,
4. visual redesign beyond what is required to preserve current layout under the new runtime path,
5. migration to Ink or another third-party TUI framework,
6. changing Stage 1 to transcript-safe mode in this plan.

Sequencing constraints:

1. freeze the corrected product/runtime contract in docs before code changes,
2. preserve Stage 1 architecture as-is unless the new runtime path exposes a real defect,
3. remove Stage 2 alt-screen usage before rewriting tests to the new invariant,
4. do not claim completion without real-emulator evidence, not just PTY/headless evidence,
5. if real-emulator verification shows Stage 1 alt-screen history is still unacceptable on default terminal settings, record that explicitly and open a follow-on plan rather than silently stretching this plan.

## 3. Progress

- [ ] M0: contract reconciliation and plan freeze
- [ ] M1: wizard handoff decoupling
- [ ] M2: Stage 2/3 normal-screen overwrite runtime
- [ ] M3: transcript-truth validation and iTerm smoke coverage
- [ ] M4: closeout and sign-off

## 4. Surprises & Discoveries

1. The previous transcript-integrity fix improved the final normal-screen transcript but did not solve the broader product issue because Stage 2 still depended on an alt-screen live surface.
2. Real iTerm testing showed a critical distinction:
   - a minimal alternate-screen probe can appear clean,
   - Arbiter's full dashboard run can still leave repeated Stage 2 frames in session history.
3. This means the defect is not just "alt-screen exists"; it is the combination of:
   - full-screen live-updating content,
   - terminal scrollback behavior,
   - and a product contract that expects a clean durable transcript afterward.
4. The industry pattern for transient CLI dashboards is normal-screen overwrite, not alt-screen.

## 5. Decision Log

1. Decision: preserve Stage 1 as an alt-screen wizard.
   Rationale: the inline rail wizard is the strongest interaction surface in the product and is an appropriate full-screen use case.
   Constraint: this remains provisional on M3 evidence that the remaining Stage 1 behavior is acceptable in the target terminal set.

2. Decision: Stage 2 must stop using alt-screen entirely.
   Rationale: the dashboard is a transient monitor, not a full-screen editor. Normal-screen overwrite is the standard, portable pattern.

3. Decision: the durable run transcript begins after Stage 1 exits alt-screen.
   Rationale: the final transcript should contain the frozen study definition, not the entire interactive wizard journey.

4. Decision: do not pursue Ink for this issue.
   Rationale: Ink would not change emulator scrollback policy and would add migration cost without solving the actual problem.

5. Decision: real-emulator validation becomes a required lane for this class of bug.
   Rationale: PTY/headless validation alone is insufficient for scrollback-integrity claims.

## 6. Context and Orientation

Reviewed before drafting this plan:

1. `AGENTS.md` for TUI workflow and required validation commands.
2. `docs/PLANS.md` for ExecPlan structure and completion rules.
3. `docs/DESIGN.md` for stage-model semantics.
4. `docs/TUI-RUNTIME.md` for runtime-layer ownership and transcript guarantees.
5. `docs/TESTING.md` for TUI testing expectations.
6. `docs/product-specs/tui-wizard.md` for Stage 1/2/3 product behavior.
7. `docs/product-specs/tui-copy-deck.md` for run-path copy constraints.
8. `docs/product-specs/tui-visual-screen-deck.md` for current run-path visual expectations.
9. `src/ui/wizard/app.ts` for wizard handoff into `runStudy()`.
10. `src/ui/wizard/frame-manager.ts` for Stage 1 alt-screen ownership.
11. `src/ui/run-lifecycle-hooks.ts` for Stage 2/3 runtime behavior.
12. `src/ui/runtime/live-region.ts` for current row-counting and live-region math.
13. `scripts/tui-visual-capture.mjs` and `test/e2e/tui-visual-capture.test.mjs` for current capture and replay coverage.

Relevant current state:

1. Stage 1 wizard owns alt-screen entry/exit in `src/ui/wizard/frame-manager.ts`.
2. Stage 2 currently still maintains a live full-screen surface under `src/ui/run-lifecycle-hooks.ts`.
3. The final transcript is already assembled once at completion, which is the correct durable-output model.
4. The remaining defect is that the Stage 2 mechanism is still dependent on emulator behavior that is not portable.

Non-obvious terms:

1. **Normal-screen overwrite**: keep the durable terminal transcript on the normal screen, but redraw a bounded live region by moving the cursor up, clearing to end of screen, and writing the new frame.
2. **Durable transcript**: the terminal output the user should see in scrollback after the run is complete.
3. **Ephemeral surface**: UI content that is interactive/live while the app runs but is not intended to remain in scrollback.

## 7. Plan of Work

Ordering principle: first freeze the correct product/runtime contract, then move the live monitor to the correct rendering model, then expand tests around the new truth surface.

1. Reconcile docs around the new Stage 1/2/3 contract.
2. Exit Stage 1 alt-screen before Stage 2 begins.
3. Replace Stage 2 live rendering with normal-screen overwrite.
4. Preserve current view models and render modules wherever possible.
5. Add transcript-truth and real-iTerm validation for the new mechanism.

## 8. Milestones and Gates

### M0: Contract reconciliation and plan freeze

Outcome:

1. The governing docs describe the corrected product/runtime contract unambiguously.

Exit evidence:

1. `docs/TUI-RUNTIME.md` states that Stage 2 must use normal-screen overwrite rather than alt-screen.
2. `docs/product-specs/tui-wizard.md` states that the durable transcript begins after the wizard exits alt-screen.
3. `docs/product-specs/tui-visual-screen-deck.md` reflects the new Stage 1 → Stage 2 handoff shape.
4. `docs/TESTING.md` adds transcript-truth and real-emulator validation for run-path changes.

Rollback boundary:

1. Docs-only.

### M1: Wizard handoff decoupling

Outcome:

1. Stage 1 exits alt-screen before Stage 2 begins, and the frozen Stage 1 summary is written once to the normal screen.

Exit evidence:

1. `src/ui/wizard/app.ts` explicitly calls `frameManager.leave()` before live run rendering starts.
2. The frozen Stage 1 summary is written once to the normal screen before Stage 2 begins.
3. Wizard save-without-run behavior remains unchanged.

Rollback boundary:

1. Localized to the wizard run handoff.

### M2: Stage 2/3 normal-screen overwrite runtime

Outcome:

1. Stage 2 no longer uses alt-screen and no longer depends on scroll-region/alt-screen behavior for transcript cleanliness.

Exit evidence:

1. `src/ui/run-lifecycle-hooks.ts` contains no Stage 2 alt-screen enter/exit logic.
2. The dashboard redraw path uses normal-screen cursor-up overwrite based on previous-frame line count.
3. The final transcript still contains:
   - frozen Stage 1 summary on wizard path,
   - one final Stage 2 snapshot,
   - one Stage 3 receipt.
4. Direct `arbiter run --dashboard` uses the same mechanism and excludes Stage 1 summary.

Rollback boundary:

1. Localized to Stage 2/3 runtime coordinator and live-region math.

### M3: Transcript-truth validation and iTerm smoke coverage

Outcome:

1. The new mechanism is validated at the transcript layer and in a real terminal emulator.

Exit evidence:

1. PTY/capture tests assert exactly one final Stage 2 snapshot and one receipt in the durable transcript.
2. A macOS/iTerm scripted smoke path verifies no repeated dashboard frames in session history after completion.
3. Manual iTerm verification is documented and performed once before closeout.
4. Real-emulator verification records whether Stage 1 intermediate wizard frames remain acceptable under the intended default product contract.

Rollback boundary:

1. New emulator-smoke checks may be refined, but transcript-truth validation may not be removed without replacement.

### M4: Closeout and sign-off

Outcome:

1. The corrected run-path model becomes the new baseline.

Exit evidence:

1. Required TUI validation commands pass.
2. Fresh capture artifacts confirm the new transcript shape.
3. The prior transcript-integrity plan is marked superseded.
4. Residual risks are documented honestly.

Rollback boundary:

1. None; this is the new run-path baseline.

## 9. Concrete Steps

### M0

1. Update `docs/TUI-RUNTIME.md` to state that Stage 2 uses normal-screen overwrite and that alt-screen is restricted to Stage 1.
2. Update `docs/product-specs/tui-wizard.md` so the durable transcript begins after Stage 1 exits alt-screen.
3. Update `docs/product-specs/tui-visual-screen-deck.md` to show the corrected Stage 1 → Stage 2 handoff.
4. Update `docs/TESTING.md` with transcript-truth plus iTerm smoke expectations for run-path changes.

### M1

1. Rework `src/ui/wizard/app.ts` so `Run now` exits Stage 1 alt-screen before Stage 2 begins.
2. Print the frozen Stage 1 summary to the normal screen once.
3. Ensure direct save/exit behavior remains unchanged.

### M2

1. Remove Stage 2 alt-screen usage from `src/ui/run-lifecycle-hooks.ts`.
2. Replace scroll-region-based live rendering with:
   - previous-frame line counting,
   - cursor-up overwrite,
   - clear-to-end,
   - new frame write.
3. Keep the existing Stage 2/3 view-model and pure-render modules wherever possible.
4. Simplify `src/ui/runtime/live-region.ts` around previous-frame line counting rather than alt-screen-region math.
5. Ensure final transcript write remains one-time and stable.

### M3

1. Expand PTY/capture tests to assert durable transcript uniqueness under the new model.
2. Add or script a macOS/iTerm smoke path that runs Arbiter in real iTerm and inspects session contents.
3. Record the expected manual verification steps in docs.

### M4

1. Run the required TUI validation commands.
2. Generate a fresh capture pack.
3. Record outcomes and any residual risk.
4. Mark this plan completed and mark the old transcript-integrity plan superseded.

## 10. Validation and Acceptance

Scope-gate commands for implementation:

1. `npm run test:ui`
2. `npm run test:e2e:tui`
3. `npm run test:unit`
4. `npm run test:guards`
5. `npm run capture:tui`

Merge gate:

1. `npm run test:merge`

Acceptance criteria:

1. Stage 1 remains an alt-screen interactive wizard.
2. Stage 2 uses normal-screen overwrite, not alt-screen.
3. The durable transcript contains:
   - exactly one frozen Stage 1 summary on wizard path,
   - exactly one final Stage 2 snapshot,
   - exactly one Stage 3 receipt.
4. No repeated intermediate Stage 2 frames appear in the durable transcript.
5. Direct `arbiter run --dashboard` excludes Stage 1 summary and still leaves one final dashboard snapshot plus receipt.
6. Real iTerm smoke verification confirms no repeated dashboard frames in session history after completion.

Fail-before / pass-after evidence:

1. Prior captured evidence showed repeated Stage 2 frames in real iTerm session history.
2. Post-fix evidence must show only one final dashboard snapshot and one receipt.

## 11. Idempotence and Recovery

1. Doc updates are idempotent and can be reapplied safely.
2. Runtime changes should preserve the existing Stage 2/3 render modules and VM contracts to keep rollback small.
3. If normal-screen overwrite introduces a visible regression, rollback should be limited to:
   - `src/ui/wizard/app.ts`
   - `src/ui/run-lifecycle-hooks.ts`
   - `src/ui/runtime/live-region.ts`
   - the new tests and docs for this plan
4. Do not reopen broader runtime-architecture work unless the new mechanism exposes a deeper flaw.

## 12. Handoffs and Ownership

This plan is intended for one implementation round, but handoff-safe artifacts are still required.

Required handoff artifacts:

1. touched files list,
2. transcript-truth evidence,
3. fresh capture-pack path,
4. iTerm smoke result,
5. residual risks, if any,
6. explicit statement whether the old transcript-integrity plan is superseded.

## 13. Plan Change Notes

1. This plan supersedes the alt-screen-centric implementation approach in `docs/exec-plans/2026-03-06-fix-tui-run-path-transcript-integrity.md`.
