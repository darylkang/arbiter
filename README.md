# Arbiter

Arbiter is a research-grade CLI for studying **LLM response distributions** under repeated, controlled sampling.

It is designed for teams that need:

- deterministic trial planning,
- auditable artifact outputs,
- reproducible run verification,
- and clear provenance for requested vs. actual model behavior.

Arbiter focuses on **measurement quality** and **traceability**. It does not claim model correctness.

---

## What Arbiter does

Arbiter runs many trials against a fixed question and configuration, then records:

- trial-level outputs,
- parsed outcomes,
- embedding-based novelty signals,
- optional clustering state,
- and a complete run manifest for verification.

This supports analysis of how response behavior changes across model/persona/protocol sampling choices.

---

## Core principles

- **Schema-first**: output contracts are defined by JSON Schemas.
- **Deterministic planning**: trial plans are seeded and reproducible.
- **Audit-first artifacts**: runs emit machine-verifiable files, not just terminal logs.
- **Provenance-aware**: requested and actual model identifiers are both recorded.

---

## Requirements

- Node.js `>=24`
- macOS/Linux terminal (TTY for interactive mode)
- OpenRouter API key only for live runs (`OPENROUTER_API_KEY`)

---

## Install

### Option A: Install globally from npm

```bash
npm install -g @darylkang/arbiter
```

### Option B: Install from source (editable/local development)

```bash
git clone https://github.com/darylkang/arbiter.git
cd arbiter
npm install
npm run build
npm link
```

Verify installation:

```bash
arbiter --version
arbiter --help
```

---

## Quick start

### Interactive mode (TTY)

Launch the interactive transcript UI:

```bash
arbiter
```

### Headless mock run (recommended first run)

```bash
arbiter init "What tradeoffs appear in event-driven architecture decisions?"
arbiter validate
arbiter run
```

Then inspect outputs:

```bash
arbiter receipt runs/<run_id>
arbiter report runs/<run_id>
arbiter verify runs/<run_id>
```

### Live run (real model calls)

```bash
export OPENROUTER_API_KEY=<your_key>
arbiter validate --live
arbiter run --live
```

For non-interactive environments (CI, pipes), add `--yes`:

```bash
arbiter run --live --yes
```

---

## Command reference

Use `arbiter <command> --help` for full flags and examples.

| Command | Purpose |
|---|---|
| `arbiter` | Launch interactive transcript UI in TTY (or show help in headless mode) |
| `arbiter init [question]` | Create a config file from a template |
| `arbiter run [config]` | Execute a study (mock by default) |
| `arbiter validate [config]` | Validate config and policy; optional live connectivity check |
| `arbiter report <run_dir>` | Generate a readable summary report |
| `arbiter verify <run_dir>` | Verify run artifacts against schemas and invariants |
| `arbiter receipt <run_dir>` | Print a concise run receipt |
| `arbiter resolve [config]` | Emit resolved config and deterministic trial plan without executing |

---

## Default run behavior

- `arbiter run` defaults to **mock mode**.
- `arbiter run --live` enables real API calls.
- If API key is missing, mock mode still works.
- Live mode requires `OPENROUTER_API_KEY`.

---

## Templates and profiles

Arbiter ships curated templates in `templates/`:

- `default`
- `quickstart_independent`
- `heterogeneity_mix`
- `debate_v1`
- `free_quickstart`
- `full`

Example:

```bash
arbiter init --template debate_v1 "Should cities prioritize housing affordability over job growth?"
```

---

## Output artifacts

Each run writes to:

```text
runs/<run_id>/
```

Typical files include:

- `config.resolved.json`
- `manifest.json`
- `trial_plan.jsonl`
- `trials.jsonl`
- `parsed.jsonl`
- `convergence_trace.jsonl`
- `aggregates.json`
- `embeddings.provenance.json`
- `embeddings.arrow` (when embeddings are generated)
- `receipt.txt`
- `clusters/` (when clustering is enabled)
- `debug/` (when `--debug` is enabled)

---

## Interpreting results responsibly

Arbiter measures **distributional behavior**, not correctness.

Important guidance:

- Convergence indicates novelty saturation under the configured measurement setup.
- Embedding clusters are measurement artifacts, not ground-truth semantic classes.
- Free-tier models are useful for exploration but not ideal for publication-grade claims.
- Always report measurement settings and model provenance when sharing results.

---

## Guardrails and policy controls

For policy-sensitive runs:

- `--strict` enforces model policy constraints.
- `--permissive` keeps warn-only behavior.
- `--allow-free` and `--allow-aliased` allow specific exceptions in strict mode.
- `--contract-failure warn|exclude|fail` controls parse-failure handling.

Use `arbiter run --help` for full details.

---

## Reproducibility and provenance

Arbiter records:

- deterministic trial plan (seeded),
- requested and actual model identifiers,
- artifact hashes and counts in manifest,
- embedding generation metadata when available.

Use verification before trusting downstream analyses:

```bash
arbiter verify runs/<run_id>
```

---

## Troubleshooting

### `error: config not found ...`

Initialize a config first:

```bash
arbiter init "Your research question"
```

### Live run fails with missing API key

Set key in environment:

```bash
export OPENROUTER_API_KEY=<your_key>
```

### You need only planning, not execution

Use resolve-only:

```bash
arbiter resolve
```

---

## Documentation

- Specification: `docs/spec.md`
- Results interpretation: `docs/interpreting-results.md`
- Template guide: `templates/README.md`
- Contributor/agent rules: `AGENTS.md`

---

## License

MIT
