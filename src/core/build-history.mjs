import fs from "node:fs";
import path from "node:path";

const MAX_ENTRIES = 40;

export function loadBuildHistory(filePath) {
  try {
    const value = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function appendBuildHistory(filePath, entry) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const current = loadBuildHistory(filePath);
  const next = [entry, ...current].slice(0, MAX_ENTRIES);
  const temp = filePath + ".tmp";
  fs.writeFileSync(temp, JSON.stringify(next, null, 2), "utf8");
  fs.renameSync(temp, filePath);
  return next;
}
