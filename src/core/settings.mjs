import fs from "node:fs";
import path from "node:path";

export const SETTINGS_SCHEMA_VERSION = 1;

export function defaultSettings() {
  return {
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    theme: "dark",
    lastProjectId: null,
    window: { width: 1320, height: 820, x: null, y: null, maximized: false }
  };
}

export function mergeSettings(value = {}) {
  const base = defaultSettings();
  return {
    ...base,
    ...value,
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    window: { ...base.window, ...(value.window ?? {}) }
  };
}

export function loadSettings(filePath) {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return mergeSettings(parsed);
  } catch {
    const backupPath = filePath + ".backup";
    try {
      const parsed = JSON.parse(fs.readFileSync(backupPath, "utf8"));
      return mergeSettings(parsed);
    } catch {
      return defaultSettings();
    }
  }
}

export function saveSettings(filePath, settings) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const normalized = mergeSettings(settings);
  const temp = filePath + ".tmp";
  const backup = filePath + ".backup";
  if (fs.existsSync(filePath)) fs.copyFileSync(filePath, backup);
  fs.writeFileSync(temp, JSON.stringify(normalized, null, 2), "utf8");
  fs.renameSync(temp, filePath);
  return normalized;
}
