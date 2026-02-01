import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const detectAssetRoot = (): string => {
  const moduleDir = dirname(fileURLToPath(import.meta.url));
  const distOrSrcRoot = resolve(moduleDir, "..", "..");
  const packageRoot = resolve(distOrSrcRoot, "..");

  if (existsSync(resolve(packageRoot, "package.json"))) {
    return packageRoot;
  }

  if (existsSync(resolve(distOrSrcRoot, "package.json"))) {
    return distOrSrcRoot;
  }

  return process.cwd();
};

const ASSET_ROOT = detectAssetRoot();

export const getAssetRoot = (): string => ASSET_ROOT;
