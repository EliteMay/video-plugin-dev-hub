import fs from "node:fs";
import path from "node:path";

export const PROJECTS_SCHEMA_VERSION = 1;

export function parseGitHubRepositoryUrl(value) {
  if (typeof value !== "string") return null;
  const text = value.trim().replace(/\.git$/i, "");
  const match = text.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)$/i);
  if (!match) return null;
  return {
    owner: match[1],
    repo: match[2],
    slug: match[1] + "/" + match[2],
    url: "https://github.com/" + match[1] + "/" + match[2]
  };
}

export function defaultProjectStore() {
  return { schemaVersion: PROJECTS_SCHEMA_VERSION, projects: [] };
}

export function loadProjects(filePath) {
  for (const candidate of [filePath, filePath + ".backup"]) {
    try {
      const parsed = JSON.parse(fs.readFileSync(candidate, "utf8"));
      if (!Array.isArray(parsed.projects)) continue;
      return { schemaVersion: PROJECTS_SCHEMA_VERSION, projects: parsed.projects };
    } catch {}
  }
  return defaultProjectStore();
}

export function saveProjects(filePath, store) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temp = filePath + ".tmp";
  const backup = filePath + ".backup";
  if (fs.existsSync(filePath)) fs.copyFileSync(filePath, backup);
  const normalized = {
    schemaVersion: PROJECTS_SCHEMA_VERSION,
    projects: Array.isArray(store.projects) ? store.projects : []
  };
  fs.writeFileSync(temp, JSON.stringify(normalized, null, 2), "utf8");
  fs.renameSync(temp, filePath);
  return normalized;
}

export function createProject({ name, repositoryUrl, localPath }) {
  const repo = parseGitHubRepositoryUrl(repositoryUrl);
  if (!repo) throw new Error("INVALID_GITHUB_REPOSITORY_URL");
  const displayName = String(name ?? "").trim() || repo.repo;
  if (!localPath || !path.isAbsolute(localPath)) throw new Error("INVALID_LOCAL_PATH");
  return {
    id: repo.slug.toLowerCase(),
    name: displayName,
    repositoryUrl: repo.url,
    repositorySlug: repo.slug,
    localPath: path.resolve(localPath),
    trusted: false,
    createdAt: new Date().toISOString()
  };
}
