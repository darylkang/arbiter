# Resources

This directory holds Arbiter's versioned runtime assets.

It is not a second schema layer.

- `/Users/darylkang/Developer/arbiter/schemas/` defines allowed contract shapes.
- `/Users/darylkang/Developer/arbiter/resources/` provides the concrete assets those contracts resolve against.

Use this directory for:

1. curated model-catalog entries,
2. decision-contract presets and their manifests,
3. prompt-bank assets and protocol prompt files,
4. starter config profiles used for initialization, tests, and manual onboarding.

## Subdirectories

### `catalog/`

Model metadata used by:

1. config resolution,
2. policy checks,
3. wizard display metadata.

Current authority:

- `/Users/darylkang/Developer/arbiter/resources/catalog/models.json`

### `contracts/`

Decision-contract presets and their hash manifest.

Current authority:

1. `/Users/darylkang/Developer/arbiter/resources/contracts/manifest.json`
2. files referenced by that manifest

These assets are runtime inputs, not examples.

### `prompts/`

Persona prompts, protocol prompts, and prompt-bank manifest data.

Current authority:

1. `/Users/darylkang/Developer/arbiter/resources/prompts/manifest.json`
2. files referenced by that manifest

The manifest is the durable inventory. Individual prompt files are content assets.

### `templates/`

Curated starter configs.

These are concrete config profiles, not schemas.

Current stable template surface:

1. `default.config.json`
   - the baseline profile used by `arbiter init`
2. `debate_v1.config.json`
   - debate-specific starter profile
3. `heterogeneity_mix.config.json`
   - multi-model and multi-persona distributional profile
4. `free_quickstart.config.json`
   - exploration-only free-tier profile

Important boundary:

1. `arbiter init` currently always writes the `default` template
2. the public CLI does not currently support `arbiter init --template ...`
3. additional template selection is therefore a repo asset/workflow concern, not a stabilized CLI contract

## Asset Discipline

1. manifests are the authoritative inventory for prompt and contract assets
2. runtime code should resolve assets by manifest or stable file path, not by prose docs
3. if an asset is no longer part of the supported runtime or test surface, remove it rather than leaving stale examples behind
4. if an asset changes semantics, update the manifest hash and the dependent tests in the same round

## What Does Not Belong Here

Do not use this directory for:

1. long-form design rationale,
2. paper-methodology guidance,
3. duplicated schema explanations,
4. stale example files that are not part of the supported surface

Keep those in `/Users/darylkang/Developer/arbiter/docs/`, `README.md`, or `schemas/` as appropriate.
