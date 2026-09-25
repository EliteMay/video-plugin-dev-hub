import fs from "node:fs";
import path from "node:path";

const MAX_BYTES = 512 * 1024;

export function createLogger(logFile) {
  fs.mkdirSync(path.dirname(logFile), { recursive: true });

  function trim() {
    try {
      const stat = fs.statSync(logFile);
      if (stat.size <= MAX_BYTES) return;
      const data = fs.readFileSync(logFile, "utf8");
      fs.writeFileSync(logFile, data.slice(-Math.floor(MAX_BYTES * 0.75)), "utf8");
    } catch {}
  }

  return {
    write(level, message, detail = null) {
      const row = JSON.stringify({ at: new Date().toISOString(), level, message, detail });
      fs.appendFileSync(logFile, row + "\n", "utf8");
      trim();
    },
    path: logFile
  };
}
