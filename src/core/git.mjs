import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

async function git(args) {
  const result = await execFileAsync("git", args, {
    windowsHide: true,
    timeout: 15000,
    maxBuffer: 2 * 1024 * 1024
  });
  return String(result.stdout ?? "").trim();
}

export async function getGitVersion() {
  try {
    return await git(["--version"]);
  } catch {
    return null;
  }
}

export async function inspectRepository(localPath) {
  try {
    const topLevel = await git(["-C", localPath, "rev-parse", "--show-toplevel"]);
    const branch = await git(["-C", localPath, "branch", "--show-current"]);
    const origin = await git(["-C", localPath, "remote", "get-url", "origin"]).catch(() => "");
    const porcelain = await git(["-C", localPath, "status", "--porcelain"]);
    return {
      exists: true,
      validGitRepository: true,
      topLevel,
      branch,
      origin,
      clean: porcelain.length === 0,
      changedCount: porcelain ? porcelain.split(/\r?\n/).filter(Boolean).length : 0
    };
  } catch (error) {
    return {
      exists: false,
      validGitRepository: false,
      error: error?.message ?? String(error)
    };
  }
}
