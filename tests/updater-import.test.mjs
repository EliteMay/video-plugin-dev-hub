import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("main process imports electron-updater through its CommonJS default export", () => {
  const source = fs.readFileSync(new URL("../src/main.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(source, /import\s*\{\s*autoUpdater\s*\}\s*from\s*["']electron-updater["']/);
  assert.match(source, /import\s+electronUpdater\s+from\s+["']electron-updater["']/);
  assert.match(source, /const\s*\{\s*autoUpdater\s*\}\s*=\s*electronUpdater/);
});
