import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createLogger } from "../src/core/logger.mjs";

test("logger exposes bounded recent rows and clear", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vpdh-log-"));
  const file = path.join(dir, "hub.log");
  const logger = createLogger(file);

  logger.write("info", "first");
  logger.write("warn", "second", { code: "TEST" });

  const recent = logger.readRecent(1);
  assert.equal(recent.length, 1);
  assert.equal(recent[0].message, "second");
  assert.equal(recent[0].detail.code, "TEST");
  assert.ok(logger.size() > 0);

  logger.clear();
  assert.equal(logger.size(), 0);
  assert.deepEqual(logger.readRecent(), []);
});
