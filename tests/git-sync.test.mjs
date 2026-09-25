import test from "node:test";
import assert from "node:assert/strict";
import { validateRepositoryIdentity } from "../src/core/git-sync.mjs";

const project = {
  repositoryUrl: "https://github.com/EliteMay/example",
  defaultBranch: "main"
};

test("repository identity accepts matching HTTPS origin and branch", () => {
  assert.equal(validateRepositoryIdentity(project, {
    validGitRepository: true,
    origin: "https://github.com/EliteMay/example.git",
    branch: "main"
  }), null);
});

test("repository identity accepts equivalent GitHub SSH origin", () => {
  assert.equal(validateRepositoryIdentity(project, {
    validGitRepository: true,
    origin: "git@github.com:EliteMay/example.git",
    branch: "main"
  }), null);
});

test("repository identity rejects wrong origin or branch", () => {
  assert.equal(validateRepositoryIdentity(project, {
    validGitRepository: true,
    origin: "https://github.com/Other/example",
    branch: "main"
  }), "ORIGIN_MISMATCH");

  assert.equal(validateRepositoryIdentity(project, {
    validGitRepository: true,
    origin: "https://github.com/EliteMay/example",
    branch: "dev"
  }), "BRANCH_MISMATCH");
});
