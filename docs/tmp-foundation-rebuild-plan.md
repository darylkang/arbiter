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

UI/TUI redesign is deferred until the non-UI foundation reaches the `run-service` decoupling boundary.

---

## 2) Current diagnosis

1. Core intent is strong: schema-first, deterministic planning, append-only artifacts, and provenance are already differentiators.
2. Main risk is structure, not immediate correctness.
3. `live-runner.ts` / `mock-runner.ts` size and duplication are the highest maintainability risk.
4. `run-service.ts` currently imports UI modules directly, violating the architecture boundary.
5. The next rebuild must treat unit tests, retry hardening, and dead-code cleanup as first-class workstreams.

---

## 3) Highest-severity findings

### High

1. God module risk in live execution path  
Evidence: `/Users/darylkang/Developer/arbiter/src/engine/live-runner.ts`

2. Structural duplication across live and mock paths  
Evidence: `/Users/darylkang/Developer/arbiter/src/engine/live-runner.ts`, `/Users/darylkang/Developer/arbiter/src/engine/mock-runner.ts`

3. No unit-test layer for pure algorithms (integration-only posture)

4. Architecture boundary violation at service layer (`run-service` importing UI)  
Evidence: `/Users/darylkang/Developer/arbiter/src/run/run-service.ts:15`

### Medium

1. Duplicate JSON extraction logic in contract/debate paths
2. Duplicate vector math in monitoring/clustering paths
3. Event bus is sync-only (no async handler `flush` semantics)
4. Fixed retry backoff without jitter or `Retry-After` handling
5. Clustering novelty computation grows O(k^2) with run scale
6. Dead event path (`manifest.updated`) exists but is not emitted

### Low

1. Hardcoded debate protocol path in config resolution
2. Missing event envelope versioning/deprecation strategy
3. Scattered literal prompt-type strings

---

## 4) Rebuild principles

1. Determinism is a product feature, not a side-effect.
2. Engine emits events; artifacts and UI are projections.
3. Execution core is UI-agnostic and transport-aware.
4. Policy outcomes come from one explicit state transition model.
5. Failure/cancellation semantics are explicit and testable.
6. Cutover means deletion, not compatibility shims in runtime code paths.

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

Note: keep `src/openrouter/*` during the rebuild for low-risk migration. Only promote to `src/transport/openrouter/*` if a second provider is introduced.

---

## 6) Locked execution decisions (non-arbitrary)

1. Unit-test runtime: use built-in `node:test` now; add `fast-check` for property tests.
2. Architecture enforcement: combine guard scripts (`rg`) with TypeScript project-reference boundaries as modules are split.
3. Retry policy: exponential backoff + jitter, honor `Retry-After`, keep per-call retry caps.
4. Client-side flow control: add optional token-bucket limiter for OpenRouter calls.
5. Event contract: move to versioned event envelope (`type`, `version`, `sequence`, `emitted_at`, `payload`) and retain typed payload map.
6. Clustering scalability: keep exact novelty logic as default; add explicit high-scale mode behind config (never implicit behavior changes).
7. Debate models: add optional per-role overrides (`proposer`, `critic`, `finalizer`) while preserving current single-model fallback.
8. Compatibility: `verify`/`report` remain compatible with pre-rebuild run directories via version-aware readers.
9. Package manager: keep `npm` during core rebuild; evaluate `pnpm` after backend cutover to avoid mixed-scope churn.

---

## 7) Control flow and boundaries

### Runtime flow

1. CLI parse
2. resolve + validate + policy
3. compile immutable run package (`CompiledRunPlan`)
4. run-service executes plan via lifecycle hooks
5. engine batch executor runs trial executor
6. event subscribers project artifacts and monitor convergence
7. finalization (atomic writes + embedding finalization)
8. lifecycle hooks render/report at CLI/UI layer

### Boundary rules

1. no `engine|planning|core|run -> ui` imports
2. no filesystem/network in `core`
3. no `Math.random` in `core|planning|engine|clustering`
4. config object immutable once execution starts
5. UI reads typed events/artifacts only; it cannot mutate execution state

---

## 8) Sequence plan (non-UI first)

### Sequence A: Guardrails + shared utility extraction

1. add architecture guard script (forbidden imports, forbidden randomness, dead event names)
2. add unit/property test scaffolding (`node:test`, `fast-check`)
3. extract shared vector math into `core/vector-math.ts`
4. extract shared JSON extraction into `core/json-extraction.ts`
5. delete duplicate helper implementations

Exit gate:
1. `check:types`, `check:schemas`, `test:mock-run`, `test:clustering`, `test:debate`

### Sequence B: Executor decomposition + protocol extraction

1. introduce `TrialExecutor` and shared `batch-executor`
2. refactor live/mock runners onto shared batch orchestration
3. split independent/debate protocol logic into protocol modules
4. move contract extraction/validation under `protocols/contract`
5. add per-role model override support (schema-first + generated types + tests)

Exit gate:
1. `test:mock-run`, `test:debate`, `test:contracts`, `test:provenance`

### Sequence C: Service boundary + immutable plan

1. define `RunLifecycleHooks`
2. remove direct UI imports from `run-service`
3. move receipt/log presentation wiring to CLI/UI adapters
4. deduplicate mock/live service setup
5. introduce frozen `CompiledRunPlan`

Exit gate:
1. `rg 'from.*\.\./ui/' src/run/` returns zero matches
2. full AGENTS mandatory suite passes

### Sequence D: Hardening + cleanup

1. remove dead `manifest.updated` event path
2. add async-capable event bus with optional `flush()`
3. add retry jitter + `Retry-After` + optional rate limiter
4. add compatibility tests for old run directories in `verify`/`report`
5. complete unit + property test matrix and architecture guard checks

Exit gate:
1. full AGENTS mandatory suite plus new unit/property/guard tests passes

---

## 9) Test strategy

### Unit tests (new, critical)

Targets:
1. seeded RNG and planner sampling determinism
2. JSON extraction and contract parsing fallback semantics
3. vector math, entropy, divergence
4. online leader clustering
5. batch executor stop/error behavior
6. retry policy logic and `Retry-After` precedence

### Integration tests (existing scripts, keep)

Keep and continue running:
1. mock/debate/contracts/clustering/embeddings/provenance/verify/templates/pack/ui scripts

### Property tests

1. deterministic seed implies deterministic plan hash
2. cosine similarity stays in [-1, 1]
3. canonical JSON stability
4. entropy non-negativity

### Architecture guard tests

1. forbidden import checks
2. no `Math.random` in deterministic core paths
3. no stale dead events
4. no runtime service references to legacy UI flags/paths

---

## 10) UI/TUI readiness constraints (locked now)

Decision: UI implementation remains deferred until `run-service` decoupling is complete.

To keep UI highly flexible later:

1. `RunLifecycleHooks` is the only execution-lifecycle integration surface.
2. Hook/event payloads stay framework-agnostic (no Ink/React/pi-tui specific types in core).
3. TUI command layer maps to stable non-UI commands (`resolve`, `mock-run`, `run`, `verify`, `report`).
4. Event envelope versioning is established before TUI cutover.
5. Receipt/report formatting stays outside engine.
6. UX inspirations (OpenClaw and Claude Code style transcript UX) are treated as design references only, not architectural constraints on core modules.
7. UI runtime should sit behind an adapter so TUI framework changes do not force core rewrites.

Allowed before this boundary:
1. isolated TUI scaffolding in new files only

---

## 11) Zero-legacy acceptance criteria

1. no duplicate core helper implementations remain
2. no `run-service` or `engine` imports from `ui`
3. no artifact finalization logic inside engine executors
4. no dead event paths retained
5. no `Math.random` in deterministic core paths
6. legacy wizard/force-ink runtime plumbing removed when TUI cutover phase begins

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

## 12) Opus final green-light checklist

Request a strict go/no-go review against this guide and ask for:

1. any missing architectural constraints that would block long-term flexibility
2. any sequence ordering errors that increase migration risk
3. any determinism/provenance regressions introduced by these decisions
4. explicit verdict: `GREEN`, `YELLOW`, or `RED`, with blocking reasons if not `GREEN`

---

## 13) Immediate next step

No implementation starts in this step.  
Use this guide as the single baseline and obtain final external review approval before coding.
