import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHandoffPack } from "../src/core/handoff-pack.mjs";

test("handoff pack writes report instructions screenshot and log", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "vpdh-pack-"));
  const logPath = path.join(root, "hub.log");
  fs.writeFileSync(logPath, "one\ntwo\n", "utf8");
  const packRoot = path.join(root, "pack");

  createHandoffPack({
    packRoot,
    report: {
      project: { name: "Example", repositorySlug: "EliteMay/example" },
      repository: { commit: "abc", branch: "main" },
      currentTask: { text: "Verify" },
      verification: { tasks: [] }
    },
    screenshotBuffer: Buffer.from("image"),
    logPath
  });

  assert.equal(fs.existsSync(path.join(packRoot, "plugin-dev-hub-report.json")), true);
  assert.equal(fs.existsSync(path.join(packRoot, "CHATGPTに送る.txt")), true);
  assert.equal(fs.existsSync(path.join(packRoot, "hub-screenshot.png")), true);
  assert.equal(fs.existsSync(path.join(packRoot, "recent-log.txt")), true);
});
