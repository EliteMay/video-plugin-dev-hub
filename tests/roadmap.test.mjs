import test from "node:test";
import assert from "node:assert/strict";
import { parseRoadmapText } from "../src/core/roadmap.mjs";

test("checkbox roadmaps ignore ordinary explanatory bullets", () => {
  const result = parseRoadmapText(`
# Phase
- 説明だけ
- [x] 完了
- [ ] 次にやる
  - 補足説明
`);
  assert.equal(result.mode, "checkbox");
  assert.equal(result.tasks.length, 2);
  assert.equal(result.completedCount, 1);
  assert.equal(result.remainingCount, 1);
  assert.equal(result.tasks[1].text, "次にやる");
});

test("plain bullet roadmaps remain supported as fallback", () => {
  const result = parseRoadmapText("- one\n- two\n");
  assert.equal(result.mode, "bullet");
  assert.equal(result.tasks.length, 2);
  assert.equal(result.remainingCount, 2);
});
