import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { defaultSettings, loadSettings, saveSettings } from "../src/core/settings.mjs";

test("default settings are dark and schema-versioned", () => {
  const value = defaultSettings();
  assert.equal(value.theme, "dark");
  assert.equal(value.schemaVersion, 1);
});

test("settings are written and loaded", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vpdh-"));
  const file = path.join(dir, "settings.json");
  saveSettings(file, { window: { width: 1600, height: 900 } });
  const loaded = loadSettings(file);
  assert.equal(loaded.window.width, 1600);
  assert.equal(loaded.window.height, 900);
});

test("corrupt current settings recover from backup", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vpdh-"));
  const file = path.join(dir, "settings.json");
  saveSettings(file, { theme: "dark", lastProjectId: "first" });
  saveSettings(file, { theme: "dark", lastProjectId: "second" });
  fs.writeFileSync(file, "{broken", "utf8");
  const loaded = loadSettings(file);
  assert.equal(loaded.lastProjectId, "first");
});
