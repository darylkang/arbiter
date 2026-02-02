# Interpreting Results (Arbiter)

This guide helps you go from “run finished” to **what to look at** and **what you can claim**. It’s written for both technical and non‑technical readers.

> **Reminder:** Embedding groups are measurement artifacts. Distributional stability is not correctness. Always report the measurement procedure and actual model identifiers.

---

## Start here (fast path)

1) **Receipt**
   - `runs/<run_id>/receipt.txt`
   - One‑page summary: stop reason, counts, last‑batch metrics.

2) **Report**
   - `arbiter report runs/<run_id>`
   - Human‑readable overview and quick stats.

3) **Verify**
   - `arbiter verify runs/<run_id>`
   - Validates schemas and cross‑file invariants.

---

## Reading order (artifact map)

Use this order to understand a run without getting lost:

1) **receipt.txt** — quick summary and pointers.
2) **manifest.json** — provenance + counts + policy snapshot.
3) **convergence_trace.jsonl** — batch‑level metrics over time.
4) **aggregates.json** — final summary metrics (derived from last convergence record).
5) **trials.jsonl** — full trial records (requests, responses, retries).
6) **parsed.jsonl** — canonical outputs + embed_text.
7) **embeddings.arrow** — vector data for analysis.
8) **embeddings.provenance.json** — embedding status + generation IDs.
9) **clusters/** (if enabled) — online clustering state + assignments.

---

## Key metrics (what they mean)

### novelty_rate
- Fraction of batch embeddings whose **max similarity to prior** is below the novelty threshold.
- Interprets “newness” under the embedding model.

### mean_max_sim_to_prior
- Average of each trial’s max similarity to previous eligible embeddings.
- Higher values indicate **stability** (less novelty) in the embedding space.

### Eligibility
- Only trials with `embedding_status = success` count toward novelty/stability metrics.
- Failures or skipped embeddings do **not** contribute.

### Stop reason
- `k_max_reached` — budget exhausted.
- `converged` — convergence‑aware stopping thresholds met.
- `user_interrupt` — user stopped the run.
- `error` — run failed (see manifest + trials for details).

---

## Safe claims vs unsafe claims

**Safe to claim** (with measurement procedure reported):
- “Under this embedding model + parameters, additional sampling produced few new embedding‑space responses.”
- “The observed response distribution stabilized under this instrument.”

**Unsafe to claim**:
- “The model’s answers are correct.”
- “The model has a single true response category.”
- “These clusters are semantic truth.”

---

## Common questions (FAQ)

### “Why did it stop?”
Check `manifest.json` (`stop_reason`) and the last records in `convergence_trace.jsonl`. If `converged`, you’ll see `novelty_rate` and `mean_max_sim_to_prior` crossing thresholds for `patience` batches.

### “What do embedding groups mean?”
They are **similarity groups** in the embedding space. They are not semantic categories. If you change the embedding model, the groupings will change.

### “Why were some trials excluded?”
Only trials with successful embeddings are “eligible.” Look at `embeddings.provenance.json` and `debug/embeddings.jsonl` (if present) for skip/failure reasons.

### “Why does requested vs actual model differ?”
Providers may alias or substitute models. Arbiter logs **requested** and **actual** identifiers in `trials.jsonl` (and `embeddings.provenance.json`). Always cite actual identifiers in results.

### “Why do I see fallback parsing?”
A contract parse failure yields `parse_status=fallback`. The run is still usable; Arbiter embeds the raw output deterministically.

---

## Minimal Python snippet (Arrow embeddings)

```python
import pyarrow as pa
import pyarrow.ipc as ipc

with ipc.open_file("runs/<run_id>/embeddings.arrow") as reader:
    table = reader.read_all()

print(table.schema)
print(table.to_pandas().head())
```

---

## What to report in a paper

At minimum:
- Prompt/question
- Sampling distribution Q(c)
- Measurement procedure M (embedding model + parameters, clustering parameters)
- Actual model identifiers (not just requested slugs)
- Stop policy thresholds and mode

---

## Troubleshooting quick tips

- **No embeddings.arrow**: embeddings may not have been produced. Check `embeddings.provenance.json`.
- **Zero eligible batches**: novelty_rate/mean_max_sim will be `null`. This is expected; it indicates no eligible embeddings.
- **Free‑tier models**: use for onboarding only; avoid for publishable research.
