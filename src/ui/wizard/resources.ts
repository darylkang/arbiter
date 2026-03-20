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
  qwen: "Qwen",
  mistralai: "Mistral",
  minimax: "MiniMax",
  moonshotai: "MoonshotAI",
  meta: "Meta",
  "meta-llama": "Meta"
};

const toProviderLabel = (provider: string): string => PROVIDER_LABELS[provider] ?? titleCase(provider);

const toTierLabel = (tier: "budget" | "mid" | "flagship" | "free"): string =>
  tier.charAt(0).toUpperCase() + tier.slice(1);

const formatPricePerMillion = (raw: string): string => {
  const amount = Number(raw) * 1_000_000;
  if (!Number.isFinite(amount) || amount <= 0) {
    return "$0";
  }
  const precision = amount >= 1 ? 2 : 3;
  return `$${amount.toFixed(precision).replace(/\.?0+$/, "")}`;
};

const formatContextWindow = (value: number | null): string | null => {
  if (!Number.isFinite(value ?? NaN) || value === null || value <= 0) {
    return null;
  }
  if (value >= 1_000_000) {
    const inMillions = value / 1_000_000;
    const rendered = inMillions >= 10 ? String(Math.round(inMillions)) : String(Number(inMillions.toFixed(2)));
    return `${rendered.replace(/\.?0+$/, "")}M ctx`;
  }
  const inThousands = Math.round(value / 1000);
  return `${inThousands}K ctx`;
};

const toActiveFingerprint = (model: ArbiterModelCatalog["models"][number]): string => {
  const parts: string[] = [];
  const context = formatContextWindow(model.openrouter.context_length);
  if (context) {
    parts.push(context);
  }
  const promptPrice = model.openrouter.pricing.prompt;
  const completionPrice = model.openrouter.pricing.completion;
  if (promptPrice === "0" && completionPrice === "0") {
    parts.push("free");
  } else {
    parts.push(`${formatPricePerMillion(promptPrice)}/${formatPricePerMillion(completionPrice)}`);
  }
  return parts.join(" · ");
};

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
      tierLabel: toTierLabel(model.tier),
      isAliased: model.is_aliased,
      summaryLine: model.summary_line,
      researchNote: model.research_note,
      riskNote: model.risk_note,
      isDefault: model.default,
      sortOrder: model.sort_order,
      activeFingerprint: toActiveFingerprint(model),
      openrouter: {
        canonicalSlug: model.openrouter.canonical_slug,
        addedToOpenRouterAt: model.openrouter.created,
        description: model.openrouter.description,
        contextLength: model.openrouter.context_length,
        pricing: {
          prompt: model.openrouter.pricing.prompt,
          completion: model.openrouter.pricing.completion,
          inputCacheRead: model.openrouter.pricing.input_cache_read,
          inputCacheWrite: model.openrouter.pricing.input_cache_write,
          webSearch: model.openrouter.pricing.web_search,
          audio: model.openrouter.pricing.audio,
          image: model.openrouter.pricing.image,
          internalReasoning: model.openrouter.pricing.internal_reasoning,
          request: model.openrouter.pricing.request
        },
        topProvider: {
          contextLength: model.openrouter.top_provider.context_length,
          maxCompletionTokens: model.openrouter.top_provider.max_completion_tokens,
          isModerated: model.openrouter.top_provider.is_moderated
        },
        architecture: {
          modality: model.openrouter.architecture.modality,
          inputModalities: model.openrouter.architecture.input_modalities,
          outputModalities: model.openrouter.architecture.output_modalities,
          tokenizer: model.openrouter.architecture.tokenizer,
          instructType: model.openrouter.architecture.instruct_type
        },
        expirationDate: model.openrouter.expiration_date
      }
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
