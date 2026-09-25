import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { inspectRepository } from "./git.mjs";
import { parsePorcelain } from "./git-status.mjs";
import { validateRepositoryIdentity } from "./git-sync.mjs";

const execFileAsync = promisify(execFile);

async function runGit(args, timeout = 60000) {
  const result = await execFileAsync("git", args, {
    windowsHide: true,
    timeout,
    maxBuffer: 4 * 1024 * 1024
  });
  return String(result.stdout ?? "").trim();
}

async function getChanges(localPath) {
  try {
    return parsePorcelain(await runGit(["-C", localPath, "status", "--porcelain=v1"]));
  } catch {
    return [];
  }
}

async function hasIdentity(localPath) {
  try {
    const name = await runGit(["-C", localPath, "config", "--get", "user.name"]);
    const email = await runGit(["-C", localPath, "config", "--get", "user.email"]);
    return Boolean(name && email);
  } catch {
    return false;
  }
}

export async function previewSave(project) {
  const state = await inspectRepository(project.localPath);
  const identityError = validateRepositoryIdentity(project, state);
  if (identityError) return { ok: false, error: identityError, state };

  const changes = await getChanges(project.localPath);
  if (changes.length === 0) return { ok: false, error: "NOTHING_TO_SAVE", state };

  const sensitive = changes.filter(item => item.sensitive);
  return {
    ok: sensitive.length === 0,
    error: sensitive.length ? "SENSITIVE_FILES" : null,
    changes,
    sensitive,
    state
  };
}

export async function saveToGitHub(project, commitMessage) {
  const message = String(commitMessage ?? "").trim();
  if (!message) return { ok: false, error: "COMMIT_MESSAGE_REQUIRED" };

  const preview = await previewSave(project);
  if (!preview.ok) return preview;

  if (!(await hasIdentity(project.localPath))) {
    return { ok: false, error: "GIT_IDENTITY_MISSING", state: preview.state };
  }

  try {
    await runGit(["-C", project.localPath, "add", "-A"]);
    await runGit(["-C", project.localPath, "commit", "-m", message]);
  } catch (error) {
    return {
      ok: false,
      error: "COMMIT_FAILED",
      message: error?.stderr || error?.message || String(error)
    };
  }

  const branch = project.defaultBranch || preview.state.branch;

  try {
    await runGit(["-C", project.localPath, "fetch", "--prune", "origin"]);
    try {
      await runGit(["-C", project.localPath, "merge", "--no-edit", "origin/" + branch]);
    } catch (error) {
      try {
        await runGit(["-C", project.localPath, "merge", "--abort"]);
      } catch {}
      return {
        ok: false,
        error: "MERGE_CONFLICT",
        message: error?.stderr || error?.message || String(error),
        state: await inspectRepository(project.localPath)
      };
    }

    await runGit(["-C", project.localPath, "push", "origin", "HEAD:" + branch], 120000);
    return { ok: true, state: await inspectRepository(project.localPath) };
  } catch (error) {
    return {
      ok: false,
      error: "PUSH_FAILED",
      message: error?.stderr || error?.message || String(error),
      state: await inspectRepository(project.localPath)
    };
  }
}
