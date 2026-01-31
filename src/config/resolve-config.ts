import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  formatAjvErrors,
  validateCatalog,
  validateConfig,
  validatePromptManifest
} from "./schema-validation.js";
import type { ArbiterResolvedConfig } from "../generated/config.types.js";
import type { ArbiterModelCatalog } from "../generated/catalog.types.js";
import type { ArbiterPromptManifest } from "../generated/prompt-manifest.types.js";
import { sha256Hex } from "../utils/hash.js";

export interface ResolveConfigOptions {
  configPath?: string;
  catalogPath?: string;
  promptManifestPath?: string;
  rootDir?: string;
}

export interface ResolveConfigResult {
  resolvedConfig: ArbiterResolvedConfig;
  warnings: string[];
  catalog: ArbiterModelCatalog;
  promptManifest: ArbiterPromptManifest;
  catalogSha256: string;
  promptManifestSha256: string;
}

const readJsonFile = <T>(path: string): T => {
  const raw = readFileSync(path, "utf8");
  return JSON.parse(raw) as T;
};

const assertValid = (name: string, valid: boolean, errors: unknown): void => {
  if (valid) {
    return;
  }

  const formatted = formatAjvErrors(name, errors as never);
  const message = formatted.length > 0 ? formatted.join("\n") : `${name} is invalid`;
  throw new Error(message);
};

const resolvePromptEntry = (
  manifestMap: Map<string, ArbiterPromptManifest["entries"][number]>,
  id: string,
  expectedType: ArbiterPromptManifest["entries"][number]["type"],
  rootDir: string
): { sha256: string; text: string } => {
  const manifestEntry = manifestMap.get(id);
  if (!manifestEntry) {
    throw new Error(`Prompt id not found in manifest: ${id}`);
  }
  if (manifestEntry.type !== expectedType) {
    throw new Error(
      `Prompt id ${id} has type ${manifestEntry.type}, expected ${expectedType}`
    );
  }

  const promptPath = resolve(rootDir, manifestEntry.path);
  const promptBuffer = readFileSync(promptPath);
  const promptText = promptBuffer.toString("utf8");
  const promptSha = sha256Hex(promptBuffer);

  if (promptSha !== manifestEntry.sha256) {
    throw new Error(
      `Prompt hash mismatch for ${id}: expected ${manifestEntry.sha256} got ${promptSha}`
    );
  }

  return { sha256: promptSha, text: promptText };
};

const asNonEmptyArray = <T>(items: T[], label: string): [T, ...T[]] => {
  if (items.length === 0) {
    throw new Error(`Expected non-empty array for ${label}`);
  }
  return items as [T, ...T[]];
};

export const resolveConfig = (options: ResolveConfigOptions = {}): ResolveConfigResult => {
  const rootDir = options.rootDir ?? process.cwd();
  const configPath = resolve(rootDir, options.configPath ?? "arbiter.config.json");
  const catalogPath = resolve(rootDir, options.catalogPath ?? "catalog/models.json");
  const promptManifestPath = resolve(
    rootDir,
    options.promptManifestPath ?? "prompts/manifest.json"
  );

  const config = readJsonFile<ArbiterResolvedConfig>(configPath);
  assertValid("config", validateConfig(config), validateConfig.errors);

  const catalog = readJsonFile<ArbiterModelCatalog>(catalogPath);
  assertValid("catalog", validateCatalog(catalog), validateCatalog.errors);

  const promptManifest = readJsonFile<ArbiterPromptManifest>(promptManifestPath);
  assertValid("prompt manifest", validatePromptManifest(promptManifest), validatePromptManifest.errors);

  const promptMap = new Map(
    promptManifest.entries.map((entry) => [entry.id, entry])
  );

  const resolvedConfig: ArbiterResolvedConfig = JSON.parse(JSON.stringify(config));

  if (resolvedConfig.execution.retry_policy.backoff_ms === undefined) {
    resolvedConfig.execution.retry_policy.backoff_ms = 0;
  }

  const resolvedPersonas = resolvedConfig.sampling.personas.map((persona) => {
    const resolved = resolvePromptEntry(
      promptMap,
      persona.persona,
      "participant_persona",
      rootDir
    );

    return {
      persona: persona.persona,
      weight: persona.weight,
      sha256: resolved.sha256,
      text: resolved.text
    };
  });
  resolvedConfig.sampling.personas = asNonEmptyArray(resolvedPersonas, "sampling.personas");

  const resolvedProtocols = resolvedConfig.sampling.protocols.map((protocol) => {
    const resolved = resolvePromptEntry(
      promptMap,
      protocol.protocol,
      "participant_protocol_template",
      rootDir
    );

    return {
      protocol: protocol.protocol,
      weight: protocol.weight,
      sha256: resolved.sha256,
      text: resolved.text
    };
  });
  resolvedConfig.sampling.protocols = asNonEmptyArray(resolvedProtocols, "sampling.protocols");

  if (resolvedConfig.sampling.instruments) {
    resolvedConfig.sampling.instruments = resolvedConfig.sampling.instruments.map((instrument) => {
      const resolved = resolvePromptEntry(
        promptMap,
        instrument.instrument,
        "instrument_prompt",
        rootDir
      );

      return {
        instrument: instrument.instrument,
        sha256: resolved.sha256,
        text: resolved.text
      };
    });
  }

  const knownModels = new Set(catalog.models.map((model) => model.slug));
  const warnings: string[] = [];

  const resolvedModels = resolvedConfig.sampling.models.map((model) => {
    if (!knownModels.has(model.model)) {
      const status: "unknown_to_catalog" = "unknown_to_catalog";
      warnings.push(`Model not found in catalog: ${model.model}`);
      return {
        model: model.model,
        weight: model.weight,
        catalog_status: status
      };
    }

    const status: "known" | "unknown_to_catalog" = model.catalog_status ?? "known";
    return {
      model: model.model,
      weight: model.weight,
      catalog_status: status
    };
  });
  resolvedConfig.sampling.models = asNonEmptyArray(resolvedModels, "sampling.models");

  assertValid("resolved config", validateConfig(resolvedConfig), validateConfig.errors);

  return {
    resolvedConfig,
    warnings,
    catalog,
    promptManifest,
    catalogSha256: sha256Hex(readFileSync(catalogPath)),
    promptManifestSha256: sha256Hex(readFileSync(promptManifestPath))
  };
};
