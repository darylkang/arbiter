# Arbiter

Arbiter is a research-grade TypeScript/Node CLI for studying **LLM behavior as a distribution** under repeated heterogeneous sampling. Each trial draws a configuration from an explicit distribution Q(c), produces an output, and applies a locked measurement procedure *M* (embedding + optional online clustering) to estimate a response landscape. **Distributional convergence** means the empirical distribution stabilizes under a fixed instrument, not that answers are correct.

Arbiter is intentionally **audit-first**: schemas define all artifacts, prompts and contracts are embedded into resolved configs, and every run emits a reproducible artifact pack.

"Arbiter discovers emergent response clusters—these are measurement artifacts contingent on the embedding model and clustering parameters, not ground-truth categories. Distributional convergence indicates that additional sampling is unlikely to reveal new response modes; it does not indicate correctness or consensus. Runs using free-tier models (`:free` suffix) are rate-limited and subject to model substitution; they are suitable for exploration and onboarding but should not be used for publishable research. Always report the full measurement procedure (M) and actual model identifiers when citing Arbiter results."

## What Arbiter is not
- A benchmark suite or correctness scorer.
- An offline clustering/visualization tool (that lives in separate Python workflows).
- A UI-heavy product (wizard UI is planned but not in this repo yet).

## Quickstart (npm-first, <60 seconds)

Install globally:

```
npm install -g @darylkang/arbiter
```

Create a config (template-based) and validate it:

```
arbiter init --template quickstart_independent "What are the tradeoffs of event sourcing?"
arbiter validate
```

Run a live experiment (requires OpenRouter API key):

```
export OPENROUTER_API_KEY=...your key...
arbiter run
```

Notes:
- `arbiter init` writes `arbiter.config.json` in the current directory.
- Results go to `runs/<run_id>/`.
- `arbiter` with no args shows help.

## Free experimentation
- **Mock mode** (no API key):
  - `arbiter mock-run --config arbiter.config.json --out runs --max-trials 5 --batch-size 1 --workers 1`
- **Free-tier model** (API key required, $0 but rate-limited):
  - `arbiter init --template free_quickstart`
  - Free models may be substituted; not for publishable research.

## Profiles (templates)
Templates are curated **profiles** that run the same engine with different defaults. Mock‑run is a true execution mode (no API calls), not a toy; it produces the full artifact pack for testing pipelines.

## Configuration
- Start from templates (`arbiter init --template <name>`):
  - `quickstart_independent` (default baseline)
  - `heterogeneity_mix` (multi-model, multi-persona)
  - `debate_v1` (debate protocol: proposer–critic–revision)
  - `free_quickstart` (free model, onboarding only)
  - `full` (full surface with clustering)
- Protocols:
  - `independent` (single-call)
  - `debate_v1` (3-turn proposer/critic/proposer-final)
- **Convergence-aware stopping** is advisor-only by default; you can switch to enforced in config.
- **Decision contracts** (optional) enforce structured JSON outputs and define what gets embedded.

See:
- `examples/config_reference.md` for an annotated explanation of config fields (repo).
- `docs/spec.md` for the repo-local technical contract (repo).

## Decision contracts (optional)
Decision contracts define a strict JSON shape for outputs and a canonical embedding target. The built-in preset `binary_decision_v1` expects:
- `decision`: "yes" | "no"
- `rationale`: string (required, maxLength 500)
- `confidence`: number in [0,1] (optional)

By default, `binary_decision_v1` embeds the **rationale**. If the rationale exceeds 500 chars, it is truncated deterministically and `rationale_truncated=true` is recorded in `parsed.jsonl`.

## Outputs (run artifact pack)
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

Notes:
- `actual_model` is taken from the **OpenRouter response body** `model` field (nullable if missing).
- Embeddings provenance stores `generation_id` for optional later audit (e.g., `/api/v1/generation?id=<id>`).

## Model reproducibility
- Prefer pinned slugs (e.g., `openai/gpt-4o-mini-2024-07-18`, `google/gemini-2.0-flash-001`).
- Anthropic slugs on OpenRouter are aliases and may drift; always log `actual_model` from the response body.
- Free-tier models (`:free`) are rate-limited and may substitute.

## Repository development

```
npm install
npm run build
node dist/cli/index.js init "My question"
node dist/cli/index.js validate
node dist/cli/index.js run
```

## Development / contribution pointers
- `AGENTS.md` contains mandatory rules for contributors/agents.
- `docs/spec.md` is the contract snapshot.
- Schemas in `schemas/` are the source of truth; generated types live in `src/generated/`.
