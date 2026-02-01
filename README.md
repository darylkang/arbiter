# Arbiter

Arbiter is a research-grade TypeScript/Node CLI for studying **LLM behavior as a distribution** under repeated heterogeneous sampling. Each trial draws a configuration from an explicit distribution Q(c), produces an output, and applies a locked measurement procedure *M* (embedding + optional online clustering) to estimate a response landscape. **Convergence** means the empirical distribution stabilizes under a fixed instrument, not that answers are correct.

Arbiter is intentionally **audit-first**: schemas define all artifacts, prompts are embedded into resolved configs, and every run emits a reproducible artifact pack. Clusters are **measurement artifacts** contingent on the embedding model and online clustering rules.

## What Arbiter is not
- A benchmark suite or correctness scorer.
- An offline clustering/visualization tool (that lives in separate Python workflows).
- A UI-heavy product (wizard UI is planned but not in this repo yet).

## Quickstart (npm-first)

Install globally:

```
npm install -g @darylkang/arbiter
```

Create a config and validate it:

```
arbiter init "What are the tradeoffs of event sourcing?"
arbiter validate
```

Run a live experiment (requires OpenRouter API key):

```
export OPENROUTER_API_KEY=...your key...
arbiter run
```

Notes:
- `arbiter init` writes `arbiter.config.json` in the current directory.
- Templates: `default`, `debate`, `multi-model`, `full` (use `arbiter init --template <name>`).
- Results go to `runs/<run_id>/`.
- `arbiter` with no args shows help.

## Quickstart (repo dev)

```
npm install
npm run build
node dist/cli/index.js init "My question"
node dist/cli/index.js validate
node dist/cli/index.js run
```

## Configuration
- Start with `arbiter init` or use the shipped templates (`--template debate`, `--template multi-model`, `--template full`).
- Protocols:
  - `independent` (single-call)
  - `debate_v1` (3-turn proposer/critic/proposer-final)
- Clustering is optional and **advisory-only** by default.

See:
- `examples/config_reference.md` for an annotated explanation of config fields (repo).
- `docs/spec.md` for the repo-local technical contract (repo).

## Outputs (run artifact pack)
Each run creates `runs/<run_id>/` with the following artifacts:

```
runs/<run_id>/
  config.resolved.json         # self-contained config w/ embedded prompt text
  manifest.json                # provenance, counts, hashes, stop_reason
  trials.jsonl                 # trial records (calls, timing, model_actual may be null)
  parsed.jsonl                 # parsed outputs + embed_text
  embeddings.arrow             # Arrow IPC float32 vectors
  embeddings.provenance.json   # embeddings status + counts
  convergence_trace.jsonl      # batch metrics (clustering metrics if enabled)
  aggregates.json              # run-level aggregates
  clusters/                    # only when clustering enabled
    online.state.json
    online.assignments.jsonl
  debug/                        # only with --debug
    embeddings.jsonl           # append-only base64 float32le
```

Notes:
- `actual_model` is nullable when the OpenRouter `x-model` header is absent.
- `embeddings.arrow` is written only if embeddings are produced.

## Examples (repo-only)
Examples live in the repo (not required for npm installs):
- `examples/debate_v1.smoke.json` — minimal debate run (clustering off).
- `examples/debate_v1.smoke+clustering.json` — debate + clustering.
- `examples/arbiter.full.json` — full option surface.

See `examples/README.md` for commands and expected behavior.

## Development
- `AGENTS.md` contains mandatory rules for contributors/agents.
- `docs/spec.md` is the contract snapshot.
- Schemas in `schemas/` are the source of truth; generated types live in `src/generated/`.
