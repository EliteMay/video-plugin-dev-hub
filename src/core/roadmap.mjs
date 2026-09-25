import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const CANDIDATES = [
  "docs/ROADMAP.md",
  "ROADMAP.md",
  "docs/TODO.md",
  "TODO.md"
];

export function findRoadmapFile(repositoryPath) {
  for (const relativePath of CANDIDATES) {
    const fullPath = path.join(repositoryPath, relativePath);
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      return { relativePath, fullPath };
    }
  }
  return null;
}

function taskKey(source, line, text) {
  return crypto
    .createHash("sha256")
    .update(source + ":" + line + ":" + text)
    .digest("hex")
    .slice(0, 16);
}

export function parseRoadmapText(text, source = "ROADMAP.md") {
  const lines = String(text ?? "").split(/\r?\n/);
  const hasCheckbox = lines.some(line => /^\s*[-*]\s+\[[ xX]\]\s+/.test(line));
  const tasks = [];

  lines.forEach((line, index) => {
    let match;
    if (hasCheckbox) {
      match = line.match(/^\s*[-*]\s+\[([ xX])\]\s+(.+?)\s*$/);
      if (!match) return;
      const completed = match[1].toLowerCase() === "x";
      const textValue = match[2].trim();
      tasks.push({
        key: taskKey(source, index + 1, textValue),
        text: textValue,
        completed,
        line: index + 1
      });
      return;
    }

    match = line.match(/^\s*[-*]\s+(.+?)\s*$/);
    if (!match) return;
    const textValue = match[1].trim();
    tasks.push({
      key: taskKey(source, index + 1, textValue),
      text: textValue,
      completed: false,
      line: index + 1
    });
  });

  return {
    source,
    mode: hasCheckbox ? "checkbox" : "bullet",
    tasks,
    completedCount: tasks.filter(task => task.completed).length,
    remainingCount: tasks.filter(task => !task.completed).length
  };
}

export function readRoadmap(repositoryPath) {
  const found = findRoadmapFile(repositoryPath);
  if (!found) return { found: false, tasks: [], completedCount: 0, remainingCount: 0 };
  const text = fs.readFileSync(found.fullPath, "utf8");
  return { found: true, ...parseRoadmapText(text, found.relativePath) };
}
