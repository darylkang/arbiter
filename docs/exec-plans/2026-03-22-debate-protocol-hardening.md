# Debate Protocol Hardening

Status: completed
Owner: Codex
Last updated: 2026-03-22

## Purpose / Big Picture

Arbiter's current `debate_v1` implementation already supports the two paper-critical parameters the user called out:

1. `participants = P`,
2. `rounds = R`,

with turn order `A..P` repeated for each round and a final slot `A` response after the last round.

That part is already durable system truth in:

1. [docs/DESIGN.md](../DESIGN.md)
2. [src/planning/planner.ts](../../src/planning/planner.ts)
3. [src/protocols/debate-v1/live-trial.ts](../../src/protocols/debate-v1/live-trial.ts)
4. [src/ui/wizard/flows.ts](../../src/ui/wizard/flows.ts)

What is still hollow is the *semantic structure* of the debate:

1. slot `A` is treated as proposer/finalizer,
2. every non-`A` slot currently shares the same critic prompt,
3. participants beyond two are therefore mostly redundant except for model/persona heterogeneity,
4. role assignments do not currently carry a research-grade role taxonomy,
5. prompt layering between protocol role and sampled persona is not yet deliberate enough.

This plan proposes a first-pass research-grade design for a richer debate protocol that remains compatible with Arbiter's core measurement posture:

1. parameterized by `P` and `R`,
2. fixed final-output semantics on slot `A`,
3. role prompts as part of protocol design,
4. sampled model/persona assignment per slot as part of `Q(c)`,
5. no silent drift into a judge-mediated protocol unless that is deliberately introduced as a separate protocol family.

## Scope Guardrails

In scope:

1. define the debate protocol semantics more precisely,
2. define a role taxonomy for slots,
3. define how role prompts and sampled personas interact,
4. define how `P` and `R` should be interpreted in the paper and in implementation,
5. define what metadata/artifacts need to change for research-grade provenance,
6. identify what is worth implementing in the existing `debate_v1` family versus what deserves a new protocol family.

Out of scope:

1. implementing code changes in this round,
2. introducing a judge-mediated protocol into the current `debate_v1` contract,
3. changing the final-output measurement rule that parse/embed semantics apply to slot `A` final output only,
4. changing model/persona sampling semantics outside debate-specific role structure,
5. changing the paper's broader claims outside the debate/H4 rung.

Sequencing constraints:

1. freeze protocol semantics before changing prompt assets,
2. decide whether roles are fixed-by-slot or sampled before changing planner/runtime schemas,
3. preserve the current final-output measurement contract unless a separate protocol family is created,
4. treat any shift from "A-finalizer debate" to "judge-mediated debate" as a new protocol family, not a silent rewrite.

## Progress

- [x] M0 — current-state audit and first-pass protocol design frozen
- [x] M1 — role taxonomy and prompt architecture frozen
- [x] M2 — artifact/schema/runtime delta defined
- [x] M3 — Opus review and stress-test feedback incorporated

## Surprises & Discoveries

1. The repo already implements the user's desired `P`/`R` turn schedule and final `A` response semantics. The missing piece is not parameterization; it is *role structure*.
2. Current runtime semantics already treat all non-`A` participants as critics by prompt, even when `P > 2`. This means `P = 3, 4, ...` increases participant count without increasing role diversity.
3. The protocol currently mixes two very different research traditions:
   - collaborative multi-agent debate / society-of-minds,
   - adversarial debate for weaker-judge oversight.
   Arbiter currently fits the first family better than the second because slot `A` owns the final answer and there is no separate judge.
4. The current prompt composition order places sampled persona text ahead of the role prompt. The hardened design should reverse that ordering so role defines task and persona modulates execution.
5. `P > 4` is mechanically supportable but not a first-class research zone because additional slots only duplicate responder roles rather than add new ones.

## Decision Log

### D1. Keep `P` and `R` as the primary debate parameters

This is already the right public parameterization:

1. each round consists of every participant speaking once in slot order,
2. after the last full round, slot `A` gives the final answer,
3. total turns remain `P * R + 1`.

### D2. Keep `A`-finalizer semantics for the current debate family

For Arbiter's current design, the debate family should remain:

1. a lead/finalizer protocol,
2. not a judge-mediated protocol,
3. not a "random side assignment" oversight game.

Rationale:

1. current measurement semantics already treat final slot `A` output as canonical,
2. this keeps debate comparable to Independent as "one final answer per trial",
3. introducing a judge would change both protocol semantics and measurement interpretation,
4. judge-mediated debate is valuable, but it deserves a separate protocol family later, e.g. `debate_judge_v1`.

### D3. Introduce fixed protocol roles by slot, not sampled roles, for v1 hardening

Recommended rule:

1. slot roles are deterministic functions of slot index,
2. model/persona/decode are still sampled per slot from the configured pools,
3. role is part of protocol design, not part of H2/H3 sampling.

Rationale:

1. if roles are sampled, role variance gets entangled with slot and turn-order effects,
2. fixed roles make the transcript interpretable and auditable,
3. role heterogeneity can be studied later as a protocol-family comparison rather than hidden inside one protocol.

### D4. Role prompts should dominate sampled persona prompts

Recommended composition order for system prompts:

1. role prompt,
2. persona prompt (optional, sampled),
3. protocol-wide constraints,
4. decision contract clause on final `A` turn only.

Rationale:

1. protocol role defines what the participant is supposed to do in the debate,
2. persona should modulate the reasoning style of that role, not replace it,
3. the current ordering risks persona text overpowering role structure.

### D5. Treat `P = 2..4` as the primary research-grade participant range

Interpretation:

1. `P = 2` adds one structurally distinct responder role (`challenger`),
2. `P = 3` adds a second structurally distinct responder role (`counter`),
3. `P = 4` saturates the designed role set with `auditor`,
4. `P > 4` duplicates responder roles and is therefore exploratory rather than primary.

## Context and Orientation

Reviewed first:

1. [AGENTS.md](../../AGENTS.md)
2. [docs/PLANS.md](../PLANS.md)
3. [docs/DESIGN.md](../DESIGN.md)
4. [docs/RESEARCH-METHOD.md](../RESEARCH-METHOD.md)
5. [src/planning/planner.ts](../../src/planning/planner.ts)
6. [src/protocols/debate-v1/live-trial.ts](../../src/protocols/debate-v1/live-trial.ts)
7. [src/protocols/debate-v1/mock-trial.ts](../../src/protocols/debate-v1/mock-trial.ts)
8. [resources/prompts/protocols/debate_v1](../../resources/prompts/protocols/debate_v1)
9. [docs/product-specs/tui-wizard.md](../product-specs/tui-wizard.md)

External references reviewed:

1. OpenAI, *AI Safety via Debate* ([openai.com/index/debate](https://openai.com/index/debate/))
2. Du et al., *Improving Factuality and Reasoning in Language Models through Multiagent Debate* ([arXiv:2305.14325](https://arxiv.org/abs/2305.14325))
3. Kenton et al., *On scalable oversight with weak LLMs judging strong LLMs* ([arXiv:2407.04622](https://arxiv.org/pdf/2407.04622))

Current implementation summary:

1. planner samples one model/persona/decode assignment per slot and keeps it fixed within a trial,
2. slot `A` is special-cased as proposer and finalizer,
3. all non-`A` slots currently share the critic prompt,
4. each turn sees the full prior transcript,
5. final parse/embed semantics apply only to final slot `A` output.

## Plan of Work

The work should proceed in this order:

1. freeze what the current debate family *is*,
2. define a richer slot-role taxonomy for `debate_v1`-style lead/finalizer debate,
3. define role-prompt templates and their interaction with personas,
4. define schema/artifact deltas needed for provenance,
5. decide what belongs in a future separate `debate_judge_v1` family,
6. then implement after external review.

## Milestones and Gates

### M0 — First-Pass Debate Semantics Freeze

Exit criteria:

1. `P` and `R` semantics are restated precisely,
2. slot `A` semantics are explicit,
3. a clear decision is made on judge-less vs judge-mediated families,
4. the role taxonomy is frozen at least for the first implementation pass.

### M1 — Role Taxonomy and Prompt Architecture

Exit criteria:

1. each slot role has a concrete research purpose,
2. each slot role has a system-prompt template,
3. role-vs-persona composition order is frozen,
4. open questions for larger `P` values are explicit.

### M2 — Schema and Artifact Delta

Exit criteria:

1. required additions to `role_assignments`, transcript records, and manifest/provenance are explicit,
2. the paper-facing interpretation of these additions is documented,
3. rollout does not silently change final-output semantics.

### M3 — External Stress Test

Exit criteria:

1. the first-pass design is handed to Opus for critique,
2. reviewer objections are cataloged,
3. design is either revised or promoted to implementation-ready.

## First-Pass Protocol Proposal

### 1. Debate Family Definition

Recommended interpretation of the current debate family:

- name: `lead_finalizer_debate`
- protocol id: keep `debate_v1` until a future migration
- semantics:
  1. slot `A` is the lead/finalizer,
  2. slots `B..` are responders with fixed role types,
  3. each round runs `A, B, C, ...`,
  4. after the last round, slot `A` gives the final canonical answer,
  5. parse/embed/decision semantics apply only to that final `A` answer.

### 2. Role Taxonomy

Recommended fixed-by-slot role set:

1. `A = lead`
   - opens the debate,
   - maintains the current best answer,
   - responds to objections and alternatives,
   - delivers the final canonical answer.

2. `B = challenger`
   - applies adversarial pressure,
   - identifies the strongest objection or failure mode in the current leading answer.

3. `C = counter`
   - presents the strongest competing answer,
   - not just critique, but a genuinely different position from the lead.

4. `D = auditor`
   - examines assumptions and dependencies,
   - identifies what would change if a key assumption were false.

5. `E+ = cycle from responder bank`
   - for `P > 4`, cycle `challenger -> counter -> auditor`.

Research recommendation:

1. support `P >= 2` mechanically,
2. treat `P = 2..4` as the primary research-grade zone,
3. treat `P > 4` as exploratory unless later evidence justifies richer role diversity.

### 3. Role Prompt Templates

Recommended role prompts:

#### `lead_system`

> Propose the best answer to the question. In subsequent rounds, address the objections and competing answers raised by other participants.

#### `challenger_system`

> Identify the strongest objection or failure mode in the current leading answer.

#### `counter_system`

> Present the strongest competing answer that differs from the lead's position.

#### `auditor_system`

> Identify the most important unstated assumption in the current debate and state what would change if that assumption were false.

#### `lead_final_system`

> Synthesize the full debate and deliver a final self-contained answer that addresses the strongest objections and competing positions.

### 4. Prompt Composition

Recommended system prompt assembly:

1. role prompt,
2. sampled persona prompt if present,
3. protocol invariant block:
   - be concise,
   - engage prior turns directly,
   - add new information instead of repeating the full transcript,
4. decision contract clause on final `A` turn only.

This keeps role as protocol truth and persona as modulation.

### 5. Turn Prompt Structure

Current `buildDebatePrompt()` is too generic. Recommended user-turn structure:

1. question,
2. current round and slot,
3. brief turn objective derived from role,
4. transcript so far.

Example:

```text
Question:
{question}

Current turn:
round {r}, slot {slot}, role {role_kind}

Your task for this turn:
{role_turn_instruction}

Prior turns:
...
```

This is better than the current generic "Provide your response for round X."

### 5. Primary Research Matrix

Recommended H4 matrix:

| ID | P | R | Turns | Primary interpretation |
|----|---|---|-------|------------------------|
| D1 | 2 | 1 | 3 | minimal interaction baseline |
| D2 | 3 | 1 | 4 | role diversity effect (+ counter) |
| D3 | 2 | 2 | 5 | round-depth effect |
| D4 | 4 | 1 | 5 | full role saturation (+ auditor) |

Interpretation:

1. `D1 -> D2` isolates role diversity at `R = 1`,
2. `D1 -> D3` isolates round depth at `P = 2`,
3. `D2 -> D4` isolates auditor contribution at `R = 1`,
4. `P = 4, R = 2` and `P > 4` remain exploratory rather than primary.

### 6. Role Metadata and Provenance

Recommended schema/artifact additions:

1. extend `role_assignments[slot]` to include:
   - `slot`
   - `role_kind`
   - `role_prompt_id`
   - `role_prompt_sha256`

2. extend transcript records to include:
    - `slot`
   - `role_kind`
   - `round`
   - `turn_index`

3. include `transcript_hash` at the trial level for the complete serialized debate transcript seen by the finalizer.
4. optionally include `finalizer_slot: "A"` in trial/debate metadata for explicitness.

This is necessary if role structure is part of the paper-facing protocol definition.

### 7. What Not To Add To `debate_v1`

Do not fold these into the current family:

1. a separate judge model,
2. side-assigned adversarial debate where agents argue fixed opposite answers,
3. open-debate variants where agents choose sides dynamically.

Those are scientifically valuable but should be separate protocol families because they change who owns the final answer and what the transcript means.

Recommended future family:

- `debate_judge_v1`
  - two or more debaters,
  - separate judge/finalizer,
  - different measurement semantics.

## Validation and Acceptance

This design round is complete when:

1. the repo has a concrete role-structured debate proposal,
2. the distinction between current-family debate and future judge-mediated debate is explicit,
3. role prompts are concrete enough to implement,
4. provenance/artifact deltas are explicit,
5. open review questions for Opus are listed.

## Residual Reviewer Risks

1. lead primacy/recency:
   - slot `A` speaks first and last, so outcomes are path-dependent on the lead's initial proposal,
   - acceptable residual risk because this is constitutive of a lead-finalizer protocol.

2. transcript-order dependence across responders:
   - later responders see richer transcript context than earlier responders,
   - acceptable residual risk because sequential dependence is the interaction mechanism itself.

3. power for H4 × H2 interaction effects:
   - the primary matrix should foreground H4 main effects and treat deeper interaction analyses as secondary unless trial budgets support them.

## Idempotence and Recovery

1. This plan is docs-only and reversible.
2. If implementation reveals prompt-level ambiguity between `challenger` and `auditor` at `R = 1`, preserve the role set but document `P = 4, R = 1` as exploratory rather than primary.
3. If judge-mediated debate is later desired, implement it as a separate protocol family rather than rewriting `debate_v1` in place.

## Interfaces and Dependencies

Implementation will eventually touch:

1. [src/planning/planner.ts](../../src/planning/planner.ts)
2. [src/protocols/debate-v1/live-trial.ts](../../src/protocols/debate-v1/live-trial.ts)
3. [src/protocols/debate-v1/mock-trial.ts](../../src/protocols/debate-v1/mock-trial.ts)
4. [resources/prompts/protocols/debate_v1](../../resources/prompts/protocols/debate_v1)
5. debate-related schemas and generated types
6. [docs/DESIGN.md](../DESIGN.md)
7. [docs/RESEARCH-METHOD.md](../RESEARCH-METHOD.md)
8. [docs/product-specs/tui-wizard.md](../product-specs/tui-wizard.md)

## Handoffs and Ownership

If handed to an implementer, the next contributor should already have:

1. the fixed role taxonomy,
2. the role prompt templates,
3. the primary H4 matrix,
4. the prompt-composition ordering rule,
5. the provenance fields required for research-grade artifacts,
6. the UI exposure rule that `P` and `R` are configurable but role structure is fixed and reviewed read-only.

## Plan Change Notes

- 2026-03-22: initial first-pass protocol hardening plan drafted from current Arbiter debate semantics plus external debate literature.
- 2026-03-22: revised after Opus stress test to adopt `counter` / `auditor`, directive role prompts, the primary `D1..D4` matrix, mandatory `transcript_hash`, and explicit `P = 2..4` research-zone guidance.
