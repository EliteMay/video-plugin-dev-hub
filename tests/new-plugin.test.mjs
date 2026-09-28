import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  buildPluginManifest,
  createPluginProject,
  getGitHubCliState,
  normalizePluginId,
  validateRepositoryName
} from "../src/core/new-plugin.mjs";

test("validates repository names and normalizes plugin IDs", () => {
  assert.equal(validateRepositoryName("valo-kill-impact"), true);
  assert.equal(validateRepositoryName("bad name"), false);
  assert.equal(validateRepositoryName("../bad"), false);
  assert.equal(normalizePluginId("VALO Kill Impact"), "valo-kill-impact");
});

test("builds native and script manifests with the correct AviUtl2 types", () => {
  const filter = buildPluginManifest({
    name: "Filter",
    repositoryName: "filter-plugin",
    presetKey: "native-filter"
  });
  assert.equal(filter.target.pluginType, "auf2");
  assert.equal(filter.build.system, "cmake");
  assert.equal(filter.build.artifacts[1].path, "build/Release/filter-plugin.auf2");

  const script = buildPluginManifest({
    name: "Animation",
    repositoryName: "animation-script",
    presetKey: "script-animation"
  });
  assert.equal(script.target.pluginType, "anm2");
  assert.equal(script.build.system, "none");
});

test("GitHub CLI state distinguishes missing and authenticated states", async () => {
  const missing = await getGitHubCliState(async () => ({ ok: false, stdout: "" }));
  assert.equal(missing.available, false);

  const authenticated = await getGitHubCliState(async (_file, args) => {
    if (args[0] === "--version") return { ok: true, stdout: "gh version 2.80.0" };
    if (args[0] === "auth") return { ok: true, stdout: "ok" };
    if (args[0] === "api") return { ok: true, stdout: "EliteMay" };
    return { ok: false, stdout: "" };
  });
  assert.equal(authenticated.available, true);
  assert.equal(authenticated.authenticated, true);
  assert.equal(authenticated.login, "EliteMay");
});

test("new plugin creation generates metadata, pushes, and keeps plugin-owned files", async () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "vpdh-new-plugin-"));
  const calls = [];

  async function runner(file, args, cwd) {
    calls.push({ file, args: [...args], cwd });

    if (file === "gh" && args[0] === "--version") {
      return { ok: true, stdout: "gh version 2.80.0", stderr: "" };
    }
    if (file === "gh" && args[0] === "auth") {
      return { ok: true, stdout: "authenticated", stderr: "" };
    }
    if (file === "gh" && args[0] === "api") {
      return { ok: true, stdout: "EliteMay", stderr: "" };
    }
    if (file === "gh" && args[0] === "repo" && args[1] === "view") {
      return { ok: false, stdout: "", stderr: "not found" };
    }
    if (file === "git" && args[0] === "clone") {
      const target = args.at(-1);
      fs.mkdirSync(path.join(target, ".git"), { recursive: true });
      fs.mkdirSync(path.join(target, "templates", "native-filter"), { recursive: true });
      fs.mkdirSync(path.join(target, "docs"), { recursive: true });
      fs.writeFileSync(path.join(target, "foundation-template.json"), JSON.stringify({
        schemaVersion: 1,
        foundationVersion: "0.1.0"
      }), "utf8");
      fs.writeFileSync(path.join(target, "plugin-project.example.json"), "{}", "utf8");
      fs.writeFileSync(path.join(target, "README.md"), "# Foundation", "utf8");
      fs.writeFileSync(path.join(target, "PROJECT_RULES.md"), "# Foundation Rules", "utf8");
      return { ok: true, stdout: "", stderr: "" };
    }
    if (file === "git" && args[0] === "rev-parse") {
      return { ok: true, stdout: "0123456789abcdef0123456789abcdef01234567", stderr: "" };
    }
    if (file === "git" && args[0] === "config" && args.includes("user.name")) {
      return { ok: true, stdout: "Test User", stderr: "" };
    }
    if (file === "git" && args[0] === "config" && args.includes("user.email")) {
      return { ok: true, stdout: "test@example.com", stderr: "" };
    }
    if (file === "git") return { ok: true, stdout: "", stderr: "" };
    if (file === "gh" && args[0] === "repo" && args[1] === "create") {
      return { ok: true, stdout: "created", stderr: "" };
    }
    return { ok: false, stdout: "", stderr: "unexpected command" };
  }

  const result = await createPluginProject({
    name: "VALO Kill Impact",
    repositoryName: "valo-kill-impact",
    presetKey: "native-filter",
    visibility: "private",
    parentDirectory: parent
  }, runner);

  assert.equal(result.ok, true);
  assert.equal(result.repositoryUrl, "https://github.com/EliteMay/valo-kill-impact");
  assert.equal(fs.existsSync(path.join(result.localPath, "plugin-project.json")), true);
  assert.equal(fs.existsSync(path.join(result.localPath, "foundation-lock.json")), true);
  assert.equal(fs.existsSync(path.join(result.localPath, "docs", "ROADMAP.md")), true);
  assert.equal(fs.existsSync(path.join(result.localPath, "templates")), false);
  assert.equal(fs.existsSync(path.join(result.localPath, "plugin-project.example.json")), false);

  const manifest = JSON.parse(fs.readFileSync(path.join(result.localPath, "plugin-project.json"), "utf8"));
  assert.equal(manifest.target.pluginType, "auf2");
  assert.equal(manifest.name, "VALO Kill Impact");

  const createCall = calls.find(call => call.file === "gh" && call.args[0] === "repo" && call.args[1] === "create");
  assert.ok(createCall);
  assert.ok(createCall.args.includes("--private"));
  assert.ok(createCall.args.includes("--push"));
});
