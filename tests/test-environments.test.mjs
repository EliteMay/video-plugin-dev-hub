import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createTestEnvironment, loadEnvironments, saveEnvironments } from "../src/core/test-environments.mjs";

test("environment registry survives save and load", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vpdh-env-"));
  const file = path.join(dir, "environments.json");
  saveEnvironments(file, { environments: [{ id: "one", name: "One" }] });
  assert.equal(loadEnvironments(file).environments[0].id, "one");
});

test("test environment copies app files but creates a fresh data folder", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vpdh-env-create-"));
  const source = path.join(dir, "source");
  const root = path.join(dir, "envs");
  fs.mkdirSync(path.join(source, "data"), { recursive: true });
  fs.writeFileSync(path.join(source, "AviUtl2.exe"), "fake");
  fs.writeFileSync(path.join(source, "data", "old.conf"), "old");

  const result = createTestEnvironment({
    sourceExecutable: path.join(source, "AviUtl2.exe"),
    environmentsRoot: root
  });

  assert.equal(result.ok, true);
  assert.equal(fs.existsSync(result.environment.executablePath), true);
  assert.equal(fs.existsSync(path.join(result.environment.dataPath, "old.conf")), false);
});
