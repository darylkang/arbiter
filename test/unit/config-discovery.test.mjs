import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

import { DEFAULT_CONFIG_FILENAME, listConfigCandidates, listValidConfigCandidates } from "../../dist/ui/transcript/config-discovery.js";

const withTempDir = (fn) => {
  const cwd = mkdtempSync(join(tmpdir(), "arbiter-config-discovery-"));
  try {
    return fn(cwd);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
};

test("listConfigCandidates discovers default and extension configs in sorted order", () => {
  withTempDir((cwd) => {
    writeFileSync(join(cwd, "zeta.arbiter.json"), "{\n  \"ok\": true\n}\n", "utf8");
    writeFileSync(join(cwd, DEFAULT_CONFIG_FILENAME), "{\n  \"ok\": true\n}\n", "utf8");
    writeFileSync(join(cwd, "alpha.arbiter.json"), "{\n  \"ok\": true\n}\n", "utf8");
    writeFileSync(join(cwd, "ignore.json"), "{\n  \"ok\": true\n}\n", "utf8");

    const candidates = listConfigCandidates({ cwd });
    assert.equal(candidates.length, 3);
    assert.deepEqual(
      candidates.map((candidate) => candidate.name),
      [DEFAULT_CONFIG_FILENAME, "alpha.arbiter.json", "zeta.arbiter.json"]
    );
    assert.ok(candidates.every((candidate) => candidate.valid));
    assert.equal(candidates[0].isDefault, true);
  });
});

test("listConfigCandidates marks invalid JSON as disabled and sorts it after valid files", () => {
  withTempDir((cwd) => {
    writeFileSync(join(cwd, "a.arbiter.json"), "{\n  \"ok\": true\n}\n", "utf8");
    writeFileSync(join(cwd, "b.arbiter.json"), "{ invalid json", "utf8");

    const candidates = listConfigCandidates({ cwd });
    assert.equal(candidates.length, 2);
    assert.equal(candidates[0].name, "a.arbiter.json");
    assert.equal(candidates[0].valid, true);
    assert.equal(candidates[1].name, "b.arbiter.json");
    assert.equal(candidates[1].valid, false);
    assert.match(candidates[1].disabledReason ?? "", /Invalid JSON/);

    const validCandidates = listValidConfigCandidates({ cwd });
    assert.equal(validCandidates.length, 1);
    assert.equal(validCandidates[0].name, "a.arbiter.json");
  });
});

test("listConfigCandidates reports non-ENOENT discovery errors through callback", () => {
  withTempDir((cwd) => {
    const notDirectoryPath = join(cwd, "not-a-directory.txt");
    writeFileSync(notDirectoryPath, "data", "utf8");

    const messages = [];
    const candidates = listConfigCandidates({
      cwd: notDirectoryPath,
      onError: (message) => messages.push(message)
    });

    assert.deepEqual(candidates, []);
    assert.equal(messages.length, 1);
    assert.match(messages[0], /failed to discover config files/i);
  });
});
