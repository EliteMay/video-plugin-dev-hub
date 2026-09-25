import test from "node:test";
import assert from "node:assert/strict";
import { parseCmakeVersion, sortVersionNames } from "../src/core/environment.mjs";

test("parse CMake version", () => {
  assert.equal(parseCmakeVersion("cmake version 4.1.2"), "4.1.2");
});

test("sort tool versions newest first", () => {
  assert.deepEqual(sortVersionNames(["1.2.0", "1.10.0", "1.3.0"]), ["1.10.0", "1.3.0", "1.2.0"]);
});
