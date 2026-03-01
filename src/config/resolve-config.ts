import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  formatAjvErrors,
  validateCatalog,
  validateConfig,
  validateContractManifest,
  validateDecisionContract,
  validateProtocolSpec,
  validatePromptManifest
} from "./schema-validation.js";
import type { ArbiterResolvedConfig } from "../generated/config.types.js";
import type { ArbiterModelCatalog } from "../generated/catalog.types.js";
import type { ArbiterPromptManifest } from "../generated/prompt-manifest.types.js";
import type { ArbiterDecisionContractManifest } from "../generated/contract-manifest.types.js";
import type { ArbiterDecisionContractPreset } from "../generated/decision-contract.types.js";
import type { ArbiterProtocolSpec } from "../generated/protocol.types.js";
import { sha256Hex } from "../utils/hash.js";
import { DEFAULT_EMBEDDING_MAX_CHARS, DEFAULT_STOP_POLICY } from "./defaults.js";

export interface ResolveConfigOptions {
  configPath?: string;
  configRoot?: string;
  catalogPath?: string;
  promptManifestPath?: string;
  contractManifestPath?: string;
  assetRoot?: string;
}

export interface ResolveConfigResult {
  sourceConfig: ArbiterResolvedConfig;
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

const DEFAULT_PROTOCOL_TIMEOUTS = {
  per_call_timeout_ms: 90_000,
  per_call_max_retries: 2,
  total_trial_timeout_ms: 300_000
};

export const resolveConfig = (options: ResolveConfigOptions = {}): ResolveConfigResult => {
  const configRoot = options.configRoot ?? process.cwd();
  const assetRoot = options.assetRoot ?? configRoot;
  const configPath = resolve(configRoot, options.configPath ?? "arbiter.config.json");
  const catalogPath = resolve(assetRoot, options.catalogPath ?? "resources/catalog/models.json");
  const promptManifestPath = resolve(
    assetRoot,
    options.promptManifestPath ?? "resources/prompts/manifest.json"
  );
  const contractManifestPath = resolve(
    assetRoot,
    options.contractManifestPath ?? "resources/contracts/manifest.json"
  );

  const sourceConfig = readJsonFile<ArbiterResolvedConfig>(configPath);
  const config = JSON.parse(JSON.stringify(sourceConfig)) as ArbiterResolvedConfig;
  if (!config.protocol) {
    throw new Error("Protocol configuration is required.");
  }
  if (!config.protocol.timeouts) {
    config.protocol.timeouts = { ...DEFAULT_PROTOCOL_TIMEOUTS };
  } else {
    config.protocol.timeouts = {
      per_call_timeout_ms:
        config.protocol.timeouts.per_call_timeout_ms ??
        DEFAULT_PROTOCOL_TIMEOUTS.per_call_timeout_ms,
      per_call_max_retries:
        config.protocol.timeouts.per_call_max_retries ??
        DEFAULT_PROTOCOL_TIMEOUTS.per_call_max_retries,
      total_trial_timeout_ms:
        config.protocol.timeouts.total_trial_timeout_ms ??
        DEFAULT_PROTOCOL_TIMEOUTS.total_trial_timeout_ms
    };
  }

  const catalog = readJsonFile<ArbiterModelCatalog>(catalogPath);
  assertValid("catalog", validateCatalog(catalog), validateCatalog.errors);

  const promptManifest = readJsonFile<ArbiterPromptManifest>(promptManifestPath);
  assertValid("prompt manifest", validatePromptManifest(promptManifest), validatePromptManifest.errors);

  const promptMap = new Map(
    promptManifest.entries.map((entry) => [entry.id, entry])
  );

  const contractManifest = config.protocol.decision_contract
    ? readJsonFile<ArbiterDecisionContractManifest>(contractManifestPath)
    : null;
  if (contractManifest) {
    assertValid(
      "contract manifest",
      validateContractManifest(contractManifest),
      validateContractManifest.errors
    );
  }

  const contractMap = new Map(
    contractManifest?.entries.map((entry) => [entry.id, entry]) ?? []
  );

  const resolvedConfig: ArbiterResolvedConfig = JSON.parse(JSON.stringify(config));

  if (resolvedConfig.execution.retry_policy.backoff_ms === undefined) {
    resolvedConfig.execution.retry_policy.backoff_ms = 0;
  }

  if (!resolvedConfig.execution.stop_policy) {
    resolvedConfig.execution.stop_policy = { ...DEFAULT_STOP_POLICY };
  } else {
    resolvedConfig.execution.stop_policy = {
      novelty_epsilon:
        resolvedConfig.execution.stop_policy.novelty_epsilon ??
        DEFAULT_STOP_POLICY.novelty_epsilon,
      similarity_threshold:
        resolvedConfig.execution.stop_policy.similarity_threshold ??
        DEFAULT_STOP_POLICY.similarity_threshold,
      patience:
        resolvedConfig.execution.stop_policy.patience ?? DEFAULT_STOP_POLICY.patience
    };
  }

  if (resolvedConfig.protocol.timeouts) {
    resolvedConfig.protocol.timeouts = {
      per_call_timeout_ms:
        resolvedConfig.protocol.timeouts.per_call_timeout_ms ??
        DEFAULT_PROTOCOL_TIMEOUTS.per_call_timeout_ms,
      per_call_max_retries:
        resolvedConfig.protocol.timeouts.per_call_max_retries ??
        DEFAULT_PROTOCOL_TIMEOUTS.per_call_max_retries,
      total_trial_timeout_ms:
        resolvedConfig.protocol.timeouts.total_trial_timeout_ms ??
        DEFAULT_PROTOCOL_TIMEOUTS.total_trial_timeout_ms
    };
  }

  if (resolvedConfig.protocol.type === "debate_v1") {
    resolvedConfig.protocol.participants = resolvedConfig.protocol.participants ?? 2;
    resolvedConfig.protocol.rounds = resolvedConfig.protocol.rounds ?? 1;
  }

  if (resolvedConfig.measurement.embedding_max_chars === undefined) {
    resolvedConfig.measurement.embedding_max_chars = DEFAULT_EMBEDDING_MAX_CHARS;
  }

  const resolvedPersonas = resolvedConfig.sampling.personas.map((persona) => {
    const resolved = resolvePromptEntry(
      promptMap,
      persona.persona,
      "participant_persona",
      assetRoot
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
      assetRoot
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
        assetRoot
      );

      return {
        instrument: instrument.instrument,
        sha256: resolved.sha256,
        text: resolved.text
      };
    });
  }

  if (resolvedConfig.protocol.type === "debate_v1") {
    const protocolPath = resolve(assetRoot, "resources/prompts/protocols/debate_v1/protocol.json");
    const protocolSpec = readJsonFile<ArbiterProtocolSpec>(protocolPath);
    assertValid("protocol spec", validateProtocolSpec(protocolSpec), validateProtocolSpec.errors);

    const proposerPrompt = resolvePromptEntry(
      promptMap,
      protocolSpec.prompts.proposer_system,
      "participant_protocol_template",
      assetRoot
    );
    const criticPrompt = resolvePromptEntry(
      promptMap,
      protocolSpec.prompts.critic_system,
      "participant_protocol_template",
      assetRoot
    );
    const proposerFinalPrompt = resolvePromptEntry(
      promptMap,
      protocolSpec.prompts.proposer_final_system,
      "participant_protocol_template",
      assetRoot
    );

    resolvedConfig.protocol.prompts = {
      proposer_system: {
        id: protocolSpec.prompts.proposer_system,
        sha256: proposerPrompt.sha256,
        text: proposerPrompt.text
      },
      critic_system: {
        id: protocolSpec.prompts.critic_system,
        sha256: criticPrompt.sha256,
        text: criticPrompt.text
      },
      proposer_final_system: {
        id: protocolSpec.prompts.proposer_final_system,
        sha256: proposerFinalPrompt.sha256,
        text: proposerFinalPrompt.text
      }
    };
  }

  if (resolvedConfig.protocol.decision_contract) {
    const contractEntry = contractMap.get(resolvedConfig.protocol.decision_contract.id);
    if (!contractEntry) {
      throw new Error(
        `Decision contract not found in manifest: ${resolvedConfig.protocol.decision_contract.id}`
      );
    }
    const contractPath = resolve(assetRoot, contractEntry.path);
    const contract = readJsonFile<ArbiterDecisionContractPreset>(contractPath);
    assertValid(
      "decision contract",
      validateDecisionContract(contract),
      validateDecisionContract.errors
    );
    const contractSha256 = sha256Hex(readFileSync(contractPath));
    if (contractSha256 !== contractEntry.sha256) {
      throw new Error(
        `Decision contract sha256 mismatch for ${contractEntry.id}: expected ${contractEntry.sha256}, got ${contractSha256}`
      );
    }
    resolvedConfig.protocol.decision_contract = {
      id: contractEntry.id,
      sha256: contractSha256,
      schema: contract.schema,
      embed_text_source: contract.embed_text_source,
      ...(contract.rationale_max_chars !== undefined
        ? { rationale_max_chars: contract.rationale_max_chars }
        : {})
    };
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
    sourceConfig,
    resolvedConfig,
    warnings,
    catalog,
    promptManifest,
    catalogSha256: sha256Hex(readFileSync(catalogPath)),
    promptManifestSha256: sha256Hex(readFileSync(promptManifestPath))
  };
};
