import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import { redactText, sanitizeValue } from "../src/core/handoff.mjs";

test("home path is redacted", () => {
  const value = redactText(os.homedir() + "/project/file.txt");
  assert.equal(value.includes(os.homedir()), false);
  assert.equal(value.includes("<HOME>"), true);
});

test("secret-like object keys are redacted", () => {
  const value = sanitizeValue({ token: "abc", nested: { password: "def", ok: "value" } });
  assert.equal(value.token, "<REDACTED>");
  assert.equal(value.nested.password, "<REDACTED>");
  assert.equal(value.nested.ok, "value");
});
