import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { compileFromFile } from "json-schema-to-typescript";

import { GENERATED_BANNER, GENERATED_DIR, SCHEMA_DIR, SCHEMA_REGISTRY } from "../config/schema-registry.js";

const generateTypes = async () => {
  mkdirSync(GENERATED_DIR, { recursive: true });

  for (const entry of SCHEMA_REGISTRY) {
    const schemaPath = join(SCHEMA_DIR, entry.schemaFile);
    const outputPath = join(GENERATED_DIR, entry.generatedTypeFile);
    const compiled = await compileFromFile(schemaPath, {
      bannerComment: GENERATED_BANNER
    });
    writeFileSync(outputPath, compiled, "utf8");
  }

  console.log(`Generated ${SCHEMA_REGISTRY.length} schema-derived type files.`);
};

await generateTypes();
