# TEMP: Foundation Rebuild Plan (Non-UI First, Implementation Guide)

Status: Draft for implementation  
Owner: Arbiter core rebuild effort  
Created: 2026-02-07  
Updated: 2026-02-07  
Scope: Non-UI architecture, determinism, artifacts, reliability, test strategy  
Delete before final merge: Yes (unless explicitly requested to keep)

---

## 1) Objective

Rebuild Arbiter from first principles so the foundation is deterministic, auditable, and easy to evolve, then cut over with zero legacy architecture residue (excluding git history).

UI/TUI redesign is explicitly deferred until the foundation reaches the Phase 4 boundary defined below.

---

## 2) Current diagnosis

1. Core intent is strong: schema-first, deterministic planning, and provenance are real advantages.
2. Main risk is structure, not immediate functionality.
3. `live-runner.ts` / `mock-runner.ts` duplication and size are the top maintainability risk.
4. `run-service.ts` UI imports are a direct architecture-boundary violation.
5. The rebuild should include unit tests, retry hardening, and dead-code cleanup as first-class workstreams.

---

## 3) Highest-severity findings

### High

1. God module risk in live execution path  
Evidence: `/Users/darylkang/Developer/arbiter/src/engine/live-runner.ts`

2. Structural duplication across live and mock paths  
Evidence: `/Users/darylkang/Developer/arbiter/src/engine/live-runner.ts`, `/Users/darylkang/Developer/arbiter/src/engine/mock-runner.ts`

3. No unit-test layer for pure algorithms (integration-only test posture)

4. Architecture boundary violation at service layer (`run-service` importing UI)  
Evidence: `/Users/darylkang/Developer/arbiter/src/run/run-service.ts:15`

### Medium

1. Duplicate JSON extraction logic in contract/debate paths
2. Duplicate vector math in monitoring/clustering paths
3. Event bus is sync-only (no async handler flush semantics)
4. Fixed retry backoff without jitter
5. Clustering novelty computation grows O(k^2) with run scale
6. Dead event path (`manifest.updated`) exists but is not used

### Low

1. Hardcoded debate protocol path in config resolution
2. Missing event versioning/deprecation strategy
3. Scattered literal prompt-type strings

---

## 4) Rebuild principles

1. Determinism is a product feature, not a side-effect.
2. Engine emits events; artifacts are projections.
3. Execution core is UI-agnostic and transport-agnostic.
4. Policy outcomes come from one state transition model.
5. Failure and cancellation semantics are explicit and testable.
6. Cutover means deletion, not compatibility shims.

---

## 5) Target architecture (explicit module layout)

```text
src/
  core/
    vector-math.ts
    json-extraction.ts
    seeded-rng.ts
    canonical-json.ts
    hash.ts
    float32-base64.ts

  config/
    resolve-config.ts
    schema-validation.ts
    policy.ts
    manifest.ts
    defaults.ts

  planning/
    planner.ts
    compiled-plan.ts

  protocols/
    types.ts
    independent/
      executor.ts
      parser.ts
    debate-v1/
      executor.ts
      messages.ts
      parser.ts
    contract/
      extraction.ts
      validator.ts

  engine/
    batch-executor.ts
    trial-executor.ts
    live-executor.ts
    mock-executor.ts
    embed-text.ts
    embedding-finalizer.ts
    status.ts

  transport/
    openrouter/
      client.ts
      retry.ts
      rate-limiter.ts
      types.ts

  events/
    event-bus.ts
    types.ts

  artifacts/
    artifact-coordinator.ts
    writers/
      jsonl-writer.ts
      json-atomic.ts
    run-dir.ts
    run-id.ts
    embeddings-provenance.ts

  clustering/
    online-leader.ts
    monitor.ts

  run/
    run-service.ts
    lifecycle-hooks.ts

  cli/
  ui/
  tools/
  generated/
```

---

## 6) Control flow and boundaries

### Runtime flow

1. CLI parse
2. resolve + validate + policy
3. compile immutable run package (`CompiledRunPlan`)
4. run-service executes plan with lifecycle hooks
5. engine batch executor runs trial executor
6. event subscribers project artifacts and monitor convergence
7. finalization (atomic writes, embeddings finalize)
8. lifecycle hooks render/report at CLI layer

### Boundary rules

1. no `engine|planning|core|run -> ui` imports
2. no filesystem/network in `core`
3. no `Math.random` in `core|planning|engine|clustering`
4. config object immutable once execution starts

---

## 7) Technology choices (2026)

### Adopt

1. Node.js 24 LTS
2. TypeScript 5.9+ strict
3. JSON Schema 2020-12 + Ajv (continue)
4. Apache Arrow artifact format (continue)
5. `Biome` for formatting/linting
6. `fast-check` for property tests
7. OpenTelemetry instrumentation hooks (minimal initial footprint)

### Testing runner decision

Default baseline: built-in `node:test` for unit tests (lower tooling overhead, native ESM).  
If DX needs become material, re-evaluate `Vitest` later without changing test strategy.

### Transport hardening

1. exponential backoff + jitter
2. optional token-bucket rate limiting (client-side)

---

## 8) Phased implementation plan (non-UI)

### Phase 0: architecture guardrails and invariants

1. add guard tests for forbidden imports, `Math.random`, and dead legacy paths
2. lock artifact invariants with verify checks

Exit gate:
1. boundary guard script fails on violations

### Phase 1: extract shared pure utilities (no behavior change)

1. extract shared vector math into `core/vector-math.ts`
2. extract shared JSON extraction into `core/json-extraction.ts`
3. delete duplicated helpers at old call sites

Exit gate:
1. `check:types`, `test:mock-run`, `test:clustering`, `test:debate` all pass

### Phase 2: shared batch executor and trial interface

1. introduce `TrialExecutor` interface
2. move batch worker-pool loop into `engine/batch-executor.ts`
3. refactor live/mock to use shared batch orchestration

Exit gate:
1. behavior parity in existing integration tests
2. runner LOC drops significantly

### Phase 3: protocol extraction and executor decomposition

1. split independent/debate protocol logic into protocol modules
2. move contract extraction/validation under `protocols/contract`
3. keep live/mock executors thin

Exit gate:
1. `test:debate`, `test:contracts`, `test:mock-run` pass

### Phase 4: run-service decoupling from UI (critical boundary)

1. define `RunLifecycleHooks`
2. remove direct UI imports from `run-service`
3. move receipt/log presentation wiring to CLI layer hooks
4. deduplicate shared setup between mock/live service functions

Exit gate:
1. `rg 'from.*../ui/' src/run/` returns zero matches
2. all existing test suites remain green

### Phase 5: immutable compiled plan boundary

1. introduce frozen `CompiledRunPlan`
2. move planner to `planning/`
3. ensure execution consumes read-only compiled inputs

Exit gate:
1. deterministic plan reproducibility checks pass

### Phase 6: hardening and cleanup

1. remove dead `manifest.updated` event path
2. add async-capable event bus with optional `flush()`
3. implement retry jitter and optional client rate limiter
4. complete unit + property test matrix

Exit gate:
1. full mandatory suite + new unit/property/guard tests pass

---

## 9) Test strategy (explicit)

### Unit tests (new, critical)

Targets:
1. seeded RNG / planner sampling
2. JSON extraction + contract parsing
3. vector math, entropy, divergence
4. online leader clustering
5. batch executor stop/error behavior

### Integration tests (existing scripts, keep)

Keep and continue running:
1. mock/debate/contracts/clustering/embeddings/provenance/verify/templates/pack/ui scripts

### Property tests

1. deterministic seed -> deterministic plan hash
2. cosine similarity range bounds
3. canonical JSON stability
4. entropy non-negativity

### Architecture guard tests

1. forbidden import checks
2. no `Math.random` in deterministic core paths
3. no stale dead events

---

## 10) Execution sequence (not time-based)

1. Sequence A: Phases 0-2
2. Sequence B: Phases 3-5
3. Sequence C: Phase 6 and cleanup sweep
4. TUI implementation starts only after Phase 4 boundary is complete

---

## 11) UI/TUI decision

Decision: defer implementation until non-UI Phase 4 is complete.

Rationale:
1. TUI should depend on `RunLifecycleHooks`, not today’s coupled service layer
2. concurrent core+TUI rewiring creates avoidable merge and rollback risk
3. pre-release status favors architecture-first sequencing

Allowed in parallel before Phase 4:
1. TUI scaffolding in isolated new files only (no shared runtime rewiring)

### UI/TUI readiness decisions to lock now

1. `RunLifecycleHooks` is the only UI integration surface for execution lifecycle.
2. Hook payloads must stay framework-agnostic (no Ink/React types).
3. Event payload shape changes require explicit versioning strategy before TUI cutover.
4. Artifact contract remains source of truth; UI must read from artifacts or typed events, not internal mutable state.
5. Receipt/report rendering stays in CLI/UI layer; execution core only emits data and events.
6. TUI command model should map to stable non-UI commands (`resolve`, `mock-run`, `run`, `verify`, `report`) rather than bespoke hidden behavior.

---

## 12) Zero-legacy acceptance criteria

1. no duplicate core helper implementations remain
2. no `run-service` or `engine` imports from `ui`
3. no artifact finalization logic inside engine executors
4. no dead event paths retained
5. no `Math.random` in deterministic core paths

Validation commands:

```bash
rg 'const extractFencedJson' src
rg 'const vectorNorm' src
rg 'const cosineSimilarity' src
rg 'from.*\.\./ui/' src/run/
rg 'from.*\.\./ui/' src/engine/
rg 'manifest\.updated' src
rg 'Math\.random' src/core/ src/engine/ src/clustering/ src/planning/
```

Mandatory gates from AGENTS:
1. `npm run check:types`
2. `npm run check:schemas`
3. `npm run test:mock-run`
4. `npm run test:templates`
5. `npm run test:verify`
6. `npm run test:debate`
7. `npm run test:clustering`
8. `npm run test:embeddings`
9. `npm run test:pack`
10. `npm run test:ui`
11. `npm run test:provenance` (if OpenRouter/live behavior touched)

---

## 13) Open questions before implementation

1. Should `verify` guarantee compatibility for pre-rebuild run directories?
2. What is the target upper bound for `k_max` (to size novelty computation strategy)?
3. Do we want heterogeneous debate roles (different models per proposer/critic) in this rebuild?
4. Do we want `pnpm` migration in this phase, or defer package-manager change until after core cutover?

---

## 14) Immediate next step (current conversation)

No implementation starts yet.  
Use this guide as the baseline, confirm unresolved decisions in section 13 plus UI readiness decisions in section 11, then start Phase 0.
