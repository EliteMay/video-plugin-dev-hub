import test from "node:test";
import assert from "node:assert/strict";
import { compatibilityState, validatePluginManifest, validateRelativePath } from "../src/core/plugin-manifest.mjs";

const valid = {
  schemaVersion: 1,
  id: "example",
  name: "Example",
  target: { application: "aviutl2", pluginType: "auf2", architecture: "x64" },
  build: { artifacts: [{ path: "build/Release/example.auf2" }] }
};

test("valid manifest is accepted", () => {
  assert.equal(validatePluginManifest(valid).valid, true);
});

test("artifact path cannot leave repository", () => {
  assert.equal(validateRelativePath("../outside.dll"), false);
  assert.equal(validateRelativePath("build/plugin.auf2"), true);
});

test("compatibility remains honest when AviUtl2 is not configured", () => {
  assert.deepEqual(
    compatibilityState(valid, { aviutl2: { available: false } }),
    { status: "unknown", reason: "AVIUTL2_NOT_CONFIGURED" }
  );
});
