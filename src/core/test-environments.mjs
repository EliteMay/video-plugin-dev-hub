import fs from "node:fs";
import path from "node:path";

export const ENVIRONMENTS_SCHEMA_VERSION = 1;

export function defaultEnvironmentStore() {
  return { schemaVersion: ENVIRONMENTS_SCHEMA_VERSION, environments: [] };
}

export function loadEnvironments(filePath) {
  for (const candidate of [filePath, filePath + ".backup"]) {
    try {
      const parsed = JSON.parse(fs.readFileSync(candidate, "utf8"));
      if (!Array.isArray(parsed.environments)) continue;
      return { schemaVersion: ENVIRONMENTS_SCHEMA_VERSION, environments: parsed.environments };
    } catch {}
  }
  return defaultEnvironmentStore();
}

export function saveEnvironments(filePath, store) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temp = filePath + ".tmp";
  const backup = filePath + ".backup";
  if (fs.existsSync(filePath)) fs.copyFileSync(filePath, backup);
  const normalized = {
    schemaVersion: ENVIRONMENTS_SCHEMA_VERSION,
    environments: Array.isArray(store.environments) ? store.environments : []
  };
  fs.writeFileSync(temp, JSON.stringify(normalized, null, 2), "utf8");
  fs.renameSync(temp, filePath);
  return normalized;
}

function copyInstallDirectory(sourceDirectory, destinationDirectory) {
  fs.mkdirSync(destinationDirectory, { recursive: true });
  for (const entry of fs.readdirSync(sourceDirectory, { withFileTypes: true })) {
    if (entry.name.toLowerCase() === "data") continue;
    const source = path.join(sourceDirectory, entry.name);
    const destination = path.join(destinationDirectory, entry.name);
    fs.cpSync(source, destination, { recursive: true, force: false, errorOnExist: false });
  }
}

export function createTestEnvironment({
  sourceExecutable,
  environmentsRoot,
  name = "AviUtl2 Test"
}) {
  if (!sourceExecutable || !fs.existsSync(sourceExecutable)) {
    return { ok: false, error: "AVIUTL2_NOT_CONFIGURED" };
  }

  const sourceDirectory = path.dirname(sourceExecutable);
  const executableName = path.basename(sourceExecutable);
  const id = "aviutl2-" + new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  const rootPath = path.join(environmentsRoot, id);
  const appPath = path.join(rootPath, "app");
  const dataPath = path.join(appPath, "data");

  if (fs.existsSync(rootPath)) {
    return { ok: false, error: "ENVIRONMENT_ALREADY_EXISTS" };
  }

  try {
    copyInstallDirectory(sourceDirectory, appPath);
    fs.mkdirSync(dataPath, { recursive: true });
    const executablePath = path.join(appPath, executableName);
    if (!fs.existsSync(executablePath)) {
      fs.rmSync(rootPath, { recursive: true, force: true });
      return { ok: false, error: "AVIUTL2_COPY_FAILED" };
    }

    return {
      ok: true,
      environment: {
        id,
        name,
        target: "aviutl2",
        rootPath,
        appPath,
        dataPath,
        executablePath,
        sourceExecutable,
        createdAt: new Date().toISOString()
      }
    };
  } catch (error) {
    try { fs.rmSync(rootPath, { recursive: true, force: true }); } catch {}
    return {
      ok: false,
      error: "ENVIRONMENT_CREATE_FAILED",
      message: error?.message ?? String(error)
    };
  }
}
