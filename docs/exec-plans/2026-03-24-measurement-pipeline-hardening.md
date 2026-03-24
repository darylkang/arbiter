# Measurement Pipeline Hardening

Status: completed
Owner: Codex
Last updated: 2026-03-23

## Purpose / Big Picture

Arbiter is already close to research-grade on the important structural axes:

1. deterministic trial planning,
2. append-only artifacts with atomic finalization,
3. batch-boundary monitoring and stopping,
4. explicit debate-role provenance,
5. a clear harness-versus-analysis boundary in the docs.

The remaining gaps are not about basic correctness. They are about research honesty and auditability.

A first-principles audit against `docs/DESIGN.md` and `docs/RESEARCH-METHOD.md` found that Arbiter still has a few places where the saved study definition or persisted provenance does not fully match the executed estimand-defining state:

1. debate configs still require and carry a `sampling.protocols` pool that the debate planner never uses,
2. the policy-layer "samples per configuration cell" warning does not reflect the actual executed configuration space,
3. embedding-model drift is detected in memory but collapsed into ambiguous `null` provenance,
4. monitoring completeness is not explicitly recorded in artifacts,
5. a small amount of mock/live provenance parity and doc sync remains to be hardened.

A secondary audit of core infrastructure found a separate class of lower-risk issues that are worth absorbing into the same round once the research-contract mismatches are addressed:

1. JSONL append writes ignore stream backpressure even though close semantics are otherwise correct,
2. canonical JSON assumes acyclic input and would recurse indefinitely on a circular object,
3. `subscribeSafe` intentionally isolates handler errors from `flush()`, but that coupling is under-documented,
4. the OpenRouter client relies entirely on caller-supplied abort signals and has no defensive default timeout.

This plan hardens those gaps without changing Arbiter's scientific posture:

1. no new claims of correctness,
2. no change to the stopping algorithm,
3. no UI redesign,
4. no expansion of the paper's estimand beyond what the docs already claim.

The goal is to make the harness materially stronger for methodology review: a researcher or reviewer should be able to inspect run artifacts and determine what `Q(c)` and `M` actually were, whether provider-side drift occurred, whether online monitoring artifacts are complete enough to trust operationally, and whether the supporting I/O/runtime utilities fail in auditable rather than opaque ways.

## Scope Guardrails

In scope:

1. remove or explicitly isolate the dead `sampling.protocols` axis from debate study definitions,
2. align policy-layer configuration-space accounting with the actual executed trial space,
3. surface embedding-model drift explicitly in persisted provenance and warning surfaces,
4. record monitoring completeness in run artifacts,
5. tighten remaining mock/live provenance parity where it affects auditability,
6. add low-risk infrastructure guards for JSONL writes, canonical JSON, and client-side request timeouts,
7. sync any new durable semantics into canonical docs.

Out of scope:

1. changing debate semantics, role taxonomy, or prompt wording,
2. changing the stop policy algorithm or thresholds,
3. replacing the current novelty computation or clustering algorithm,
4. changing the TUI flow or copy beyond anything strictly required by schema or artifact truth,
5. adding new paper-analysis artifacts or downstream statistics,
6. introducing judge-mediated debate or other new protocol families.

Sequencing constraints:

1. schema and contract changes land before dependent code,
2. artifact/provenance changes land before doc sync,
3. debate `Q(c)` cleanup must precede any claim that policy accounting is "fixed."

Temporary coexistence rule:

1. if backward compatibility for old configs is required, it must be explicit and documented in the plan; do not silently keep dead fields while claiming the study definition is clean.

## Progress

- [x] M0: Reconfirm baseline and stale findings
- [x] M1: Remove the dead debate protocol-sampling axis from `Q(c)` surfaces
- [x] M2: Fix configuration-space accounting and policy warnings
- [x] M3: Surface embedding-model drift explicitly in provenance
- [x] M4: Record monitoring completeness and remaining provenance parity
- [x] M5: Low-risk infrastructure robustness guards
- [x] M6: Canonical doc sync and closure

## Surprises & Discoveries

1. Two items from prior review are already complete and should not be re-planned:
   - debate `protocol_invariant` is already included in `system_prompt_components`,
   - the `P=2, R=2` debate integration test already exists.
2. The more important open issue is not in the debate executor. It is in study-definition truth: debate configs still carry a required `sampling.protocols` pool that execution ignores.
3. Embedding-model drift is already partially implemented as in-memory state. The missing piece is artifact surfacing, not detection logic.
4. The infrastructure findings are real but lower priority than the `Q(c)` and provenance mismatches; they should not displace the research-contract fixes.
5. Legacy debate configs that still carry `sampling.protocols` are stripped at resolve time with a warning rather than hard-failing, which keeps old configs recoverable while restoring truthful resolved artifacts.
6. One intermediate integration failure during implementation was caused by stale `dist/` output, not source behavior; rebuild-backed validation is required before judging CLI integration regressions after schema changes.

## Decision Log

1. Treat the dead debate `sampling.protocols` axis as the highest-priority issue.
   Why:
   - it is a direct mismatch between declared `Q(c)` and executed `Q(c)`,
   - it affects config schema, templates, wizard output, and policy reasoning,
   - it is more fundamental than additive provenance polish.
2. Do not carry forward stale milestones from earlier drafts just because they were once valid.
   Why:
   - this plan must reflect current repo truth,
   - re-planning already-landed work makes handoff unsafe.
3. Keep embedding-model drift as a warning-and-provenance concern, not a hard run failure.
   Why:
   - drift is scientifically important,
   - but failing expensive runs by default is too destructive for the current harness posture.
4. Treat monitoring completeness as an operational integrity signal, not a paper-facing primary measurement.
   Why:
   - this aligns with `RESEARCH-METHOD.md`'s online-monitoring boundary.
5. Fold the infrastructure findings into this plan only as a secondary hardening slice.
   Why:
   - they are worth fixing,
   - but they do not redefine the estimand or the paper contract,
   - so they should land after the higher-priority study-definition and provenance work.

## Context and Orientation

### Governing docs read first

1. `AGENTS.md`
   Why: repo-wide invariants, validation policy, research claims discipline.
2. `docs/DESIGN.md`
   Why: durable semantics for `Q(c)`, `M`, provenance, stopping, and artifact expectations.
3. `docs/RESEARCH-METHOD.md`
   Why: current paper contract, especially the claim that both `Q(c)` and `M` are estimand-defining.
4. `README.md`
   Why: operator-facing contract and stated research-grade posture.
5. `docs/PLANS.md`
   Why: ExecPlan structure and completion rules for this repository.

### Relevant current-state files

Study definition and schema surfaces:

- `schemas/config.schema.json`
- `schemas/trial.schema.json`
- `schemas/manifest.schema.json`
- `src/config/resolve-config.ts`
- `src/config/policy.ts`
- `src/ui/wizard/draft.ts`
- `resources/templates/research/debate.config.json`
- `resources/templates/research/debate_d1.config.json`
- `resources/templates/research/debate_d2.config.json`
- `resources/templates/research/debate_d3.config.json`
- `resources/templates/research/debate_d4.config.json`

Execution and provenance surfaces:

- `src/planning/planner.ts`
- `src/protocols/debate/live-trial.ts`
- `src/protocols/debate/mock-trial.ts`
- `src/engine/live-trial-context.ts`
- `src/engine/live-runner.ts`
- `src/engine/mock-runner.ts`
- `src/embeddings/finalize.ts`
- `src/artifacts/artifact-writer.ts`
- `src/artifacts/manifest-builder.ts`

Monitoring and orchestration surfaces:

- `src/clustering/monitor.ts`
- `src/engine/monitoring.ts`
- `src/engine/run-orchestrator.ts`

Validation and reporting surfaces:

- `src/tools/verify-run.ts`
- `src/tools/report-run.ts`
- `test/integration/debate-run.test.mjs`
- `test/unit/policy.test.mjs`
- `test/integration/*.test.mjs`

### Current evidence that motivates this plan

1. `sampling.protocols` is required at schema level for all studies in `schemas/config.schema.json`, resolved unconditionally in `src/config/resolve-config.ts`, and written by the wizard in `src/ui/wizard/draft.ts`, but debate planning ignores it entirely in `src/planning/planner.ts`.
2. Debate templates still ship `protocol_independent_system` inside `sampling.protocols`, even though that axis is dead for debate runs.
3. `src/config/policy.ts` computes debate "cell count" as `modelCount * personaCount * personaCount`, which is not the full executed debate configuration space and does not reflect decode heterogeneity either.
4. `src/engine/live-trial-context.ts` already detects embedding model conflicts, but `src/engine/live-runner.ts` and `src/artifacts/artifact-writer.ts` only persist `actual_embedding_model: null`, losing the reason for ambiguity.
5. `src/clustering/monitor.ts` and `src/engine/run-orchestrator.ts` rely on batch-boundary synchronous handling, but run artifacts do not currently say whether monitoring coverage is complete.
6. `src/artifacts/io.ts` waits for `finish` on close, so pending JSONL writes are flushed correctly, but it ignores `stream.write()` backpressure and therefore has weaker correctness hygiene than it should.
7. `src/utils/canonical-json.ts` assumes acyclic input and would fail opaquely if a circular structure leaked into canonicalization.
8. `src/openrouter/client.ts` relies entirely on caller-supplied abort signals; it has no defensive default timeout if a caller forgets to provide one.

## Plan of Work

### M0: Reconfirm baseline and stale findings

What:

1. verify the repo is green,
2. verify stale findings are actually stale,
3. freeze the hardening scope around the real remaining gaps.

Why:

1. this plan builds on prior rounds and prior reviews,
2. it must not re-open already-landed work,
3. it must start from current repo truth, not thread memory.

Exit evidence:

1. `npm run test:merge` green,
2. current code inspection confirms:
   - debate `protocol_invariant` provenance already exists,
   - the `P=2, R=2` debate integration test already exists,
3. this plan updated to remove stale milestones.

### M1: Remove the dead debate protocol-sampling axis from `Q(c)` surfaces

What:

Make debate study definitions stop pretending that `sampling.protocols` is part of executed debate `Q(c)`.

Why:

1. `RESEARCH-METHOD.md` and `DESIGN.md` both treat `Q(c)` as estimand-defining,
2. carrying a required config axis that execution ignores is not research-honest,
3. this is the most important remaining mismatch between declared and executed study semantics.

Implementation targets:

1. `schemas/config.schema.json`
2. `src/config/resolve-config.ts`
3. `src/ui/wizard/draft.ts`
4. debate research templates under `resources/templates/research/`
5. any tests that currently assume debate configs must carry `sampling.protocols`

Decision to make during implementation:

1. either make `sampling.protocols` independent-only in schema and config generation,
2. or split study-definition schemas more explicitly by protocol type.

Preferred direction:

1. make debate configs stop requiring `sampling.protocols`,
2. preserve `sampling.protocols` for independent only.

Exit evidence:

1. debate configs validate without a protocol-sampling pool,
2. the wizard no longer injects `protocol_independent_system` into debate studies,
3. debate templates no longer carry a dead `sampling.protocols` field,
4. no debate runtime path depends on it.

Completed:

1. Debate configs no longer require `sampling.protocols` in schema.
2. Debate resolution strips legacy `sampling.protocols` with a warning so resolved artifacts remain truthful.
3. Wizard draft generation and debate templates no longer emit the dead field.

### M2: Fix configuration-space accounting and policy warnings

What:

Repair the policy-layer reasoning about per-cell sample adequacy so it matches the actual executed study space, or rename/reframe it if exact cell counting is not defensible.

Why:

1. current warnings are the only built-in guardrail users get about underpowered studies,
2. misleading optimism here cuts directly against the paper's budget-matched heterogeneity framing,
3. after M1, this becomes the next most important contract-honesty issue.

Implementation targets:

1. `src/config/policy.ts`
2. `test/unit/policy.test.mjs`
3. docs if terminology changes materially

Decision to make during implementation:

1. either compute a more faithful executed configuration-space cardinality,
2. or stop calling it "samples per configuration cell" and replace it with a more honest coverage heuristic.

Preferred direction:

1. be explicit if the warning is heuristic,
2. avoid presenting it as exact per-cell coverage unless it is actually exact for the active protocol.

Exit evidence:

1. policy warnings no longer materially understate debate configuration-space breadth,
2. tests cover both independent and debate warning behavior,
3. terminology in warnings is defensible against the methodological contract.

Completed:

1. Coverage messaging now reports discrete sampled configurations rather than misleading "configuration cells."
2. Debate coverage accounting now scales with independent per-slot draws.
3. Warning text explicitly notes decode variation as an additional thinning factor.

### M3: Surface embedding-model drift explicitly in provenance

What:

Persist the fact of embedding-model conflict, not just the ambiguous final `actual_embedding_model` value.

Why:

1. `M` includes the embedding model and provider behavior,
2. the code already detects drift in memory,
3. the artifact layer currently hides whether `null` means "missing" or "conflict."

Implementation targets:

1. `schemas/embeddings-provenance.schema.json`
2. `schemas/manifest.schema.json` if manifest summary needs the field
3. `src/engine/live-trial-context.ts`
4. `src/engine/live-runner.ts`
5. `src/artifacts/artifact-writer.ts`
6. `src/tools/verify-run.ts`
7. relevant tests

Preferred shape:

1. explicit boolean such as `embedding_model_conflict`,
2. optional note or warning event when conflict is observed,
3. preserve requested and last-known actual model semantics without overloading `null`.

Exit evidence:

1. a run that sees multiple embedding models records that fact in persisted provenance,
2. warning surfaces make the issue visible during or after the run,
3. the manifest remains schema-valid and backward-compatible where feasible.

Completed:

1. `embedding_model_conflict` is now persisted in embeddings provenance and summarized in the manifest.
2. Live runs emit a warning event when drift is observed.
3. Verification checks now treat the new provenance fields as part of the contract.

### M4: Record monitoring completeness and remaining provenance parity

What:

Add an explicit run-artifact signal for monitoring completeness, and close any remaining mock/live provenance parity gaps that materially affect auditability.

Why:

1. online monitoring is operationally important even if it is not a primary scientific output,
2. a silent missing monitoring record should be visible in artifacts,
3. mock/live parity matters because merge-gate confidence comes mostly from mock runs,
4. the orchestrator's `subscribeSafe` boundary is part of why monitoring completeness must be explicit rather than inferred.

Implementation targets:

1. `src/artifacts/artifact-writer.ts`
2. `schemas/manifest.schema.json`
3. `src/engine/run-orchestrator.ts`
4. `src/protocols/debate/mock-trial.ts`
5. `test/integration/*.test.mjs`

Concrete goals:

1. record `monitoring_complete: boolean` or equivalent manifest-level integrity signal,
2. ensure expected monitoring record count can be checked against batch count,
3. assess whether missing `persona_prompt` provenance in mock debate should be mirrored for fidelity,
4. document the intentional consequence that `subscribeSafe` errors do not surface through `EventBus.flush()`.

Exit evidence:

1. manifest records whether monitoring coverage was complete,
2. integrity behavior is covered by tests,
3. any retained mock/live differences are intentional and documented.

Completed:

1. Manifests now record `monitoring_complete`, expected monitoring records, and recorded monitoring records.
2. Verification checks compare those manifest counts against the actual `monitoring.jsonl` rows.
3. Mock debate provenance now includes persona-prompt components so the main merge-gate path more closely mirrors live execution.

### M5: Low-risk infrastructure robustness guards

What:

Address the low-risk but real infrastructure issues from the secondary audit without expanding scope into speculative rewrites.

Why:

1. these issues are not currently causing research-significant corruption,
2. but a research-grade harness should fail in explainable ways and not rely on fragile assumptions where cheap guards exist,
3. landing them in the same round avoids leaving known hygiene debt immediately next to the measurement hardening work.

Implementation targets:

1. `src/artifacts/io.ts`
2. `src/utils/canonical-json.ts`
3. `src/openrouter/client.ts`
4. `src/events/event-bus.ts` or `docs/DESIGN.md` / comments, depending on how the `subscribeSafe` boundary is documented
5. relevant unit tests

Concrete goals:

1. handle JSONL stream backpressure correctly or document why the chosen implementation is sufficient,
2. add circular-reference detection to canonical JSON,
3. add a defensive default timeout to OpenRouter requests while preserving caller override,
4. document latency semantics clearly if they continue to exclude rate-limiter wait,
5. document the `subscribeSafe`/`flush()` boundary rather than pretending it does not exist.

Exit evidence:

1. JSONL writing has explicit backpressure handling or an intentional, documented alternative,
2. canonical JSON fails fast with a clear error on cyclic input,
3. OpenRouter requests have a safety-net timeout even when callers omit a signal,
4. the handler-isolation boundary is documented in code and/or canonical docs,
5. targeted tests cover the new guards where practical.

Completed:

1. JSONL writing now respects stream backpressure before close completes.
2. Canonical JSON now rejects circular structures with a clear error.
3. OpenRouter requests now add a defensive timeout when the caller omits one.
4. The `subscribeSafe` / `flush()` boundary is documented in code and canonical docs.

### M6: Canonical doc sync and closure

What:

Move any durable semantics introduced by M1-M5 into canonical docs and close the loop cleanly.

Why:

1. this repo does not allow ExecPlans to remain the only source of lasting truth,
2. hardening without doc sync is not complete under `docs/PLANS.md`.

Implementation targets:

1. `docs/DESIGN.md`
2. `docs/RESEARCH-METHOD.md` if the `Q(c)`/`M` framing needs clarification
3. `README.md` only if operator-facing behavior changes materially
4. optional comment in `src/engine/run-orchestrator.ts` documenting synchronous `batch.completed` handling assumptions

Exit evidence:

1. all durable semantics are represented in canonical docs,
2. plan can truthfully be marked `completed`,
3. residual risks are documented.

Completed:

1. `docs/DESIGN.md` now reflects debate `Q(c)` truth, embedding drift provenance, and monitoring completeness semantics.
2. `docs/RESEARCH-METHOD.md` now reflects debate `Q(c)` interpretation and coverage-warning heuristics.
3. This plan can now be closed truthfully.

## Milestones and Gates

| Milestone | Entry | Exit | Gate / evidence |
|-----------|-------|------|-----------------|
| M0 | plan accepted | stale findings removed, baseline reconfirmed | `npm run test:merge` green; plan reflects current repo truth |
| M1 | M0 complete | debate study definition no longer carries dead protocol-sampling state | schema/tests/templates/wizard aligned |
| M2 | M1 complete | coverage warning is honest for the executed protocol space | unit/integration evidence for policy behavior |
| M3 | M2 complete | embedding drift is explicitly surfaced in artifacts | schema-valid manifest/provenance evidence |
| M4 | M3 complete | monitoring completeness and remaining provenance parity are explicit | manifest/test evidence |
| M5 | M4 complete | low-risk infrastructure guards land without altering scientific posture | targeted unit/integration evidence for guards |
| M6 | M5 complete | durable docs updated and residual risk captured | canonical doc sync complete |

Ordering principle:

1. fix the estimand-definition mismatch first,
2. then fix study-space accounting,
3. then harden provenance and monitoring integrity,
4. then land the low-risk infrastructure guards,
5. then sync durable docs.

## Concrete Steps

1. Re-run and record baseline validation with `npm run test:merge`.
2. Update config schema and resolution logic so debate no longer requires or emits `sampling.protocols` unless intentionally supported.
3. Update debate templates and wizard draft generation to stop writing dead protocol-sampling fields.
4. Fix policy-layer study-space accounting or warning terminology, and add tests that pin the intended behavior.
5. Extend embeddings provenance and manifest summaries to encode embedding-model conflict explicitly.
6. Emit a warning event when embedding-model conflict is detected.
7. Add monitoring completeness tracking at manifest finalization time.
8. Decide and implement any necessary mock/live provenance parity improvement that materially affects auditability.
9. Add the infrastructure guards for JSONL backpressure, canonical JSON cycle detection, and defensive request timeout handling.
10. Document any retained event-bus / latency semantics that remain intentional.
11. Update canonical docs with the new durable semantics.
12. Re-run merge-gate validation and record residual risks.

## Validation and Acceptance

Required validation:

1. `npm run check:types`
2. `npm run check:schemas`
3. `npm run test:unit`
4. `npm run test:integration:nobuild`
5. `npm run test:merge`

Acceptance criteria:

1. Debate configs no longer declare a protocol-sampling axis that execution ignores.
2. Debate templates and wizard-generated debate configs are truthful about the executed study definition.
3. Policy warnings about coverage/configuration space are no longer materially misleading for debate.
4. Embedding-model conflict is explicitly persisted and distinguishable from "no actual embedding model available."
5. Manifest artifacts record whether monitoring coverage was complete.
6. Any retained mock/live provenance differences are documented and justified.
7. JSONL writing, canonical JSON, and OpenRouter timeout behavior have explicit guards or explicit documented rationale.
8. `docs/DESIGN.md` and any other affected canonical docs reflect the new durable semantics.

Residual validation gap that would block truthful completion:

1. if debate still requires `sampling.protocols` after this round, the plan must not be marked complete.

## Idempotence and Recovery

1. Each milestone should land as a separate commit.
2. If a milestone goes bad, revert only that milestone's commit and return to the previous green state.
3. Schema changes must be paired with regenerated types in the same milestone to avoid half-migrated states.
4. If backward compatibility for old debate configs is retained, recovery guidance must document how old and new forms are both interpreted.

## Interfaces and Dependencies

Expected schema surfaces to change:

1. `schemas/config.schema.json`
2. `schemas/embeddings-provenance.schema.json`
3. `schemas/manifest.schema.json`

Expected generated outputs:

1. `src/generated/config.types.ts`
2. `src/generated/embeddings-provenance.types.ts`
3. `src/generated/manifest.types.ts`

Likely implementation dependencies:

1. `resolve-config.ts`
2. `planner.ts`
3. `policy.ts`
4. `live-runner.ts`
5. `artifact-writer.ts`
6. `verify-run.ts`
7. `io.ts`
8. `canonical-json.ts`
9. `openrouter/client.ts`
10. `event-bus.ts`

## Handoffs and Ownership

Before implementation handoff, the implementer should be able to state:

1. whether debate `sampling.protocols` was removed, scoped, or explicitly retained,
2. how policy accounting was reframed or corrected,
3. how embedding-model conflict is now represented in artifacts,
4. how monitoring completeness is determined,
5. which low-risk infrastructure guards landed and which were only documented,
6. which durable docs were updated.

Required handoff artifacts:

1. changed schemas and regenerated types,
2. validation output summary,
3. list of updated docs,
4. any backward-compatibility note for old configs.

## Artifacts and Notes

Current baseline evidence:

1. `npm run test:merge` passes before this round starts.
2. Debate `protocol_invariant` provenance is already present in live and mock debate call records.
3. The `P=2, R=2` debate integration path is already covered.

This plan intentionally supersedes stale earlier hardening assumptions without changing its filename, because the work has not started and the current path is already referenced as the next hardening round.

## Plan Change Notes

2026-03-24 03:08Z

1. Rewrote the proposed plan to match current repo truth after audit.
2. Removed stale milestones for debate invariant provenance and R>=2 debate testing; both are already implemented.
3. Added the higher-priority `Q(c)` contract issue around dead debate `sampling.protocols`.
4. Elevated policy-space accounting to a first-class hardening target.
5. Kept embedding drift and monitoring completeness hardening, but reframed them around the actual remaining gaps.

2026-03-24 03:34Z

1. Folded in the secondary audit's low-risk infrastructure findings without letting them displace the research-contract fixes.
2. Added explicit scope for JSONL backpressure, canonical JSON cycle detection, and defensive OpenRouter timeout handling.
3. Expanded the monitoring milestone to document the `subscribeSafe` / `flush()` boundary rather than leaving it implicit.
4. Renumbered doc sync to preserve dependency order: estimand honesty first, infrastructure cleanup later.
