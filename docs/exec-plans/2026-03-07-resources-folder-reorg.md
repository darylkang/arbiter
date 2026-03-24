# Purpose / Big Picture

Reorganize `/Users/darylkang/Developer/arbiter/resources/` into a stricter asset layout that separates public, research, and canary templates; makes decision-contract assets more precisely named; and reduces path-level ambiguity in runtime code and docs.

The goal is not cosmetic renaming. The goal is to make the asset layer legible and stable:

1. product-facing defaults should be clearly separated from research presets and canary-only profiles,
2. runtime decision-contract assets should not live under a generic folder name that suggests broader contract scope than they actually have,
3. loaders, docs, and tests should resolve assets through explicit inventories rather than flat filename assumptions.

# Scope Guardrails

In scope:

1. reorganize the `resources/` asset tree,
2. introduce a template manifest and use it for template resolution,
3. rename `resources/contracts/` to a more precise decision-contract asset folder,
4. rename the model-catalog folder to a clearer model asset path,
5. update runtime loaders, docs, and tests to the new asset layout,
6. preserve existing template IDs and decision-contract IDs unless there is a strong reason not to.

Out of scope:

1. changing the semantic content of prompts, contracts, or templates beyond path and metadata updates,
2. changing the paper's methodological contract,
3. generating manifests automatically,
4. changing schema semantics unrelated to the new template manifest,
5. expanding the public CLI surface to support template selection.

Sequencing constraints:

1. add any new schema and generated types before runtime code depends on them,
2. move assets and update loaders before rewriting docs that describe the new layout,
3. validate non-live paths before touching canary-specific behavior.

# Progress

- [x] 2026-03-07T00:00:00Z reoriented on `AGENTS.md`, `docs/DESIGN.md`, `docs/RESEARCH-METHOD.md`, `README.md`, `docs/PLANS.md`, and current `resources/` usage.
- [x] add the new template-manifest contract and generated types
- [x] migrate resource folder paths and runtime loaders
- [x] update docs and tests for the new asset layout
- [x] run scope-gate validation and close the migration

# Context and Orientation

Relevant files reviewed first:

1. `/Users/darylkang/Developer/arbiter/AGENTS.md`
   - defines schema-first workflow, validation policy, and change mapping for resource/contract work.
2. `/Users/darylkang/Developer/arbiter/docs/DESIGN.md`
   - confirms `resources/` is the runtime asset layer and that contract/prompt provenance is durable.
3. `/Users/darylkang/Developer/arbiter/docs/RESEARCH-METHOD.md`
   - confirms this migration must preserve research-significant `Q(c)` and `M` inputs without changing semantics.
4. `/Users/darylkang/Developer/arbiter/README.md`
   - captures current public CLI and asset expectations.
5. `/Users/darylkang/Developer/arbiter/resources/README.md`
   - current asset-layer description that will need updating.
6. `/Users/darylkang/Developer/arbiter/src/config/resolve-config.ts`
   - central runtime resolver for catalog, prompt manifest, contract manifest, and debate protocol asset.
7. `/Users/darylkang/Developer/arbiter/src/ui/wizard/resources.ts`
   - wizard reads dynamic model and persona options from `resources/models/catalog.json` and `resources/prompts/manifest.json`.
8. `/Users/darylkang/Developer/arbiter/src/cli/commands.ts`
   - current template loading is being migrated from a flat `resources/templates/<name>.config.json` layout to a manifest-backed inventory.

Non-obvious terms:

1. public template: part of the stabilized product/operator surface.
2. research template: curated experiment preset for manual or test use, not part of the public CLI contract.
3. canary template: narrow operational preset used for guarded live smoke behavior.

Entry points and high-risk components:

1. `/Users/darylkang/Developer/arbiter/src/config/resolve-config.ts`
2. `/Users/darylkang/Developer/arbiter/src/cli/commands.ts`
3. `/Users/darylkang/Developer/arbiter/src/ui/wizard/resources.ts`
4. `/Users/darylkang/Developer/arbiter/scripts/live-smoke.mjs`
5. `/Users/darylkang/Developer/arbiter/test/integration/templates.test.mjs`
6. `/Users/darylkang/Developer/arbiter/test/helpers/scenarios.mjs`

# Milestones and Gates

Ordering principle: dependency order. Add contract support first, then migrate runtime usage, then sync docs/tests.

## M1: Asset-inventory contract

Outcome:

- `resources/templates/manifest.json` exists with schema validation and generated types.

Entry condition:

- current template IDs and roles are known.

Exit evidence:

- template manifest schema added,
- generated types regenerated,
- schema checks pass.

Rollback boundary:

- old asset paths still intact until M2.

## M2: Runtime asset migration

Outcome:

- resources moved to the new layout and runtime code resolves them correctly.

Entry condition:

- M1 complete.

Exit evidence:

- runtime/template loaders updated,
- relevant tests and live-smoke path resolve new assets successfully.

Rollback boundary:

- path migration complete but docs may still lag.

## M3: Docs and validation closure

Outcome:

- docs, tests, and inventory references align with the new resource layout.

Entry condition:

- M2 complete.

Exit evidence:

- docs updated,
- scope-gate validation passes,
- worktree is coherent and commit-ready.

# Concrete Steps

1. Add `schemas/template-manifest.schema.json` and register it.
2. Generate `src/generated/template-manifest.types.ts` and validator wiring.
3. Add `resources/templates/manifest.json` with role metadata and canonical paths.
4. Reorganize assets to this target structure:
   - `resources/models/catalog.json`
   - `resources/decision-contracts/manifest.json`
   - `resources/decision-contracts/binary_decision_v1.json`
   - `resources/templates/public/default.config.json`
   - `resources/templates/research/debate.config.json`
   - `resources/templates/research/heterogeneity_mix.config.json`
   - `resources/templates/canary/free_quickstart.config.json`
5. Update runtime path resolution in:
   - `/Users/darylkang/Developer/arbiter/src/config/resolve-config.ts`
   - `/Users/darylkang/Developer/arbiter/src/cli/commands.ts`
   - `/Users/darylkang/Developer/arbiter/src/ui/wizard/resources.ts`
   - `/Users/darylkang/Developer/arbiter/scripts/live-smoke.mjs`
   - `/Users/darylkang/Developer/arbiter/test/helpers/scenarios.mjs`
6. Update docs and tests that mention old paths or old folder meanings.
7. Run schema, type, integration, CLI, contract, and canary-safe validation.

# Validation and Acceptance

Acceptance criteria:

1. resource-path reorg does not change resolved runtime semantics for existing template IDs,
2. wizard still loads model and persona options dynamically from resource assets,
3. `arbiter init` still writes the default template correctly,
4. decision-contract resolution still loads `binary_decision_v1` through its manifest,
5. docs describe the new asset layout accurately.

Validation commands:

1. `npm run gen:types`
2. `npm run check:types`
3. `npm run check:schemas`
4. `npm run test:contracts`
5. `npm run test:integration`
6. `npm run test:cli`
7. `npm run test:canary`

Expected evidence:

1. all commands exit `0`,
2. template integration tests pass against the manifest-backed layout,
3. contract-policy tests continue to resolve `binary_decision_v1`,
4. canary path remains skip-safe and resolves the canary template from its new location.

# Idempotence and Recovery

1. rerunning the migration should not create duplicate assets or conflicting template IDs,
2. if validation fails after asset moves, revert the path migration commit and restore old paths before attempting partial fixes,
3. keep template IDs and decision-contract IDs stable so existing config references remain valid.

# Interfaces and Dependencies

1. `schemas/template-manifest.schema.json` -> `src/config/schema-registry.ts` -> generated types and validators
2. `resources/templates/manifest.json` -> `src/cli/commands.ts` and test helpers
3. `resources/models/catalog.json` -> `src/config/resolve-config.ts` and `src/ui/wizard/resources.ts`
4. `resources/decision-contracts/manifest.json` -> `src/config/resolve-config.ts`

# Artifacts and Notes

Target layout is intentionally evolutionary:

1. keep prompts under `resources/prompts/` because that area already has a manifest-backed structure,
2. introduce path precision where folder names were overly broad or role-mixed,
3. do not over-build automatic manifest generation in the same round.

# Outcomes & Retrospective

Completed outcomes:

1. `resources/catalog/` was replaced by the clearer `resources/models/` path with no change to catalog semantics.
2. `resources/contracts/` was replaced by the more precise `resources/decision-contracts/` path while preserving stable contract IDs.
3. templates are now role-classified under `public/`, `research/`, and `canary/`.
4. `resources/templates/manifest.json` now acts as the authoritative inventory for template IDs, paths, hashes, and the single `init_default` entry.
5. runtime code no longer assumes a flat template filename layout.

Residual note:

1. prompt manifests and decision-contract manifests remain hand-maintained rather than generated; that was intentionally left out of scope for this round.

# Plan Change Notes

1. 2026-03-07: kept `resources/prompts/` structurally intact and deferred manifest generation to a later round because the highest-leverage improvement was folder-role clarity and manifest-backed template resolution, not a broader asset-generation system.
