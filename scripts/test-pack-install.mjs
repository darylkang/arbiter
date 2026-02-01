import { execSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";

const root = process.cwd();
const packOutput = execSync("npm pack", { encoding: "utf8" }).trim().split("\n").pop();
if (!packOutput) {
  throw new Error("npm pack did not return a tarball name");
}

const tgzPath = resolve(root, packOutput);
const tempRoot = mkdtempSync(resolve(tmpdir(), "arbiter-pack-"));

try {
  execSync(`npm install ${tgzPath} --prefix ${tempRoot}`, { stdio: "inherit" });

  const binPath = resolve(tempRoot, "node_modules", ".bin", "arbiter");

  execSync(`${binPath} --help`, { stdio: "inherit" });
  execSync(`${binPath} init "Pack smoke question"`, { cwd: tempRoot, stdio: "inherit" });
  execSync(`${binPath} validate`, { cwd: tempRoot, stdio: "inherit" });
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
  rmSync(tgzPath, { force: true });
}

console.log("Pack install smoke test OK");
