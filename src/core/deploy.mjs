import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { validateRelativePath } from "./plugin-manifest.mjs";

function insideRoot(root, candidate) {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative === "" || (!relative.startsWith(".." + path.sep) && relative !== ".." && !path.isAbsolute(relative));
}

function sha256(filePath) {
  const hash = crypto.createHash("sha256");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex");
}

export function loadInstallManifest(filePath) {
  try {
    const value = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return value && Array.isArray(value.files) ? value : null;
  } catch {
    return null;
  }
}

function saveInstallManifest(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temp = filePath + ".tmp";
  fs.writeFileSync(temp, JSON.stringify(value, null, 2), "utf8");
  fs.renameSync(temp, filePath);
}

function resolveInstallDirectory(environment, pluginManifest) {
  const subdirectory = pluginManifest?.install?.subdirectory;
  if (!validateRelativePath(subdirectory)) throw new Error("INVALID_INSTALL_PATH");

  const normalized = subdirectory.replace(/\\/g, "/");
  const first = normalized.split("/")[0].toLowerCase();
  if (first !== "plugin" && first !== "script") throw new Error("INVALID_INSTALL_ROOT");

  const destination = path.resolve(environment.dataPath, subdirectory);
  if (!insideRoot(environment.dataPath, destination)) throw new Error("INSTALL_PATH_OUTSIDE_ENVIRONMENT");
  return destination;
}

export function getInstallState({ installManifestPath }) {
  const manifest = loadInstallManifest(installManifestPath);
  if (!manifest) return { installed: false, rollbackAvailable: false };
  const present = manifest.files.every(file => fs.existsSync(file.path));
  return {
    installed: present,
    rollbackAvailable: Boolean(manifest.rollback?.backupPath && fs.existsSync(manifest.rollback.backupPath)),
    artifact: manifest.artifact ?? null,
    installedAt: manifest.installedAt ?? null,
    files: manifest.files
  };
}

export function installArtifact({
  projectId,
  environment,
  pluginManifest,
  artifactPath,
  installManifestPath,
  backupRoot
}) {
  if (!fs.existsSync(artifactPath) || !fs.statSync(artifactPath).isFile()) {
    return { ok: false, error: "ARTIFACT_NOT_FOUND" };
  }

  let destinationDirectory;
  try {
    destinationDirectory = resolveInstallDirectory(environment, pluginManifest);
  } catch (error) {
    return { ok: false, error: error.message };
  }

  fs.mkdirSync(destinationDirectory, { recursive: true });
  const destinationPath = path.join(destinationDirectory, path.basename(artifactPath));
  if (!insideRoot(environment.dataPath, destinationPath)) {
    return { ok: false, error: "INSTALL_PATH_OUTSIDE_ENVIRONMENT" };
  }

  const previous = loadInstallManifest(installManifestPath);
  const previouslyOwned = previous?.files?.some(file => path.resolve(file.path) === path.resolve(destinationPath));

  let rollback = null;
  if (fs.existsSync(destinationPath)) {
    if (!previouslyOwned) {
      return { ok: false, error: "INSTALL_CONFLICT", path: destinationPath };
    }
    const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
    const backupDirectory = path.join(backupRoot, stamp);
    fs.mkdirSync(backupDirectory, { recursive: true });
    const backupPath = path.join(backupDirectory, path.basename(destinationPath));
    fs.copyFileSync(destinationPath, backupPath);
    rollback = { backupPath, destinationPath };
  }

  fs.copyFileSync(artifactPath, destinationPath);

  const manifest = {
    schemaVersion: 1,
    projectId,
    environmentId: environment.id,
    installedAt: new Date().toISOString(),
    artifact: {
      sourcePath: artifactPath,
      sha256: sha256(artifactPath),
      fileName: path.basename(artifactPath)
    },
    files: [{ path: destinationPath, sha256: sha256(destinationPath) }],
    rollback
  };

  saveInstallManifest(installManifestPath, manifest);
  return { ok: true, manifest, state: getInstallState({ installManifestPath }) };
}

export function uninstallManagedFiles({ environment, installManifestPath }) {
  const manifest = loadInstallManifest(installManifestPath);
  if (!manifest) return { ok: false, error: "NOT_INSTALLED" };

  for (const file of manifest.files) {
    if (!insideRoot(environment.dataPath, file.path)) {
      return { ok: false, error: "OWNED_FILE_OUTSIDE_ENVIRONMENT" };
    }
  }

  for (const file of manifest.files) {
    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
  }
  fs.rmSync(installManifestPath, { force: true });
  return { ok: true, state: { installed: false, rollbackAvailable: false } };
}

export function rollbackInstall({ environment, installManifestPath }) {
  const manifest = loadInstallManifest(installManifestPath);
  if (!manifest?.rollback?.backupPath || !fs.existsSync(manifest.rollback.backupPath)) {
    return { ok: false, error: "ROLLBACK_NOT_AVAILABLE" };
  }

  const destinationPath = manifest.rollback.destinationPath;
  if (!insideRoot(environment.dataPath, destinationPath)) {
    return { ok: false, error: "OWNED_FILE_OUTSIDE_ENVIRONMENT" };
  }

  fs.copyFileSync(manifest.rollback.backupPath, destinationPath);
  manifest.artifact = {
    sourcePath: manifest.rollback.backupPath,
    sha256: sha256(destinationPath),
    fileName: path.basename(destinationPath)
  };
  manifest.files = [{ path: destinationPath, sha256: sha256(destinationPath) }];
  manifest.rollback = null;
  manifest.installedAt = new Date().toISOString();
  saveInstallManifest(installManifestPath, manifest);
  return { ok: true, manifest, state: getInstallState({ installManifestPath }) };
}
