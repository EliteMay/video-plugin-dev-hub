import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createProject, loadProjects, parseGitHubRepositoryUrl, saveProjects } from "../src/core/projects.mjs";

test("accepts canonical GitHub repository URLs", () => {
  assert.deepEqual(parseGitHubRepositoryUrl("https://github.com/EliteMay/test.git"), {
    owner: "EliteMay",
    repo: "test",
    slug: "EliteMay/test",
    url: "https://github.com/EliteMay/test"
  });
});

test("rejects non-GitHub repository URLs", () => {
  assert.equal(parseGitHubRepositoryUrl("https://example.com/a/b"), null);
  assert.equal(parseGitHubRepositoryUrl("file:///tmp/repo"), null);
});

test("project IDs are stable by repository slug", () => {
  const project = createProject({
    name: "",
    repositoryUrl: "https://github.com/EliteMay/MyPlugin",
    localPath: path.resolve("C:/plugins/MyPlugin")
  });
  assert.equal(project.id, "elitemay/myplugin");
  assert.equal(project.name, "MyPlugin");
  assert.equal(project.trusted, false);
});

test("project store survives save/load", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vpdh-projects-"));
  const file = path.join(dir, "projects.json");
  const store = saveProjects(file, { projects: [{ id: "x", name: "X" }] });
  assert.equal(store.projects.length, 1);
  assert.equal(loadProjects(file).projects[0].id, "x");
});
