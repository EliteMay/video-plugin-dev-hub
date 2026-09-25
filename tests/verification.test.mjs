import test from "node:test";
import assert from "node:assert/strict";
import { defaultVerificationStore, getTaskVerification, updateTaskVerification } from "../src/core/verification.mjs";

const task = {
  key: "task-1",
  text: "AviUtl2で確認",
  signature: "sig-1",
  completed: false,
  owner: "あなた"
};

test("verification becomes stale when an unfinished task changes", () => {
  let store = updateTaskVerification(defaultVerificationStore(), task, {
    stepResults: { "0": "passed" },
    memo: "ok"
  }, { commit: "abc" });

  const changed = { ...task, signature: "sig-2" };
  assert.equal(getTaskVerification(store, changed).stale, true);
});

test("completed roadmap task does not become stale from later description changes", () => {
  let store = updateTaskVerification(defaultVerificationStore(), task, {
    stepResults: { "0": "passed" }
  }, null);

  const completed = { ...task, completed: true, signature: "sig-later" };
  assert.equal(getTaskVerification(store, completed).stale, false);
  assert.equal(getTaskVerification(store, completed).completedByRoadmap, true);
});
