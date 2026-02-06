import { resolve } from "node:path";

import type { ArbiterResolvedConfig } from "../generated/config.types.js";
import type { ArbiterRunManifest } from "../generated/manifest.types.js";
import { writeJsonAtomic } from "./io.js";

export interface ResolveArtifactsOptions {
  runDir: string;
  resolvedConfig: ArbiterResolvedConfig;
  manifest: ArbiterRunManifest;
}

export interface ResolveArtifactsResult {
  configResolvedPath: string;
  manifestPath: string;
}

export const writeResolveArtifacts = (
  options: ResolveArtifactsOptions
): ResolveArtifactsResult => {
  const configResolvedPath = resolve(options.runDir, "config.resolved.json");
  const manifestPath = resolve(options.runDir, "manifest.json");

  writeJsonAtomic(configResolvedPath, options.resolvedConfig);
  writeJsonAtomic(manifestPath, options.manifest);

  return {
    configResolvedPath,
    manifestPath
  };
};
