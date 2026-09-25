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

function digest(value, length = 16) {
  return crypto.createHash("sha256").update(value).digest("hex").slice(0, length);
}

function taskKey(source, line, text) {
  return digest(source + ":" + line + ":" + text);
}

function taskSignature(task) {
  return digest(JSON.stringify({
    text: task.text,
    owner: task.owner ?? null,
    steps: task.steps ?? [],
    completion: task.completion ?? null
  }), 24);
}

export function parseRoadmapText(text, source = "ROADMAP.md") {
  const lines = String(text ?? "").split(/\r?\n/);
  const hasCheckbox = lines.some(line => /^\s*[-*]\s+\[[ xX]\]\s+/.test(line));
  const tasks = [];

  if (hasCheckbox) {
    let current = null;

    lines.forEach((line, index) => {
      const match = line.match(/^(\s*)[-*]\s+\[([ xX])\]\s+(.+?)\s*$/);
      if (match) {
        const textValue = match[3].trim();
        current = {
          key: taskKey(source, index + 1, textValue),
          text: textValue,
          completed: match[2].toLowerCase() === "x",
          line: index + 1,
          indent: match[1].length,
          owner: null,
          steps: [],
          completion: null
        };
        tasks.push(current);
        return;
      }

      if (!current) return;
      const bullet = line.match(/^(\s+)[-*]\s+(.+?)\s*$/);
      if (!bullet || bullet[1].length <= current.indent) return;

      const value = bullet[2].trim();
      const ownerMatch = value.match(/^担当\s*[:：]\s*(.+)$/);
      if (ownerMatch) {
        current.owner = ownerMatch[1].trim();
        return;
      }

      const completionMatch = value.match(/^完了条件\s*[:：]\s*(.+)$/);
      if (completionMatch) {
        current.completion = completionMatch[1].trim();
        return;
      }

      current.steps.push(value);
    });

    for (const task of tasks) {
      task.signature = taskSignature(task);
      delete task.indent;
    }
  } else {
    lines.forEach((line, index) => {
      const match = line.match(/^\s*[-*]\s+(.+?)\s*$/);
      if (!match) return;
      const textValue = match[1].trim();
      const task = {
        key: taskKey(source, index + 1, textValue),
        text: textValue,
        completed: false,
        line: index + 1,
        owner: null,
        steps: [],
        completion: null
      };
      task.signature = taskSignature(task);
      tasks.push(task);
    });
  }

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
