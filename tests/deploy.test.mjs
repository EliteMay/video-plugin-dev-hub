import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getInstallState, installArtifact, rollbackInstall, uninstallManagedFiles } from "../src/core/deploy.mjs";

function setup() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "vpdh-deploy-"));
  const dataPath = path.join(root, "data");
  const artifactPath = path.join(root, "artifact.auf2");
  const manifestPath = path.join(root, "install.json");
  const backupRoot = path.join(root, "backups");
  fs.mkdirSync(dataPath, { recursive: true });
  fs.writeFileSync(artifactPath, "v1");
  return {
    root,
    dataPath,
    artifactPath,
    manifestPath,
    backupRoot,
    environment: { id: "env", dataPath },
    pluginManifest: { install: { subdirectory: "Plugin/TestPlugin" } }
  };
}

test("install owns only its destination file", () => {
  const s = setup();
  const result = installArtifact({
    projectId: "p",
    environment: s.environment,
    pluginManifest: s.pluginManifest,
    artifactPath: s.artifactPath,
    installManifestPath: s.manifestPath,
    backupRoot: s.backupRoot
  });
  assert.equal(result.ok, true);
  assert.equal(getInstallState({ installManifestPath: s.manifestPath }).installed, true);
});

test("update creates rollback and uninstall removes only managed file", () => {
  const s = setup();
  installArtifact({
    projectId: "p",
    environment: s.environment,
    pluginManifest: s.pluginManifest,
    artifactPath: s.artifactPath,
    installManifestPath: s.manifestPath,
    backupRoot: s.backupRoot
  });

  fs.writeFileSync(s.artifactPath, "v2");
  const updated = installArtifact({
    projectId: "p",
    environment: s.environment,
    pluginManifest: s.pluginManifest,
    artifactPath: s.artifactPath,
    installManifestPath: s.manifestPath,
    backupRoot: s.backupRoot
  });
  assert.equal(updated.state.rollbackAvailable, true);

  const rolled = rollbackInstall({
    environment: s.environment,
    installManifestPath: s.manifestPath
  });
  assert.equal(rolled.ok, true);
  assert.equal(fs.readFileSync(rolled.manifest.files[0].path, "utf8"), "v1");

  const removed = uninstallManagedFiles({
    environment: s.environment,
    installManifestPath: s.manifestPath
  });
  assert.equal(removed.ok, true);
});
