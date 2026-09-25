import fs from "node:fs";
import path from "node:path";
import { createHandoffInstructions, redactText, sanitizeValue } from "./handoff.mjs";

export function createHandoffPack({
  packRoot,
  report,
  screenshotBuffer = null,
  evidenceScreenshots = [],
  logPath = null
}) {
  const sanitized = sanitizeValue(report);
  const screenshotsRoot = path.join(packRoot, "screenshots");
  fs.mkdirSync(screenshotsRoot, { recursive: true });

  fs.writeFileSync(
    path.join(packRoot, "plugin-dev-hub-report.json"),
    JSON.stringify(sanitized, null, 2),
    "utf8"
  );
  fs.writeFileSync(
    path.join(packRoot, "CHATGPTに送る.txt"),
    createHandoffInstructions(sanitized),
    "utf8"
  );

  if (screenshotBuffer) {
    fs.writeFileSync(path.join(packRoot, "hub-screenshot.png"), screenshotBuffer);
  }

  evidenceScreenshots.forEach((item, index) => {
    if (!item?.path || !fs.existsSync(item.path)) return;
    const extension = path.extname(item.path).toLowerCase();
    const safeTask = String(item.taskKey ?? "task").replace(/[^a-z0-9._-]+/gi, "_");
    const name = safeTask + "-" + String(index + 1).padStart(2, "0") + extension;
    fs.copyFileSync(item.path, path.join(screenshotsRoot, name));
  });

  let recentLog = "Logはありません。\n";
  if (logPath && fs.existsSync(logPath)) {
    const text = fs.readFileSync(logPath, "utf8");
    recentLog = redactText(text.split(/\r?\n/).filter(Boolean).slice(-200).join("\n"));
  }
  fs.writeFileSync(path.join(packRoot, "recent-log.txt"), recentLog, "utf8");

  return {
    packRoot,
    reportPath: path.join(packRoot, "plugin-dev-hub-report.json")
  };
}
