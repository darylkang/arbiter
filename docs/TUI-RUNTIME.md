# Arbiter TUI Runtime Architecture

Purpose: define Arbiter's internal TUI runtime layer as a first-class architectural contract.

This document is durable implementation truth for the TUI runtime itself. It is not the user-facing behavior spec and it is not a feature plan.

Use this document when changing:

1. wizard screen architecture,
2. dashboard or receipt rendering architecture,
3. terminal lifecycle ownership,
4. render primitives, view models, and formatter behavior,
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
3. a declarative layout tree or virtual DOM unless future product shape proves the current model insufficient,
4. transcript or chat UX,
5. plugin surfaces or arbitrary third-party widgets,
6. mouse support as a primary interaction model,
7. UI-driven scheduling, stop decisions, or trial planning.

If Arbiter grows into a concurrent multi-pane application with nested focus and arbitrary component composition, reevaluate this architecture deliberately instead of stretching it ad hoc.

## 3) Architectural Principles

The runtime follows these principles.

1. State before rendering.
   Screen controllers produce typed screen state and view models. Renderers do not infer business logic.

2. One terminal owner.
   Terminal mode, cursor visibility, alternate-screen entry, scroll regions, redraw policy, and teardown are owned by runtime seams, not by feature code.

3. Pure render functions.
   Screens are rendered through pure functions that accept typed view data plus formatter/runtime context and return strings with no hidden side effects.

4. Renderer monopoly.
   Only approved runtime seams may emit ANSI control sequences or write directly to stdout.

5. Truthful presentation.
   The UI may summarize or format data, but must not invent semantics the engine does not emit.

6. Deterministic validation.
   The runtime must support deterministic fixture tests and rendered snapshot validation against the real ANSI output.

7. Explicit constraints.
   Supported terminal widths, heights, and fallback behavior are part of the contract, not hidden assumptions.

## 4) Layer Model

Arbiter's TUI runtime is a five-layer stack.

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

Primary files today:

1. `src/ui/wizard/steps.ts`
2. `src/ui/wizard/app.ts`
3. `src/ui/wizard/flows.ts`

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

Current or target examples:

1. `StepFrame` for Stage 1 shell composition,
2. `DashboardVM` for Stage 2 monitor composition,
3. `ReceiptVM` for Stage 3 receipt composition,
4. `WorkerRow`, `RailStep`, and related leaf display structures.

Responsibilities:

1. convert domain objects into display-ready values,
2. carry already-decided labels, summaries, and emphasis states,
3. isolate formatting decisions from business logic,
4. make fixture-driven rendering tests possible.

Rules:

1. view models may contain strings, numbers, and display metadata, but not terminal escape codes,
2. view models may not call stdout or own terminal dimensions,
3. view models should prefer semantic display fields over renderer-time inference.

### 4.4) Render Primitives and Formatter

Primary files today:

1. `src/ui/wizard-theme.ts`
2. `src/ui/fmt.ts`
3. future small helper modules if the primitive surface grows

Responsibilities:

1. provide pure render primitives such as rail steps, ruled sections, progress bars, key-value rows, worker rows, separators, and status strips,
2. centralize glyph, spacing, and style-token usage,
3. keep rendering composable without forcing a more abstract tree than Arbiter currently needs.

Rules:

1. render primitives are pure functions: input data in, string out,
2. style is expressed through semantic formatter methods, not hardcoded raw ANSI in feature code,
3. full-screen composition should remain a composition of pure render functions over typed view models,
4. ad hoc string assembly in controllers is forbidden once equivalent render primitives exist,
5. render primitives must accept explicit width/context parameters rather than reading terminal globals directly.

### 4.5) Terminal Runtime and Frame Ownership

Primary files today:

1. `src/ui/wizard/frame-manager.ts`
2. `src/ui/run-lifecycle-hooks.ts`
3. `src/ui/tui-constraints.ts`

Responsibilities:

1. enter and exit alternate screen when required,
2. hide and restore cursor safely,
3. own redraw regions and teardown,
4. enforce supported terminal constraints,
5. contain all direct terminal control sequences.

Non-negotiable rule:
all direct TUI `process.stdout.write(...)` calls must route through approved runtime seams or a narrowly approved fallback path documented in this file.

Approved write ownership should converge toward:

1. `src/ui/wizard/frame-manager.ts` for Stage 1 runtime writes,
2. `src/ui/run-lifecycle-hooks.ts` for Stage 2 and Stage 3 runtime writes,
3. widget-local fallback writes only where no frame-manager path is yet available and while tracked explicitly in tests.

## 5) Screen Contracts

Every screen or region must have a typed contract.

Minimum required fields:

1. purpose,
2. state input shape,
3. view-model shape,
4. render function entrypoint,
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

1. widgets accept typed inputs and return typed outcomes,
2. widgets do not own global terminal lifecycle,
3. widgets must clean up raw mode and listeners on both success and exception paths,
4. widgets must not perform blocking network or filesystem side effects except through explicit controller calls,
5. widgets render through injected render callbacks or approved runtime seams,
6. widget APIs should not leak screen-wide string ownership back into controllers.

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
3. render primitives must consume formatter tokens rather than hardcoding colors in feature code,
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

Current runtime contract:

1. Stage 1 re-renders immediately against the new terminal dimensions.
2. Stage 2 re-measures width, rows, and frozen-prefix height on every render tick.
3. If Stage 2 drops below the live-dashboard minimum (`60x15`), it renders the explicit dashboard-too-small warning in the live region instead of the premium dashboard.
4. If the terminal recovers before completion, Stage 2 resumes premium dashboard rendering from current state.
5. If a run finishes while the terminal is still below the live-dashboard minimum, Stage 3 falls back to plain `receipt.txt` output.

## 9) Testing and Validation Model

The internal runtime must support framework-grade validation discipline without introducing a second full rendering implementation.

Required validation layers:

1. unit tests for formatter behavior and individual render primitives,
2. fixture tests for full-screen composition using the real render functions with a plain or no-color formatter,
3. PTY end-to-end tests for interactive flows,
4. rendered snapshot capture via `npm run capture:tui` with `index.txt` and machine-readable `index.json`,
5. human ANSI review through `scripts/tui-terminal-viewer.html` when visual polish is being judged.

Deterministic review model:

1. live runtime emits ANSI through the real renderer,
2. `@xterm/headless` converts captured ANSI into deterministic rendered text,
3. rendered text snapshots are treated as structural truth for agent review, and Stage 2 / Stage 3 snapshot text may include scrollback so the full run-path stack is inspectable,
4. no separate text renderer backend should exist unless a future need proves the current approach insufficient.

The formatter should support a plain or no-color mode so render primitives can be unit-tested without ANSI noise.

Required invariant tests:

1. no direct renderer bypass from feature code,
2. terminal cleanup on thrown widget errors,
3. supported and unsupported dimension behavior,
4. scrollback preservation at Stage 2 to Stage 3 handoff,
5. receipt artifact remains ANSI-free and structurally correct.

## 10) Architecture Guards

The runtime layer is only credible if it is enforced.

Guards to add or preserve:

1. a repository test that forbids direct `process.stdout.write` in feature modules outside approved seams,
2. a repository test that forbids raw ANSI control sequences outside approved seams,
3. fixture-based regression tests for canonical screens,
4. capture-based regression tests for key checkpoint screens,
5. width and height matrix tests for minimum-supported and standard terminal sizes.

Approved direct-write seams should remain narrow and explicit.

## 11) Migration Rules

The runtime may be hardened incrementally, but coexistence must be explicit.

Allowed during migration:

1. current string-returning render primitives remaining in place,
2. new view models for Stage 2 and Stage 3 being introduced before broader cleanup,
3. temporary widget fallback paths while runtime ownership is consolidated,
4. stale implementation guidance in product specs being updated in lockstep with runtime decisions.

Not allowed during migration:

1. introducing a second competing rendering architecture,
2. adding new direct ANSI writes in feature modules,
3. leaving runtime-visible truth only in an ExecPlan after migration is complete.

## 12) Definition of Done for the Internal Runtime Layer

Arbiter's TUI runtime is considered framework-grade for its intended scope when all of the following are true:

1. every user-facing TUI screen is expressed through typed view models and pure render primitives,
2. ANSI emission is centralized in runtime seams,
3. Stage 1, Stage 2, and Stage 3 share one formatter vocabulary and one terminal lifecycle model,
4. scrollback, resize, unsupported-terminal behavior, and receipt artifact behavior are explicitly tested,
5. contributors can add or modify a screen by following documented contracts rather than reverse-engineering imperative terminal behavior,
6. rendered text snapshots and PTY flows provide deterministic review evidence for every TUI round.

## 13) Revisit Trigger

Reevaluate this architecture if Arbiter's product shape crosses these thresholds:

1. multiple concurrently focusable panes,
2. nested modal layering over live dashboards,
3. transcript or chat-style streaming content mixed with interactive controls,
4. richer dynamic composition that no longer maps cleanly to pure string-returning primitives,
5. mouse-driven interaction becoming a primary UX requirement.

If those conditions become central to the product, perform an explicit framework reassessment rather than stretching this runtime indefinitely.
