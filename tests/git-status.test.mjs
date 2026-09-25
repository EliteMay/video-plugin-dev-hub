import test from "node:test";
import assert from "node:assert/strict";
import { describeStatusCode, looksSensitivePath, parsePorcelain } from "../src/core/git-status.mjs";

test("Git status codes are translated for the UI", () => {
  assert.equal(describeStatusCode(" M"), "内容が変更");
  assert.equal(describeStatusCode("??"), "新しく作成");
  assert.equal(describeStatusCode(" D"), "削除");
});

test("sensitive-looking files are blocked before staging", () => {
  assert.equal(looksSensitivePath(".env"), true);
  assert.equal(looksSensitivePath("config/private.pem"), true);
  assert.equal(looksSensitivePath("src/main.cpp"), false);
});

test("porcelain output becomes file records", () => {
  const rows = parsePorcelain(" M src/main.cpp\n?? .env\n");
  assert.equal(rows.length, 2);
  assert.equal(rows[0].label, "内容が変更");
  assert.equal(rows[1].sensitive, true);
});
