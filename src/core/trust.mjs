import fs from "node:fs";
import path from "node:path";

export const TRUST_SCHEMA_VERSION = 1;

export function defaultTrustStore() {
  return { schemaVersion: TRUST_SCHEMA_VERSION, repositories: {} };
}

export function loadTrust(filePath) {
  for (const candidate of [filePath, filePath + ".backup"]) {
    try {
      const parsed = JSON.parse(fs.readFileSync(candidate, "utf8"));
      if (!parsed || typeof parsed.repositories !== "object") continue;
      return { schemaVersion: TRUST_SCHEMA_VERSION, repositories: parsed.repositories };
    } catch {}
  }
  return defaultTrustStore();
}

export function saveTrust(filePath, store) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temp = filePath + ".tmp";
  const backup = filePath + ".backup";
  if (fs.existsSync(filePath)) fs.copyFileSync(filePath, backup);
  const normalized = {
    schemaVersion: TRUST_SCHEMA_VERSION,
    repositories: store?.repositories && typeof store.repositories === "object"
      ? store.repositories
      : {}
  };
  fs.writeFileSync(temp, JSON.stringify(normalized, null, 2), "utf8");
  fs.renameSync(temp, filePath);
  return normalized;
}

export function isRepositoryTrusted(store, repositorySlug) {
  return store?.repositories?.[String(repositorySlug ?? "").toLowerCase()]?.trusted === true;
}

export function setRepositoryTrust(store, repositorySlug, trusted) {
  const key = String(repositorySlug ?? "").toLowerCase();
  if (!key) throw new Error("INVALID_REPOSITORY_SLUG");
  const next = {
    schemaVersion: TRUST_SCHEMA_VERSION,
    repositories: { ...(store?.repositories ?? {}) }
  };
  if (trusted) {
    next.repositories[key] = {
      trusted: true,
      trustedAt: new Date().toISOString()
    };
  } else {
    delete next.repositories[key];
  }
  return next;
}
