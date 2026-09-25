import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { appendBuildHistory, loadBuildHistory } from "../src/core/build-history.mjs";

test("build history stores newest first", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vpdh-build-"));
  const file = path.join(dir, "history.json");
  appendBuildHistory(file, { id: "one" });
  appendBuildHistory(file, { id: "two" });
  assert.deepEqual(loadBuildHistory(file).map(x => x.id), ["two", "one"]);
});
