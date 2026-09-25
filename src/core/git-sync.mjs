import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { inspectRepository } from "./git.mjs";

const execFileAsync = promisify(execFile);

async function runGit(args, timeout = 60000) {
  const result = await execFileAsync("git", args, {
    windowsHide: true,
    timeout,
    maxBuffer: 4 * 1024 * 1024
  });
  return String(result.stdout ?? "").trim();
}

function normalizeRemote(value) {
  return String(value ?? "")
    .trim()
    .replace(/\.git$/i, "")
    .replace(/^git@github\.com:/i, "https://github.com/")
    .toLowerCase();
}

export function validateRepositoryIdentity(project, state) {
  if (!state?.validGitRepository) return "NOT_GIT_REPOSITORY";
  if (normalizeRemote(state.origin) !== normalizeRemote(project.repositoryUrl)) return "ORIGIN_MISMATCH";
  if (project.defaultBranch && state.branch !== project.defaultBranch) return "BRANCH_MISMATCH";
  return null;
}

export async function safeSync(project) {
  const before = await inspectRepository(project.localPath);
  const identityError = validateRepositoryIdentity(project, before);
  if (identityError) return { ok: false, error: identityError, state: before };
  if (!before.clean) return { ok: false, error: "WORKTREE_DIRTY", state: before };

  try {
    await runGit(["-C", project.localPath, "fetch", "--prune", "origin"]);
    await runGit([
      "-C",
      project.localPath,
      "pull",
      "--ff-only",
      "origin",
      project.defaultBranch || before.branch
    ]);
    return { ok: true, state: await inspectRepository(project.localPath) };
  } catch (error) {
    return {
      ok: false,
      error: "SYNC_FAILED",
      message: error?.stderr || error?.message || String(error),
      state: await inspectRepository(project.localPath)
    };
  }
}

export async function cloneRepository(repositoryUrl, destinationPath) {
  const url = String(repositoryUrl ?? "").trim();
  if (!/^https:\/\/github\.com\/[^/]+\/[^/]+(?:\.git)?$/i.test(url)) {
    return { ok: false, error: "INVALID_GITHUB_REPOSITORY_URL" };
  }
  if (!destinationPath || !path.isAbsolute(destinationPath)) {
    return { ok: false, error: "INVALID_DESTINATION" };
  }

  if (fs.existsSync(destinationPath)) {
    if (fs.readdirSync(destinationPath).length > 0) {
      return { ok: false, error: "DESTINATION_NOT_EMPTY" };
    }
  } else {
    fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
  }

  try {
    await runGit(["clone", "--", url, destinationPath], 120000);
    return { ok: true, state: await inspectRepository(destinationPath) };
  } catch (error) {
    return {
      ok: false,
      error: "CLONE_FAILED",
      message: error?.stderr || error?.message || String(error)
    };
  }
}
