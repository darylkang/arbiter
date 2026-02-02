# Templates (Profiles)

Templates are curated **profiles** that run the same engine with different defaults. They are starting points, not claims of correctness.

Use them via:

```
arbiter init --template <name>
```

Or quickly:

```
arbiter quickstart --profile <profile>
```

---

## Which template should I use?

| Use case | Template | Notes |
|---|---|---|
| Fast onboarding / baseline | `quickstart_independent` | Single model, advisor‑only stopping |
| Multi‑model heterogeneity | `heterogeneity_mix` | Multi‑model + multi‑persona sampling |
| Structured critique | `debate_v1` | Proposer–critic–revision protocol |
| Free exploration | `free_quickstart` | **Exploration only**; not publishable |

---

## Profiles (CLI names)

These map to templates above:
- `quickstart`
- `heterogeneity`
- `debate`
- `free`

Example:

```
arbiter quickstart "What is the tradeoff between speed and safety?" --profile debate
```

---

## Warnings

- **Free‑tier models** are rate‑limited and may be substituted. Use for onboarding only.
- **Embedding groups** are measurement artifacts, not semantic categories.
- **Convergence‑aware stopping** indicates novelty saturation under the instrument, not correctness.
