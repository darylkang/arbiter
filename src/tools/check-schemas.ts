import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  GENERATED_DIR,
  GENERATED_TYPE_FILE_NAMES,
  SCHEMA_DIR,
  SCHEMA_FILE_NAMES,
  SCHEMA_REGISTRY
} from "../config/schema-registry.js";
import "../config/schema-validation.js";

const listFiles = (dir: string, suffix: string) =>
  readdirSync(dir)
    .filter((name) => name.endsWith(suffix))
    .sort();

const schemaFilesOnDisk = listFiles(SCHEMA_DIR, ".schema.json");
const generatedTypesOnDisk = listFiles(GENERATED_DIR, ".types.ts");

assert.equal(
  SCHEMA_FILE_NAMES.size,
  SCHEMA_REGISTRY.length,
  "Schema registry must not contain duplicate schema filenames."
);

assert.equal(
  GENERATED_TYPE_FILE_NAMES.size,
  SCHEMA_REGISTRY.length,
  "Schema registry must not contain duplicate generated type outputs."
);

assert.equal(
  new Set(SCHEMA_REGISTRY.map((entry) => entry.validatorExport)).size,
  SCHEMA_REGISTRY.length,
  "Schema registry must not contain duplicate validator export names."
);

const missingSchemaFiles = [...SCHEMA_FILE_NAMES].filter((file) => !schemaFilesOnDisk.includes(file));
const unregisteredSchemaFiles = schemaFilesOnDisk.filter((file) => !SCHEMA_FILE_NAMES.has(file));
const missingGeneratedTypes = [...GENERATED_TYPE_FILE_NAMES].filter(
  (file) => !generatedTypesOnDisk.includes(file)
);
const orphanGeneratedTypes = generatedTypesOnDisk.filter((file) => !GENERATED_TYPE_FILE_NAMES.has(file));

assert.deepEqual(missingSchemaFiles, [], `Missing schema files: ${missingSchemaFiles.join(", ")}`);
assert.deepEqual(
  unregisteredSchemaFiles,
  [],
  `Unregistered schema files in schemas/: ${unregisteredSchemaFiles.join(", ")}`
);
assert.deepEqual(
  missingGeneratedTypes,
  [],
  `Missing generated type files in src/generated/: ${missingGeneratedTypes.join(", ")}`
);
assert.deepEqual(
  orphanGeneratedTypes,
  [],
  `Orphan generated type files in src/generated/: ${orphanGeneratedTypes.join(", ")}`
);

const seenIds = new Set<string>();

for (const entry of SCHEMA_REGISTRY) {
  const schemaPath = join(SCHEMA_DIR, entry.schemaFile);
  const schema = JSON.parse(readFileSync(schemaPath, "utf8")) as {
    $schema?: unknown;
    $id?: unknown;
  };

  assert.equal(
    schema.$schema,
    "https://json-schema.org/draft/2020-12/schema",
    `${entry.schemaFile} must declare draft 2020-12.`
  );
  assert.equal(typeof schema.$id, "string", `${entry.schemaFile} must declare a string $id.`);
  assert.ok((schema.$id as string).length > 0, `${entry.schemaFile} must declare a non-empty $id.`);
  assert.ok(!seenIds.has(schema.$id as string), `Duplicate schema $id detected: ${schema.$id as string}`);
  seenIds.add(schema.$id as string);
}

console.log(
  `Schema checks OK (${SCHEMA_REGISTRY.length} registered schemas, ${generatedTypesOnDisk.length} generated type files).`
);
