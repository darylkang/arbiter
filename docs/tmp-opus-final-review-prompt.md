# TEMP: Final External Audit Prompt (Opus)

Use this prompt with Claude Opus for final architecture sign-off before implementation.

---

You are doing a final independent architecture audit of the Arbiter codebase.

Date context: February 7, 2026.

Goal:
1. Review the current codebase from first principles.
2. Review the implementation guide in:
   - `/Users/darylkang/Developer/arbiter/docs/tmp-foundation-rebuild-plan.md`
   - `/Users/darylkang/Developer/arbiter/docs/tmp-tui-cutover-plan.md`
3. Decide if the non-UI rebuild plan is ready for execution with minimal risk and maximal long-term flexibility.

Scope constraints:
1. Focus on non-UI foundation first.
2. UI implementation is intentionally deferred, but verify that current decisions do not limit future UI/TUI flexibility.
3. Assume zero need to preserve legacy runtime code paths (git history is sufficient).
4. Respect schema-first and determinism constraints.

Required output format:

## 1) Final verdict
- `GREEN` if safe to start implementation now.
- `YELLOW` if mostly safe but requires non-blocking adjustments.
- `RED` if blocked; implementation should not begin yet.

## 2) Blocking issues (if any)
- Ordered by severity.
- Include exact file paths and line numbers where possible.
- Explain concrete risk and what must change.

## 3) Sequence audit
- Validate whether the planned sequence is correct:
  - guardrails/utilities
  - executor decomposition
  - run-service boundary
  - immutable compiled plan
  - hardening
- Call out any ordering mistakes that would create avoidable rework or regression risk.

## 4) Determinism and provenance audit
- Confirm no proposed step weakens:
  - seeded planning determinism
  - trial_id ordering guarantees
  - append-only JSONL and atomic finalization invariants
  - requested vs actual model provenance behavior

## 5) Future UI flexibility audit
- Confirm whether the current locked constraints are sufficient to keep UI highly decoupled from core logic.
- Identify missing preparatory decisions (if any) that should be locked before coding begins.

## 6) Final recommendation
- Provide a concise “start now” or “fix these first” recommendation.
- If not GREEN, include the minimum patch list required to reach GREEN.

Quality bar:
1. Be strict, concrete, and implementation-oriented.
2. Do not provide generic advice; tie claims to this repository’s actual structure.
3. Optimize for correctness, maintainability, and low-risk migration.

