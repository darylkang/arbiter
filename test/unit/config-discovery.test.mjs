import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

import {
  DEFAULT_CONFIG_FILENAME,
  listConfigFiles,
  nextCollisionSafeConfigPath
} from "../../dist/cli/commands.js";

const withTempDir = (fn) => {
  const cwd = mkdtempSync(join(tmpdir(), "arbiter-config-discovery-"));
  try {
    return fn(cwd);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
};

test("listConfigFiles discovers only contract-matching config names in sorted order", () => {
  withTempDir((cwd) => {
    writeFileSync(join(cwd, "arbiter.config.2.json"), "{\n  \"ok\": true\n}\n", "utf8");
    writeFileSync(join(cwd, DEFAULT_CONFIG_FILENAME), "{\n  \"ok\": true\n}\n", "utf8");
    writeFileSync(join(cwd, "arbiter.config.1.json"), "{\n  \"ok\": true\n}\n", "utf8");
    writeFileSync(join(cwd, "arbiter.config.01.json"), "{\n  \"ok\": true\n}\n", "utf8");
    writeFileSync(join(cwd, "ignore.json"), "{\n  \"ok\": true\n}\n", "utf8");
    writeFileSync(join(cwd, "foo.arbiter.json"), "{\n  \"ok\": true\n}\n", "utf8");

    const candidates = listConfigFiles(cwd);
    assert.deepEqual(candidates, [
      "arbiter.config.1.json",
      "arbiter.config.2.json",
      "arbiter.config.json"
    ]);
  });
});

test("listConfigFiles is filename-based and includes invalid JSON when name matches", () => {
  withTempDir((cwd) => {
    writeFileSync(join(cwd, "arbiter.config.json"), "{ invalid json", "utf8");
    writeFileSync(join(cwd, "arbiter.config.1.json"), "{\n  \"ok\": true\n}\n", "utf8");

    const candidates = listConfigFiles(cwd);
    assert.equal(candidates.length, 2);
    assert.deepEqual(candidates, ["arbiter.config.1.json", "arbiter.config.json"]);
  });
});

test("nextCollisionSafeConfigPath finds the first free deterministic filename", () => {
  withTempDir((cwd) => {
    assert.equal(
      nextCollisionSafeConfigPath(cwd),
      resolve(cwd, "arbiter.config.json")
    );

    writeFileSync(join(cwd, "arbiter.config.json"), "{\n  \"ok\": true\n}\n", "utf8");
    assert.equal(
      nextCollisionSafeConfigPath(cwd),
      resolve(cwd, "arbiter.config.1.json")
    );

    writeFileSync(join(cwd, "arbiter.config.1.json"), "{\n  \"ok\": true\n}\n", "utf8");
    writeFileSync(join(cwd, "arbiter.config.2.json"), "{\n  \"ok\": true\n}\n", "utf8");
    assert.equal(
      nextCollisionSafeConfigPath(cwd),
      resolve(cwd, "arbiter.config.3.json")
    );
  });
});
