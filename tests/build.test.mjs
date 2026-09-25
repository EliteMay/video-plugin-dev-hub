import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { resolveProjectPath, selectArtifact } from "../src/core/build.mjs";

test("build paths stay inside repository", () => {
  const root = path.resolve("C:/repo");
  assert.equal(resolveProjectPath(root, "build"), path.resolve(root, "build"));
  assert.throws(() => resolveProjectPath(root, "../outside"));
});

test("artifact is selected by configuration", () => {
  const manifest = {
    build: {
      artifacts: [
        { configuration: "Debug", path: "build/Debug/a.auf2" },
        { configuration: "Release", path: "build/Release/a.auf2" }
      ]
    }
  };
  assert.equal(selectArtifact(manifest, "Release").path, "build/Release/a.auf2");
});
