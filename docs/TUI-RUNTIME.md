# Arbiter TUI Runtime Architecture

Purpose: define Arbiter's internal TUI runtime layer as a first-class architectural contract.

This document is durable implementation truth for the TUI runtime itself. It is not the user-facing behavior spec and it is not a feature plan.

Use this document when changing:

1. wizard screen architecture,
2. dashboard or receipt rendering architecture,
3. terminal lifecycle ownership,
4. render primitives and layout nodes,
5. TUI testing and validation infrastructure.

For product truth, use this order:

1. `docs/product-specs/tui-wizard.md` for behavior and interaction semantics,
2. `docs/product-specs/tui-copy-deck.md` for locked and flexible copy,
3. `docs/product-specs/tui-visual-screen-deck.md` for exact visual targets,
4. this document for internal runtime architecture and contributor rules.

If this document conflicts with the product-spec docs on user-visible behavior, copy, or visual composition, the product-spec docs win.

## 1) Why Arbiter Has a Custom TUI Runtime

Arbiter does not need a general-purpose terminal UI framework.

It does need framework-level rigor for a narrower product shape:

1. Stage 1 wizard with one active step at a time,
2. Stage 2 run monitor with bounded live updates,
3. Stage 3 receipt and process exit,
4. strict scrollback guarantees,
5. research-honest copy and artifact boundaries.

The goal is not to recreate Ink's generality.
The goal is to give Arbiter Ink-level engineering discipline while preserving direct control over:

1. terminal scrollback behavior,
2. frozen versus live regions,
3. exact line grammar,
4. TTY fallback behavior,
5. narrow-domain layout primitives tuned to Arbiter's design language.

## 2) Non-Goals

This runtime is intentionally narrow.

Out of scope:

1. a reusable npm package for arbitrary terminal apps,
2. React-style component trees or hooks,
3. mouse support as a primary interaction model,
4. transcript or chat UX,
5. plugin surfaces or arbitrary third-party widgets,
6. UI-driven scheduling, stop decisions, or trial planning.

If Arbiter grows into a concurrent multi-pane application with nested focus and arbitrary component composition, reevaluate this architecture deliberately instead of stretching it ad hoc.

## 3) Architectural Principles

The runtime follows these principles.

1. State before rendering.
   Screen controllers produce typed screen state and view models. Renderers do not infer business logic.

2. One terminal owner.
   Terminal mode, cursor visibility, alternate-screen entry, scroll regions, and teardown are owned by runtime seams, not by feature code.

3. Declarative screen composition.
   Screens are expressed as layout nodes and view models, not assembled as ad hoc arrays of strings.

4. Renderer monopoly.
   Only renderer/runtime seams may emit ANSI control sequences or write directly to stdout.

5. Truthful presentation.
   The UI may summarize or format data, but must not invent semantics the engine does not emit.

6. Deterministic validation.
   The runtime must support deterministic text rendering for snapshot tests in addition to interactive ANSI rendering.

7. Explicit constraints.
   Supported terminal widths, heights, and fallback behavior are part of the contract, not hidden assumptions.

## 4) Layer Model

Arbiter's TUI runtime is a six-layer stack.

### 4.1) Domain and Engine Events

Source files:

1. `src/engine/*`
2. `src/events/*`
3. `src/ui/receipt-model.ts`

Responsibilities:

1. define execution state and event semantics,
2. emit truthful monitor data,
3. remain independent from UI code.

Non-negotiable rule:
engine code must not import renderer, frame, or view-model code.

### 4.2) Screen State Machine

Primary files:

1. `src/ui/wizard/steps.ts`
2. `src/ui/wizard/app.ts`
3. future `src/ui/runtime/screen-machine.ts` if extracted

Responsibilities:

1. own stage and step transitions,
2. define which screen is active,
3. decide what data each screen needs,
4. resolve outcomes such as `goto`, `save`, `run`, and `exit`.

Rules:

1. controllers may read domain state and produce view models,
2. controllers may not own ANSI details,
3. controllers may not mutate terminal mode,
4. controllers may not write directly to stdout.

### 4.3) View Models

A view model is the renderer-facing shape of one screen or region.

Examples:

1. `StatusStripVM`
2. `BrandBlockVM`
3. `RailVM`
4. `ChoiceListVM`
5. `ReviewVM`
6. `DashboardVM`
7. `ReceiptVM`

Responsibilities:

1. convert domain objects into display-ready values,
2. carry already-decided labels, summaries, and emphasis states,
3. isolate formatting decisions from business logic.

Rules:

1. view models may contain strings and flags, but not terminal escape codes,
2. view models may contain presentation metadata such as `muted`, `accent`, or `warning`,
3. view models may not call stdout or own terminal dimensions.

### 4.4) Layout Tree

The layout tree is Arbiter's internal declarative render structure.

It is intentionally smaller than a general-purpose component framework.

Initial node families should include only what Arbiter needs:

1. `screen`
2. `stack`
3. `line`
4. `text`
5. `separator`
6. `brandBlock`
7. `rail`
8. `choiceList`
9. `kvList`
10. `ruledSection`
11. `progressBar`
12. `workerTable`
13. `footer`
14. `receiptArtifacts`

Rules:

1. layout nodes describe intent, not ANSI,
2. layout nodes may carry style tokens and width policies,
3. layout nodes must be serializable enough for deterministic test fixtures,
4. ad hoc string concatenation in controllers is forbidden once a screen is migrated.

### 4.5) Renderer Backends

Arbiter needs two renderer backends.

1. ANSI runtime backend
2. deterministic text backend

The ANSI backend is the user-facing terminal renderer.
The text backend exists for snapshot tests and agent-readable rendered output.

Shared obligations:

1. consume the same layout tree,
2. honor the same width and height constraints,
3. use the same glyph and token vocabulary,
4. produce equivalent structural output.

Backend-specific obligations:

1. ANSI backend owns color, cursor, alt-screen, and scroll-region behavior,
2. text backend emits plain rendered text without ANSI sequences.

### 4.6) Terminal Runtime and Frame Ownership

Primary files:

1. `src/ui/wizard/frame-manager.ts`
2. `src/ui/run-lifecycle-hooks.ts`
3. future shared runtime module if Stage 1 and Stage 2 ownership is unified further

Responsibilities:

1. enter and exit alternate screen when required,
2. hide and restore cursor safely,
3. own redraw regions and teardown,
4. enforce supported terminal constraints,
5. contain all direct terminal control sequences.

Non-negotiable rule:
all direct `process.stdout.write(...)` for TUI rendering must route through this layer or an approved renderer seam.

## 5) Screen Contracts

Every screen or region must have a typed contract.

Minimum required fields:

1. purpose,
2. state input shape,
3. view-model shape,
4. layout root node,
5. accepted user inputs,
6. transition outcomes,
7. validation hooks,
8. test fixture examples.

For Arbiter, the required runtime screen families are:

1. onboarding entry,
2. onboarding mode,
3. editable setup steps,
4. review and preflight,
5. frozen Stage 1 summary,
6. Stage 2 monitor,
7. Stage 3 receipt,
8. non-TTY and unsupported-terminal fallbacks.

## 6) Input and Widget Discipline

Raw-key widgets remain valid, but they must behave like framework-owned controls.

Primary file today:

1. `src/ui/wizard/controls.ts`

Rules:

1. widgets accept view-model input and return typed outcomes,
2. widgets do not own global terminal lifecycle,
3. widgets must clean up raw mode and listeners on both success and exception paths,
4. widgets must not perform blocking network or filesystem side effects except through explicit controller calls,
5. widgets may render only through renderer-approved primitives.

Allowed widget families:

1. single choice,
2. multi choice,
3. multiline question entry,
4. inline numeric or text entry,
5. file selection,
6. read-only confirmation.

## 7) Style Tokens and Primitive Vocabulary

Visual truth still lives in the product specs, but the runtime owns how those tokens are represented internally.

The runtime must centralize:

1. color/style token identifiers,
2. glyph role identifiers,
3. spacing constants,
4. terminal-width policies,
5. fallback behavior for limited terminals.

Rules:

1. glyph roles are semantic and exclusive,
2. style tokens are named semantically, not by raw ANSI codes,
3. layout primitives must consume tokens rather than hardcoding colors or glyphs,
4. product-spec changes to copy or visual grammar must map cleanly through these tokens, not bypass them.

## 8) Terminal Constraints and Failure Modes

Terminal support is explicit.

The runtime must define:

1. minimum supported width,
2. minimum supported height for premium dashboard mode,
3. what happens below those thresholds,
4. whether a given screen falls back, degrades, or refuses to render.

Rules:

1. unsupported dimensions must produce an explicit operator-visible message or fallback path,
2. no silent broken rendering is allowed,
3. resize behavior must trigger re-render from the current state, not partial patching based on stale assumptions.

## 9) Testing and Validation Model

The internal runtime must support framework-grade validation discipline.

Required validation layers:

1. unit tests for view-model builders and primitive renderers,
2. fixture tests for layout-tree to text rendering,
3. PTY end-to-end tests for interactive flows,
4. rendered snapshot capture via `npm run capture:tui`,
5. human ANSI review through `scripts/tui-terminal-viewer.html` when visual polish is being judged.

Required invariant tests:

1. no direct renderer bypass from feature code,
2. terminal cleanup on thrown widget errors,
3. supported and unsupported dimension behavior,
4. scrollback preservation at Stage 2 to Stage 3 handoff,
5. consistency between text-render backend and ANSI backend structure.

## 10) Architecture Guards

The runtime layer is only credible if it is enforced.

Guards to add or preserve:

1. a repository test that forbids direct `process.stdout.write` in feature modules outside approved renderer/runtime seams,
2. a repository test that forbids raw ANSI control sequences outside approved renderer/runtime seams,
3. fixture-based regression tests for canonical screens,
4. capture-based regression tests for key checkpoint screens.

Approved direct-write seams should remain narrow and explicit.

## 11) Migration Rules

The runtime may be migrated incrementally, but coexistence must be explicit.

Allowed during migration:

1. legacy string-based screens living beside new layout-tree screens,
2. adapters that convert old view data into new layout nodes,
3. temporary dual rendering paths guarded by milestone boundaries.

Not allowed during migration:

1. mixing direct ANSI writes into newly migrated screens,
2. leaving migrated screens without fixture coverage,
3. leaving product-spec truth only in an ExecPlan after migration is complete.

## 12) Definition of Done for the Internal Runtime Layer

Arbiter's TUI runtime is considered framework-grade for its intended scope when all of the following are true:

1. every user-facing TUI screen is expressed via typed view models and layout nodes,
2. ANSI emission is centralized in renderer/runtime seams,
3. Stage 1, Stage 2, and Stage 3 share one renderer vocabulary and one terminal lifecycle model,
4. scrollback, resize, and unsupported-terminal behavior are explicitly tested,
5. contributors can add or modify a screen by following documented contracts rather than reverse-engineering imperative string assembly,
6. rendered text snapshots and PTY flows provide deterministic review evidence for every TUI round.

## 13) Revisit Trigger

Reevaluate this architecture if Arbiter's product shape crosses these thresholds:

1. multiple concurrently focusable panes,
2. nested modal layering over live dashboards,
3. transcript or chat-style streaming content mixed with interactive controls,
4. rich dynamic composition that exceeds the current primitive set,
5. mouse-driven interaction becoming a primary UX requirement.

If those conditions become central to the product, perform an explicit framework reassessment rather than stretching this runtime indefinitely.
