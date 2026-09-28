import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { defaultSettings, loadSettings, saveSettings } from "../src/core/settings.mjs";

test("default settings are dark and schema-versioned", () => {
  const value = defaultSettings();
  assert.equal(value.theme, "dark");
  assert.equal(value.schemaVersion, 2);
  assert.equal(value.update.checkOnStartup, true);
});

test("settings are written and loaded", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vpdh-"));
  const file = path.join(dir, "settings.json");
  saveSettings(file, {
    window: { width: 1600, height: 900 },
    update: { checkOnStartup: false }
  });
  const loaded = loadSettings(file);
  assert.equal(loaded.window.width, 1600);
  assert.equal(loaded.window.height, 900);
  assert.equal(loaded.update.checkOnStartup, false);
});

test("schema 1 settings migrate with updater defaults", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vpdh-"));
  const file = path.join(dir, "settings.json");
  fs.writeFileSync(file, JSON.stringify({
    schemaVersion: 1,
    theme: "dark",
    window: { width: 1400 }
  }), "utf8");
  const loaded = loadSettings(file);
  assert.equal(loaded.schemaVersion, 2);
  assert.equal(loaded.window.width, 1400);
  assert.equal(loaded.update.checkOnStartup, true);
});

test("corrupt current settings recover from last-known-good backup", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vpdh-"));
  const file = path.join(dir, "settings.json");
  saveSettings(file, { theme: "dark", lastProjectId: "first" });
  saveSettings(file, { theme: "dark", lastProjectId: "second" });
  fs.writeFileSync(file, "{broken", "utf8");
  const loaded = loadSettings(file);
  assert.equal(loaded.lastProjectId, "first");
  assert.equal(fs.existsSync(path.join(dir, "settings.backup.json")), true);
});
