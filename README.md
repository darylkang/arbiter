# Arbiter

Arbiter is a research‑grade CLI for studying **LLM behavior as a distribution** under repeated heterogeneous sampling. Each trial draws a configuration from an explicit distribution Q(c), produces an output, and applies a fixed measurement procedure *M* (embedding + optional online clustering) to estimate a response landscape. **Distributional convergence** means the *observed distribution* stabilizes under a fixed instrument—it is not a claim of correctness.

Arbiter is intentionally **audit‑first**: JSON Schemas define artifacts, resolved configs embed the exact prompts/contracts used, and every run emits a reproducible artifact pack.

## Critical assumptions (must read)

- **Embedding groups are measurement artifacts**
  - “Groups” (clusters) reflect similarity in the embedding space, not semantic truth. Different embedding models or parameters yield different groupings.
- **Stopping does not imply correctness**
  - Convergence‑aware stopping indicates **novelty saturation** under the current measurement procedure. It does **not** mean answers are correct or consensus exists.
- **Free‑tier models are exploration‑only**
  - Models with `:free` suffix are rate‑limited and may be substituted. They are suitable for onboarding and prototyping, not publishable research.
- **Provenance is recorded, not guaranteed**
  - You may request one model and receive another. Arbiter records **requested vs actual** identifiers, but cannot guarantee provider behavior.

> Arbiter discovers emergent response clusters—these are measurement artifacts contingent on the embedding model and clustering parameters, not ground‑truth categories. Distributional convergence indicates that additional sampling is unlikely to reveal new response modes; it does not indicate correctness or consensus. Runs using free‑tier models (`:free` suffix) are rate‑limited and subject to model substitution; they are suitable for exploration and onboarding but should not be used for publishable research. Always report the full measurement procedure (M) and actual model identifiers when citing Arbiter results.

---

## Table of contents
- [What Arbiter is (and is not)](#what-arbiter-is-and-is-not)
- [Quickstart (<60 seconds)](#quickstart-60-seconds)
- [Understanding your results](#understanding-your-results)
- [Premium CLI wizard](#premium-cli-wizard)
- [Profiles / templates](#profiles--templates)
- [Protocols](#protocols)
- [Decision contracts](#decision-contracts)
- [Outputs (artifact pack)](#outputs-artifact-pack)
- [Guardrails / policy](#guardrails--policy)
- [Model reproducibility & provenance](#model-reproducibility--provenance)
- [Contributing / further docs](#contributing--further-docs)

---

## What Arbiter is (and is not)

**Arbiter is:**
- A deterministic, schema‑driven sampling harness for studying response distributions.
- An audit‑grade artifact generator for reproducible experiments.
- A CLI that supports mock runs, live OpenRouter runs, and report/verify tooling.

**Arbiter is not:**
- A benchmark or correctness scorer.
- An offline clustering/visualization tool (that lives in separate Python workflows).
- A UI‑heavy product that hides the audit trail (the wizard is optional; artifacts remain the source of truth).

---

## Quickstart (<60 seconds)

### Premium wizard (TTY)

```
arbiter
```

### Headless quickstart

```
# Create a config and run a mock experiment (default)
arbiter quickstart "What are the tradeoffs of event sourcing?"
```

### Live run (OpenRouter key required)

```
export OPENROUTER_API_KEY=...your key...
arbiter validate --live
arbiter run
```

Notes:
- `arbiter quickstart` writes `arbiter.config.json` and runs a mock trial by default.
- Results go to `runs/<run_id>/`.
- `arbiter --headless` prints help and keeps everything headless.

---

## Understanding your results

Start here after any run:
- `receipt.txt` (summary)
- `arbiter report runs/<run_id>` (human‑readable overview)
- `arbiter verify runs/<run_id>` (schema + invariant checks)

Full guide: **[docs/interpreting-results.md](docs/interpreting-results.md)**

---

## Premium CLI wizard

The wizard is a guided flow for questions → profiles → review → run → receipt. It **does not** change execution semantics: the engine and artifacts remain the source of truth. Use `--headless` if you want pure CLI scripting.

---

## Profiles / templates

Profiles are curated **templates** that run the same engine with different defaults.

- Quickstart: `quickstart_independent`
- Heterogeneity mix: `heterogeneity_mix`
- Proposer–critic–revision: `debate_v1`
- Free tier: `free_quickstart` (exploration only)

Guide: **[templates/README.md](templates/README.md)**

---

## Protocols

- `independent` — single call per trial.
- `debate_v1` — **proposer–critic–revision** (3 calls per trial). The contract clause, when configured, is appended only to the final proposer system prompt.

---

## Decision contracts

Decision contracts define a strict JSON shape for outputs and a canonical embedding target. The built‑in preset `binary_decision_v1` expects:
- `decision`: "yes" | "no"
- `rationale`: string (required, maxLength 500)
- `confidence`: number in [0,1] (optional)

By default, `binary_decision_v1` embeds the **rationale**. If the rationale exceeds 500 chars, it is truncated deterministically and `rationale_truncated=true` is recorded in `parsed.jsonl`.

---

## Outputs (artifact pack)

Each run creates `runs/<run_id>/` with the following artifacts:

```
runs/<run_id>/
  config.resolved.json         # self-contained config w/ embedded prompt + contract text
  manifest.json                # provenance, counts, hashes, stop_reason
  trial_plan.jsonl             # deterministic plan (trial_id ordered)
  trials.jsonl                 # trial records (calls, timing, actual_model nullable)
  parsed.jsonl                 # parsed outputs + embed_text
  embeddings.arrow             # Arrow IPC float32 vectors (if produced)
  embeddings.provenance.json   # embeddings status + counts + generation_id(s)
  convergence_trace.jsonl      # batch metrics (clustering metrics if enabled)
  aggregates.json              # run-level aggregates
  receipt.txt                  # plain-text run receipt
  clusters/                    # only when clustering enabled
    online.state.json
    online.assignments.jsonl
  debug/                        # only with --debug
    embeddings.jsonl           # append-only base64 float32le
```

---

## Guardrails / policy

- `--strict` enforces reproducibility guardrails (free/aliased models require explicit allow flags).
- `--permissive` keeps warn‑only behavior.
- Policy snapshot is recorded in `manifest.json`.

---

## Model reproducibility & provenance

- `actual_model` is taken from the **OpenRouter response body** `model` field (nullable if missing).
- Embeddings provenance stores `generation_id` for optional later audit (e.g., `/api/v1/generation?id=<id>`).
- Token usage is recorded when OpenRouter returns `usage` (prompt/completion/total).

---

## Contributing / further docs

- **Contract snapshot:** `docs/spec.md`
- **Results guide:** `docs/interpreting-results.md`
- **Template guide:** `templates/README.md`
- **Agent/contributor rules:** `AGENTS.md`
- **Config reference (examples):** `examples/config_reference.md`

---

## Repository development

```
npm install
npm run build
node dist/cli/index.js init "My question"
node dist/cli/index.js validate
node dist/cli/index.js run
```
