# Arbiter Examples

These configs reference the current catalog + prompt bank IDs. IDs may change as curated content evolves.

## Files
- `examples/debate_v1.smoke.json`: minimal debate_v1 smoke config (clustering disabled).
- `examples/debate_v1.smoke+clustering.json`: same as above with clustering enabled.
- `examples/arbiter.full.json`: broader option surface (model mix + decode ranges + clustering).
- `examples/config_reference.md`: annotated guide to config fields.

## How to run

Build once:

```
npm run build
```

Mock run (no API key required):

```
node dist/cli/index.js mock-run --config examples/debate_v1.smoke.json --out runs --max-trials 3 --batch-size 1 --workers 1 --debug
```

Live debate v1 smoke (3 trials, sequential):

```
node dist/cli/index.js run --config examples/debate_v1.smoke.json --out runs --max-trials 3 --batch-size 1 --workers 1 --debug
```

Live debate v1 with clustering:

```
node dist/cli/index.js run --config examples/debate_v1.smoke+clustering.json --out runs --max-trials 6 --batch-size 2 --workers 3 --debug
```

Full option surface (independent + clustering):

```
node dist/cli/index.js run --config examples/arbiter.full.json --out runs --max-trials 12 --batch-size 3 --workers 3 --debug
```

## Environment
Set `OPENROUTER_API_KEY` in your shell before running live tests:

```
export OPENROUTER_API_KEY=...your key...
```

## Key fields and artifact mapping (high level)
- `sampling` controls model/persona mix and decode params; the resolved trial plan is written to `trial_plan.jsonl` and trial assignments are recorded in `trials.jsonl`.
- `protocol` controls debate_v1 call structure and timeouts; prompt text and (optional) contracts are embedded into `config.resolved.json`.
- `measurement` controls embedding model and clustering; `parsed.jsonl`, `embeddings.arrow`, and `convergence_trace.jsonl` reflect these settings.

## Reading embeddings.arrow in Python

```python
import pyarrow as pa
import pyarrow.ipc as ipc

with ipc.open_file("runs/<run_id>/embeddings.arrow") as reader:
    table = reader.read_all()

print(table.schema)
print(table.to_pandas().head())
```
