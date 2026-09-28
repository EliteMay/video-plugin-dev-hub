import fs from "node:fs";
import path from "node:path";

export const SETTINGS_SCHEMA_VERSION = 2;

function backupPathFor(filePath) {
  const extension = path.extname(filePath);
  const baseName = extension ? path.basename(filePath, extension) : path.basename(filePath);
  return path.join(path.dirname(filePath), baseName + ".backup" + extension);
}

export function defaultSettings() {
  return {
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    theme: "dark",
    lastProjectId: null,
    update: {
      checkOnStartup: true
    },
    window: { width: 1320, height: 820, x: null, y: null, maximized: false }
  };
}

export function mergeSettings(value = {}) {
  const base = defaultSettings();
  return {
    ...base,
    ...value,
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    update: { ...base.update, ...(value.update ?? {}) },
    window: { ...base.window, ...(value.window ?? {}) }
  };
}

export function loadSettings(filePath) {
  const candidates = [
    filePath,
    backupPathFor(filePath),
    filePath + ".backup"
  ];

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(fs.readFileSync(candidate, "utf8"));
      return mergeSettings(parsed);
    } catch {}
  }

  return defaultSettings();
}

export function saveSettings(filePath, settings) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const normalized = mergeSettings(settings);
  const temp = filePath + ".tmp";
  const backup = backupPathFor(filePath);
  if (fs.existsSync(filePath)) fs.copyFileSync(filePath, backup);
  fs.writeFileSync(temp, JSON.stringify(normalized, null, 2), "utf8");
  fs.renameSync(temp, filePath);
  return normalized;
}
