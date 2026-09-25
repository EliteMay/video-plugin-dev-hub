import fs from "node:fs";
import path from "node:path";

const ALLOWED_RESULTS = new Set(["unverified", "passed", "failed", "blocked", "partial"]);

export function defaultVerificationStore() {
  return { schemaVersion: 1, tasks: {} };
}

export function loadVerification(filePath) {
  try {
    const value = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return value && typeof value.tasks === "object" ? value : defaultVerificationStore();
  } catch {
    return defaultVerificationStore();
  }
}

export function saveVerification(filePath, store) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temp = filePath + ".tmp";
  fs.writeFileSync(temp, JSON.stringify(store, null, 2), "utf8");
  fs.renameSync(temp, filePath);
  return store;
}

export function getTaskVerification(store, task) {
  const saved = store?.tasks?.[task.key] ?? null;
  if (!saved) {
    return {
      exists: false,
      stale: false,
      completedByRoadmap: task.completed === true,
      taskSignature: task.signature,
      stepResults: {},
      memo: "",
      screenshots: [],
      context: null
    };
  }

  return {
    ...saved,
    exists: true,
    completedByRoadmap: task.completed === true,
    stale: task.completed ? false : saved.taskSignature !== task.signature
  };
}

export function updateTaskVerification(store, task, patch, context) {
  const next = {
    schemaVersion: 1,
    tasks: { ...(store?.tasks ?? {}) }
  };

  const previous = next.tasks[task.key] ?? {};
  const stepResults = { ...(previous.stepResults ?? {}) };
  if (patch?.stepResults && typeof patch.stepResults === "object") {
    for (const [key, value] of Object.entries(patch.stepResults)) {
      if (ALLOWED_RESULTS.has(value)) stepResults[key] = value;
    }
  }

  const screenshots = Array.isArray(previous.screenshots) ? [...previous.screenshots] : [];
  if (Array.isArray(patch?.screenshots)) {
    for (const item of patch.screenshots) {
      if (typeof item === "string" && item && !screenshots.includes(item)) screenshots.push(item);
    }
  }

  next.tasks[task.key] = {
    taskKey: task.key,
    taskText: task.text,
    taskSignature: task.signature,
    owner: task.owner ?? null,
    stepResults,
    memo: typeof patch?.memo === "string" ? patch.memo : (previous.memo ?? ""),
    screenshots,
    context: context ?? previous.context ?? null,
    updatedAt: new Date().toISOString()
  };
  return next;
}
