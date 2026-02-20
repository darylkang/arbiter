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

- trial-level execution outputs with parse and embedding summaries,
- batch-level novelty monitoring signals,
- optional embedding-group outputs,
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

### Wizard entry (TTY)

Launch the wizard:

```bash
arbiter
```

### Initialize a config

```bash
arbiter init
```

This writes `arbiter.config.json` in CWD, or the first collision-safe filename:

- `arbiter.config.1.json`
- `arbiter.config.2.json`
- and so on

### Headless run (default)

```bash
arbiter run --config arbiter.config.json
```

### Live run override

```bash
export OPENROUTER_API_KEY=<your_key>
arbiter run --config arbiter.config.json --mode live
```

### Dashboard monitor (human-only)

```bash
arbiter run --config arbiter.config.json --dashboard
```

If stdout is not TTY, Arbiter prints a warning to stderr and continues headless.

---

## CLI Contract (v1)

Arbiter exposes exactly three primary entry points:

1. `arbiter`
2. `arbiter init`
3. `arbiter run`

Global flags:

- `--help`, `-h`
- `--version`, `-V`

Command behavior:

- `arbiter`: launch wizard when stdout is TTY; otherwise print help and exit `0`.
- `arbiter init`: write a collision-safe default config in CWD and never overwrite existing files.
- `arbiter run`: headless execution command, requires `--config <path>`.

Run override flags (`arbiter run`):

- `--out <dir>` (default: `./runs`)
- `--workers <n>`
- `--batch-size <n>`
- `--max-trials <n>`
- `--mode <mock|live>`
- `--dashboard` (TTY-only Stage 2/3 monitor)

Not part of v1:

- no `--headless`
- no `--verbose`
- no wizard flag (`--wizard`)
- no experiment-variable CLI flags (models, personas, protocol, decode, debate params, clustering thresholds)
- no redundant aliases beyond `-h` and `-V`

---

## Config Resolution Contract

Resolution precedence:

1. built-in defaults
2. config file
3. CLI override flags

Per run directory, Arbiter writes:

- `config.source.json` (exact input config as read)
- `config.resolved.json` (final resolved config used to execute)

The source config file is never mutated during run execution.

---

## Run Directory Contract

Each run writes to:

```text
runs/<run_id>/
```

Always-produced files:

- `config.source.json`
- `config.resolved.json`
- `manifest.json`
- `trial_plan.jsonl`
- `trials.jsonl`
- `monitoring.jsonl`
- `receipt.txt`

Conditionally produced files:

- `embeddings.arrow` when at least one eligible embedding is finalized to Arrow
- `embeddings.jsonl` as fallback when Arrow is not written, or when debug mode explicitly keeps JSONL embeddings
- `groups/assignments.jsonl` and `groups/state.json` when grouping artifacts are emitted
- `debug/events.jsonl` and `debug/execution.log` only when debug mode is enabled

Consolidation notes:

- `trials.jsonl` is the canonical per-trial record and includes parse plus embedding summaries.
- final run-level metrics and embedding provenance summaries live in `manifest.json`.
- this contract supersedes legacy artifact names such as `parsed.jsonl`, `convergence_trace.jsonl`, `aggregates.json`, `embeddings.provenance.json`, and `clusters/*`.

---

## Exit Code Contract

Exit `0` for:

- normal completion,
- novelty saturation stop,
- max-trials stop,
- graceful `Ctrl+C` stop.

Use non-zero only for:

- invalid config,
- inability to start run,
- fatal execution failure.

---

## Interpreting results responsibly

Arbiter measures **distributional behavior**, not correctness.

Important guidance:

- Stopping indicates novelty saturation under the configured measurement setup.
- Embedding groups are measurement artifacts, not ground-truth semantic classes.
- Free-tier models are useful for exploration but not ideal for publication-grade claims.
- Always report measurement settings and model provenance when sharing results.

---

## Troubleshooting

### `error: config not found ...`

Initialize a config first:

```bash
arbiter init
```

### Live run fails with missing API key

Set key in environment:

```bash
export OPENROUTER_API_KEY=<your_key>
```

### `--dashboard` used in non-TTY

Arbiter warns to stderr and continues headless by contract.

---

## Documentation

- Design reference: `docs/DESIGN.md`
- Wizard UX spec: `docs/product-specs/tui-wizard.md`
- ExecPlan contract: `docs/PLANS.md`
- Contributor/agent rules: `AGENTS.md`

---

## License

MIT
