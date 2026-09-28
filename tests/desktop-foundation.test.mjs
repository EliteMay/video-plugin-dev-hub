import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

function read(relative) {
  return fs.readFileSync(new URL("../" + relative, import.meta.url), "utf8");
}

test("renderer pages define restrictive CSP", () => {
  for (const file of ["src/renderer/index.html", "src/renderer/recovery.html"]) {
    const source = read(file);
    assert.match(source, /Content-Security-Policy/);
    assert.match(source, /object-src 'none'/);
    assert.match(source, /base-uri 'none'/);
  }
});

test("main process rejects untrusted IPC and renderer navigation", () => {
  const source = read("src/main.mjs");
  assert.match(source, /event\?\.sender === mainWindow\.webContents/);
  assert.match(source, /IPC_PAYLOAD_TOO_LARGE/);
  assert.match(source, /setWindowOpenHandler/);
  assert.match(source, /setPermissionRequestHandler/);
});

test("one-click updater has explicit download and install capabilities", () => {
  const main = read("src/main.mjs");
  const preload = read("src/preload.cjs");
  assert.match(main, /hub:download-update/);
  assert.match(main, /hub:install-update/);
  assert.match(main, /download-progress/);
  assert.match(preload, /downloadUpdate/);
  assert.match(preload, /installUpdate/);
});

test("diagnostics export and recovery actions are exposed narrowly", () => {
  const preload = read("src/preload.cjs");
  assert.match(preload, /exportDiagnostics/);
  assert.match(preload, /clearDiagnostics/);
  assert.match(preload, /reloadRenderer/);
  assert.doesNotMatch(preload, /child_process|exec\(|spawn\(/);
});
