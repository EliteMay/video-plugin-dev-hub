import fs from "node:fs";
import path from "node:path";

const ALLOWED_TYPES = new Set([
  "aui2",
  "auo2",
  "auf2",
  "mod2",
  "aux2",
  "anm2",
  "obj2",
  "custom"
]);

export function validateRelativePath(value) {
  if (typeof value !== "string" || !value.trim()) return false;
  if (path.isAbsolute(value)) return false;
  const normalized = path.normalize(value);
  if (normalized === ".." || normalized.startsWith(".." + path.sep)) return false;
  return true;
}

export function validatePluginManifest(value) {
  const errors = [];
  if (!value || typeof value !== "object") return { valid: false, errors: ["INVALID_OBJECT"] };
  if (value.schemaVersion !== 1) errors.push("UNSUPPORTED_SCHEMA");
  if (!value.id || typeof value.id !== "string") errors.push("MISSING_ID");
  if (!value.name || typeof value.name !== "string") errors.push("MISSING_NAME");
  if (value.target?.application !== "aviutl2") errors.push("UNSUPPORTED_TARGET");
  if (!ALLOWED_TYPES.has(value.target?.pluginType)) errors.push("INVALID_PLUGIN_TYPE");

  const artifacts = value.build?.artifacts;
  if (Array.isArray(artifacts)) {
    for (const artifact of artifacts) {
      if (!validateRelativePath(artifact?.path)) errors.push("INVALID_ARTIFACT_PATH");
    }
  }

  return { valid: errors.length === 0, errors };
}

export function readPluginManifest(repositoryPath) {
  const manifestPath = path.join(repositoryPath, "plugin-project.json");
  if (!fs.existsSync(manifestPath)) {
    return { found: false, valid: false, errors: ["NOT_FOUND"] };
  }

  try {
    const value = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    const validation = validatePluginManifest(value);
    return {
      found: true,
      ...validation,
      value: validation.valid ? value : null
    };
  } catch (error) {
    return {
      found: true,
      valid: false,
      errors: ["INVALID_JSON"],
      message: error?.message ?? String(error)
    };
  }
}

export function compatibilityState(manifest, environment) {
  if (!manifest?.target) return { status: "unknown", reason: "NO_MANIFEST" };
  if (manifest.target.application !== "aviutl2") {
    return { status: "blocked", reason: "WRONG_TARGET" };
  }
  if (manifest.target.architecture && manifest.target.architecture !== "x64") {
    return { status: "blocked", reason: "UNSUPPORTED_ARCHITECTURE" };
  }
  if (!environment?.aviutl2?.available) {
    return { status: "unknown", reason: "AVIUTL2_NOT_CONFIGURED" };
  }
  if (manifest.target.minimumVersion) {
    return { status: "needs-version-check", reason: "AVIUTL2_VERSION_NOT_READ" };
  }
  return { status: "ready-for-runtime-test", reason: null };
}
