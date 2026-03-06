import { resolve } from "node:path";

import type { ArbiterModelCatalog } from "../../generated/catalog.types.js";
import type { ArbiterPromptManifest } from "../../generated/prompt-manifest.types.js";
import { readJsonFile } from "../../cli/commands.js";
import type { CatalogModel, PersonaOption } from "./types.js";

const titleCase = (value: string): string =>
  value
    .split(/[\s_-]+/)
    .filter((part) => part.length > 0)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");

const toPersonaDisplay = (id: string): string => titleCase(id.replace(/^persona_/, ""));

const toModelBadges = (input: { provider: string; tier: string; isAliased: boolean }): string[] => {
  const badges = [titleCase(input.provider), input.tier === "free" ? "free" : "paid"];
  if (input.isAliased) {
    badges.push("alias");
  }
  return badges;
};

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
    isAliased: model.is_aliased === true,
    badges: toModelBadges({
      provider: model.provider,
      tier: model.tier,
      isAliased: model.is_aliased === true
    })
  }));
};

export const loadPersonaOptions = (assetRoot: string): PersonaOption[] => {
  const manifest = readJsonFile<ArbiterPromptManifest>(
    resolve(assetRoot, "resources/prompts/manifest.json")
  );
  return manifest.entries
    .filter((entry) => entry.type === "participant_persona")
    .map((entry) => ({
      id: entry.id,
      display: toPersonaDisplay(entry.id),
      description: entry.description ?? ""
    }));
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
