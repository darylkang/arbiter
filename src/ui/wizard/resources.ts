import { resolve } from "node:path";

import type { ArbiterModelCatalog } from "../../generated/catalog.types.js";
import type { ArbiterPromptManifest } from "../../generated/prompt-manifest.types.js";
import { readJsonFile } from "../../cli/commands.js";
import type { CatalogModel, PersonaOption } from "./types.js";

export const loadWizardVersion = (assetRoot: string): string => {
  const pkg = readJsonFile<{ version?: string }>(resolve(assetRoot, "package.json"));
  return pkg.version ?? "0.0.0";
};

export const loadCatalogModels = (assetRoot: string): CatalogModel[] => {
  const catalog = readJsonFile<ArbiterModelCatalog>(
    resolve(assetRoot, "resources/catalog/models.json")
  );
  return catalog.models.map((model) => ({
    slug: model.slug,
    display: model.display_name,
    provider: model.provider,
    tier: model.tier,
    isAliased: model.is_aliased === true
  }));
};

export const loadPersonaOptions = (assetRoot: string): PersonaOption[] => {
  const manifest = readJsonFile<ArbiterPromptManifest>(
    resolve(assetRoot, "resources/prompts/manifest.json")
  );
  return manifest.entries
    .filter((entry) => entry.type === "participant_persona")
    .map((entry) => ({ id: entry.id, description: entry.description ?? "" }));
};

export const loadWizardOptions = (assetRoot: string): {
  version: string;
  modelOptions: CatalogModel[];
  personaOptions: PersonaOption[];
} => ({
  version: loadWizardVersion(assetRoot),
  modelOptions: loadCatalogModels(assetRoot),
  personaOptions: loadPersonaOptions(assetRoot)
});
