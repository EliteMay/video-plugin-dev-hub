import test from "node:test";
import assert from "node:assert/strict";
import { classifyRuntime } from "../src/core/runtime.mjs";

test("short runs are evidence, not crash conclusions", () => {
  const result = classifyRuntime(3500, 1, null);
  assert.equal(result.shortRun, true);
  assert.equal(result.cleanExit, false);
  assert.equal(result.exitCode, 1);
});

test("normal exit is recorded", () => {
  const result = classifyRuntime(25000, 0, null);
  assert.equal(result.shortRun, false);
  assert.equal(result.cleanExit, true);
});
