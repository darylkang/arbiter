import { resolve } from "node:path";

import type { ArbiterModelCatalog } from "../../generated/catalog.types.js";
import type { ArbiterPersonaCatalog } from "../../generated/persona-catalog.types.js";
import type { ArbiterPromptManifest } from "../../generated/prompt-manifest.types.js";
import { readJsonFile } from "../../cli/commands.js";
import {
  formatAjvErrors,
  validateCatalog,
  validatePersonaCatalog,
  validatePromptManifest
} from "../../config/schema-validation.js";
import type { CatalogModel, PersonaOption } from "./types.js";

const titleCase = (value: string): string =>
  value
    .split(/[\s_-]+/)
    .filter((part) => part.length > 0)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");

const PROVIDER_LABELS: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google",
  deepseek: "DeepSeek",
  "x-ai": "xAI",
  meta: "Meta",
  "meta-llama": "Meta"
};

const toProviderLabel = (provider: string): string => PROVIDER_LABELS[provider] ?? titleCase(provider);

export const loadWizardVersion = (assetRoot: string): string => {
  const pkg = readJsonFile<{ version?: string }>(resolve(assetRoot, "package.json"));
  return pkg.version ?? "0.0.0";
};

export const loadCatalogModels = (assetRoot: string): CatalogModel[] => {
  const catalog = readJsonFile<ArbiterModelCatalog>(
    resolve(assetRoot, "resources/models/catalog.json")
  );
  if (!validateCatalog(catalog)) {
    const formatted = formatAjvErrors("model catalog", validateCatalog.errors);
    throw new Error(formatted.length > 0 ? formatted.join("\n") : "model catalog is invalid");
  }
  return [...catalog.models]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((model) => ({
      slug: model.slug,
      display: model.display_name,
      provider: model.provider,
      providerLabel: toProviderLabel(model.provider),
      tier: model.tier,
      tierLabel: model.tier,
      isAliased: model.is_aliased,
      summaryLine: model.summary_line,
      researchNote: model.research_note,
      riskNote: model.risk_note,
      isDefault: model.default,
      sortOrder: model.sort_order
    }));
};

const asSet = (values: string[]): Set<string> => new Set(values);

const assertUniqueIds = (values: string[], label: string): void => {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value);
    }
    seen.add(value);
  }
  if (duplicates.size > 0) {
    throw new Error(`${label} contains duplicate persona ids: ${Array.from(duplicates).join(", ")}`);
  }
};

const assertMatchingPersonaSets = (catalogIds: string[], manifestIds: string[]): void => {
  assertUniqueIds(catalogIds, "persona catalog");
  assertUniqueIds(manifestIds, "prompt manifest");
  const catalogSet = asSet(catalogIds);
  const manifestSet = asSet(manifestIds);
  const missingFromManifest = catalogIds.filter((id) => !manifestSet.has(id));
  const missingFromCatalog = manifestIds.filter((id) => !catalogSet.has(id));

  if (missingFromManifest.length > 0 || missingFromCatalog.length > 0) {
    const lines: string[] = ["persona catalog and prompt manifest are out of sync"];
    if (missingFromManifest.length > 0) {
      lines.push(`missing from manifest: ${missingFromManifest.join(", ")}`);
    }
    if (missingFromCatalog.length > 0) {
      lines.push(`missing from catalog: ${missingFromCatalog.join(", ")}`);
    }
    throw new Error(lines.join("\n"));
  }
};

export const loadPersonaOptions = (assetRoot: string): PersonaOption[] => {
  const manifest = readJsonFile<ArbiterPromptManifest>(
    resolve(assetRoot, "resources/prompts/manifest.json")
  );
  if (!validatePromptManifest(manifest)) {
    const formatted = formatAjvErrors("prompt manifest", validatePromptManifest.errors);
    throw new Error(formatted.length > 0 ? formatted.join("\n") : "prompt manifest is invalid");
  }

  const catalog = readJsonFile<ArbiterPersonaCatalog>(
    resolve(assetRoot, "resources/prompts/personas/catalog.json")
  );
  if (!validatePersonaCatalog(catalog)) {
    const formatted = formatAjvErrors("persona catalog", validatePersonaCatalog.errors);
    throw new Error(formatted.length > 0 ? formatted.join("\n") : "persona catalog is invalid");
  }

  const manifestPersonaIds = manifest.entries
    .filter((entry) => entry.type === "participant_persona")
    .map((entry) => entry.id);
  const catalogPersonaIds = catalog.personas.map((persona) => persona.id);
  assertMatchingPersonaSets(catalogPersonaIds, manifestPersonaIds);

  return [...catalog.personas]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((persona) => ({
      id: persona.id,
      displayName: persona.display_name,
      subtitle: persona.subtitle,
      category: persona.category,
      whenToUse: persona.when_to_use,
      riskNote: persona.risk_note,
      isDefault: persona.default
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
