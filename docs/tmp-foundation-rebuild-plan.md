# TEMP: Foundation Rebuild Plan (Non-UI First, Zero Legacy Residue)

Status: Draft for implementation  
Owner: Codex  
Created: 2026-02-07  
Scope: Non-UI architecture, runtime, artifacts, determinism, provenance  
Delete before final merge: Yes (unless explicitly requested to keep)

---

## 1) Intent

Rebuild Arbiter from first principles so the core system is deterministic, auditable, and evolvable, with zero legacy architecture residue at cutover.  
UI/UX redesign is deferred to the next stage unless blocked by a core interface decision.

---

## 2) What is already strong

- Schema-first workflow is real and enforced.
- Determinism invariants are mostly implemented and tested.
- Artifact and provenance discipline are already above average.
- Non-UI quality gates pass locally (types, schemas, mock/live-adjacent smoke, verify, clustering, contracts, embeddings, pack).

---

## 3) High-priority findings from deep audit

### P1: orchestration/UI boundary is still mixed

- `src/run/run-service.ts` imports UI concerns directly:
  - receipt formatting/rendering/writing
  - execution log rendering
- This violates clean layering, even if `engine -> ui` imports are currently avoided.

Evidence:
- `/Users/darylkang/Developer/arbiter/src/run/run-service.ts:15`
- `/Users/darylkang/Developer/arbiter/src/run/run-service.ts:19`

### P1: engine owns artifact finalization details

- Engine runners call embedding finalization and debug file cleanup directly.
- This spreads persistence concerns into execution core and weakens event-driven separation.

Evidence:
- `/Users/darylkang/Developer/arbiter/src/engine/live-runner.ts:9`
- `/Users/darylkang/Developer/arbiter/src/engine/live-runner.ts:1141`
- `/Users/darylkang/Developer/arbiter/src/engine/mock-runner.ts:9`
- `/Users/darylkang/Developer/arbiter/src/engine/mock-runner.ts:534`

### P1: concurrent batch failure semantics can leave in-flight work running

- `runBatch` rejects on first trial error but does not actively cancel remaining in-flight work.
- This creates brittle semantics under provider/network faults and complicates predictable shutdown.

Evidence:
- `/Users/darylkang/Developer/arbiter/src/engine/live-runner.ts:1034`
- `/Users/darylkang/Developer/arbiter/src/engine/mock-runner.ts:432`

### P1: policy behavior is split across service and artifact writer

- `contract_failure_policy=fail` has both pre-return checks and manifest mutation behavior.
- Functional behavior is correct today, but policy is not centralized in a single authoritative state transition model.

Evidence:
- `/Users/darylkang/Developer/arbiter/src/run/run-service.ts:166`
- `/Users/darylkang/Developer/arbiter/src/artifacts/artifact-writer.ts:638`

### P2: repeated validator compilation on hot path

- Decision contract validator is compiled for each parsed output call.
- Compile once per run contract and reuse.

Evidence:
- `/Users/darylkang/Developer/arbiter/src/engine/contract-extraction.ts:190`

### P2: JSONL stream writes do not honor backpressure

- Writer appends via `stream.write()` without drain handling or explicit write result checks.
- Works for current scale, but this is an avoidable reliability ceiling.

Evidence:
- `/Users/darylkang/Developer/arbiter/src/artifacts/io.ts:15`

### P2: verification path is memory-heavy for large runs

- `verify-run` reads full JSONL files into memory with `readFileSync`.
- Should stream and aggregate to keep verification bounded and fast.

Evidence:
- `/Users/darylkang/Developer/arbiter/src/tools/verify-run.ts:38`

### P2: module size and duplication are high

- `live-runner.ts` and `mock-runner.ts` duplicate substantial execution structure.
- Increases risk and slows changes.

Current hotspots:
- `src/engine/live-runner.ts` (~1200 LOC)
- `src/engine/mock-runner.ts` (~593 LOC)
- `src/artifacts/artifact-writer.ts` (~657 LOC)

---

## 4) Rebuild principles

1. Determinism is a product feature, not an implementation detail.
2. Events are canonical for run progression; artifact files are projections.
3. Execution core must not know about rendering or terminal behavior.
4. Policy must be centralized in explicit state transitions.
5. Failure and cancellation semantics must be deterministic and testable.
6. Cutover means deletion, not compatibility shims.

---

## 5) Target architecture (clean-slate, non-UI)

### Layers

- `domain/`
  - pure logic: planner, stopping, parsing rules, clustering math, policy decisions
  - no IO, no time, no network
- `application/`
  - run coordinator state machine
  - batch scheduler, cancellation orchestration
  - emits typed domain events
- `ports/`
  - model provider, embedding provider, artifact sink, clock, rng, logger
- `adapters/`
  - OpenRouter adapter
  - filesystem artifact projector/writer
  - CLI adapter

### Core flow

1. `compile-run` stage:
  - load + validate config/catalog/prompts/contracts
  - apply defaults and policy
  - build immutable `compiled-run` package
2. `execute-run` stage:
  - consume `compiled-run` only
  - generate deterministic trial plan
  - run batch state machine
  - emit events
3. `project-artifacts` stage:
  - consume event stream
  - write JSONL append-only during run
  - finalize atomically

### Boundary rules

- No `engine|domain|application -> ui` imports.
- No filesystem/network access from domain logic.
- Artifact projection must be replaceable without touching execution core.

---

## 6) Proposed 2026 stack (non-UI foundation)

Note: pin exact versions at implementation start and validate in CI.

- Runtime:
  - Node.js 24 LTS
  - TypeScript 5.9+ strict mode
- Package management:
  - `pnpm` workspaces (single package now, workspace-ready structure)
  - `changesets` for release discipline
- Lint/format/static:
  - `Biome` for formatting + lint baseline
  - `knip` for dead code/dependency drift checks
- Testing:
  - `Vitest` for unit/integration tests
  - `fast-check` for determinism/property tests
- Observability:
  - OpenTelemetry SDK (traces/metrics around run lifecycle)
  - structured JSON logs
- Schema/runtime validation:
  - JSON Schema 2020-12 + Ajv
  - precompiled validators for hot paths where useful

---

## 7) Implementation plan (non-UI)

### Phase 0: lock invariants and constraints

- Write/confirm architecture tests for forbidden imports and layer boundaries.
- Freeze artifact contract expectations against `docs/spec.md` and schemas.

Exit criteria:
- Boundary tests fail on any illegal import path.

### Phase 1: create new foundation package layout

- Introduce clean module tree under `src/core` (or equivalent):
  - `domain`, `application`, `ports`, `adapters`
- Keep existing runtime intact initially; no behavior changes yet.

Exit criteria:
- New module skeleton compiles with zero behavior wiring.

### Phase 2: compile-run boundary

- Implement deterministic `compile-run` output artifact.
- Ensure execution consumes only compiled inputs.

Exit criteria:
- Same input config produces same compiled package hash.

### Phase 3: unified executor

- Build one batch executor used by both mock and live provider adapters.
- Define explicit cancellation/error policy for in-flight tasks.

Exit criteria:
- Mock and live share one execution state machine.

### Phase 4: artifact projector extraction

- Move finalization, file projection, and cleanup out of runners.
- Runners emit events; projector writes artifacts.

Exit criteria:
- Engine has no artifact finalization logic.

### Phase 5: policy centralization

- Centralize contract-failure policy handling in execution state transitions.
- Keep manifest mutation logic declarative and derived from terminal state.

Exit criteria:
- Policy outcomes derive from one source of truth.

### Phase 6: legacy cutover and deletion

- Switch CLI wiring to new core.
- Remove obsolete legacy modules and glue.
- Keep UI untouched for now except boundary-safe integration points.

Exit criteria:
- No legacy core paths referenced by CLI/runtime.

---

## 8) Zero-legacy acceptance criteria (for foundation stage)

1. No runtime imports from deprecated core paths.
2. No duplicate runner implementations with divergent logic.
3. No artifact finalization inside engine runners.
4. No policy split across unrelated layers.
5. All mandatory checks pass:
   - `npm run check:types`
   - `npm run check:schemas`
   - `npm run test:mock-run`
   - `npm run test:templates`
   - `npm run test:verify`
   - `npm run test:debate`
   - `npm run test:clustering`
   - `npm run test:embeddings`
   - `npm run test:pack`
   - `npm run test:ui` (even if UI is deferred, existing suite must stay green)

---

## 9) Risks and mitigations

- Risk: accidental behavior drift during decomposition.
  - Mitigation: preserve golden-run fixtures and invariant/property tests.
- Risk: migration stall from oversized PRs.
  - Mitigation: phase gates with strict exit criteria and small, atomic commits.
- Risk: hidden coupling from CLI/UI integration.
  - Mitigation: import boundary checks in CI and adapter-only wiring.

---

## 10) Opus review integration placeholder

When Opus audit arrives, add:

1. agreement items
2. disagreements and rationale
3. architecture deltas adopted
4. roadmap changes

---

## 11) Immediate next step after Opus response

Produce a merged architecture decision record:

- `docs/tmp-foundation-rebuild-plan.md` (this file, updated)
- includes final module map, migration sequence, and deletion checklist
- then start Phase 0 implementation

