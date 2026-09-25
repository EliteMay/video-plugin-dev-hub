import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { parseCompilerDiagnostics, resolveProjectPath, selectArtifact } from "../src/core/build.mjs";

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

test("MSVC diagnostics are parsed", () => {
  const rows = parseCompilerDiagnostics("src/main.cpp(42,7): error C2664: cannot convert argument");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].severity, "error");
  assert.equal(rows[0].line, 42);
  assert.equal(rows[0].code, "C2664");
});
