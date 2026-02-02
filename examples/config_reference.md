# Configuration Reference (Examples)

This file explains the example configs and maps their fields to the canonical JSON Schemas in `schemas/`. Use it as an annotated guide while editing JSON (since JSON cannot include comments).

## Example configs
- `examples/debate_v1.smoke.json`: smallest working debate_v1 (proposer–critic–revision) config (clustering off).
- `examples/debate_v1.smoke+clustering.json`: debate_v1 with clustering enabled.
- `examples/arbiter.full.json`: fuller option surface (model mix + decode ranges + clustering).

All examples reference the current catalog/prompt IDs. IDs may change as curated content evolves.

## Top-level sections (and schemas)

### `_readme` (optional)
- Schema: `schemas/config.schema.json`
- Human hint for this config; ignored by the runtime.

### `schema_version`
- Schema: `schemas/config.schema.json`
- Must be `"1.0.0"` for v1.

### `run`
- Schema: `schemas/config.schema.json`
- `run_id` is set during resolution; use `"pending"` in input configs.
- `seed` drives deterministic planning and sampling.

### `question`
- Schema: `schemas/config.schema.json`
- `text` is the prompt under study. Optional `question_id` and `source` are for provenance.

### `sampling`
- Schema: `schemas/config.schema.json`
- `models`: weighted model slugs (must match catalog entries).
- `personas`: weighted persona prompt IDs (prompt bank).
- `protocols`: weighted protocol template IDs (prompt bank; used for independent protocol).
- `decode`: fixed values or ranges for temperature/top_p/max_tokens/etc.

### `protocol`
- Schema: `schemas/config.schema.json`
- `type`: `independent` or `debate_v1`.
- `timeouts`: per-call and per-trial limits (debate_v1 applies per-call retries).
- `decision_contract` (optional): structured JSON contract preset (from `contracts/manifest.json`).
  - Example: `{ "id": "binary_decision_v1" }`
  - Resolver embeds the full schema + sha256 into `config.resolved.json`.

### `execution`
- Schema: `schemas/config.schema.json`
- `k_max`: total trials.
- `batch_size`: batch boundary for monitoring/clustering.
- `workers`: concurrency limit.
- `retry_policy`: general backoff settings (protocol retries are separate).
- `stop_policy`: convergence‑aware thresholds (`novelty_epsilon`, `similarity_threshold`, `patience`).
- `stop_mode`: `advisor` (logs) vs `enforcer` (stops on thresholds).

### `measurement`
- Schema: `schemas/config.schema.json`
- `embedding_model`: OpenRouter embedding model slug.
- `embed_text_strategy`: how `embed_text` is derived from parsed output.
- `novelty_threshold`: non-structural metric threshold.
- `clustering`: optional online monitoring (leader clustering).

### `output`
- Schema: `schemas/config.schema.json`
- `runs_dir`: output root for `runs/<run_id>/`.

## Where to look for canonical definitions
- Config schema: `schemas/config.schema.json`
- Trial record schema: `schemas/trial.schema.json`
- Parsed output schema: `schemas/parsed-output.schema.json`
- Embedding record schema: `schemas/embedding.schema.json`
- Embeddings provenance schema: `schemas/embeddings-provenance.schema.json`
- Convergence trace schema: `schemas/convergence-trace.schema.json`
- Clustering artifacts: `schemas/cluster-state.schema.json`, `schemas/cluster-assignment.schema.json`
- Decision contracts: `schemas/decision-contract.schema.json` + `contracts/manifest.json`

## Reading embeddings.arrow in Python

```python
import pyarrow as pa
import pyarrow.ipc as ipc

with ipc.open_file("runs/<run_id>/embeddings.arrow") as reader:
    table = reader.read_all()

print(table.schema)
print(table.to_pandas().head())
```
