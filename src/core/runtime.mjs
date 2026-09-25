import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

export function classifyRuntime(durationMs, exitCode, signal) {
  return {
    durationMs,
    exitCode: Number.isInteger(exitCode) ? exitCode : null,
    signal: signal ?? null,
    shortRun: durationMs < 10000,
    cleanExit: exitCode === 0
  };
}

export function launchAviUtl2(environment, onExit) {
  if (!environment?.executablePath || !fs.existsSync(environment.executablePath)) {
    return { ok: false, error: "TEST_AVIUTL2_NOT_FOUND" };
  }

  try {
    const startedAt = Date.now();
    const child = spawn(environment.executablePath, [], {
      cwd: environment.appPath || path.dirname(environment.executablePath),
      windowsHide: false,
      stdio: "ignore"
    });

    child.once("exit", (code, signal) => {
      const result = classifyRuntime(Date.now() - startedAt, code, signal);
      onExit?.(result);
    });

    child.once("error", error => {
      onExit?.({
        durationMs: Date.now() - startedAt,
        exitCode: null,
        signal: null,
        shortRun: true,
        cleanExit: false,
        error: error?.message ?? String(error)
      });
    });

    return {
      ok: true,
      child,
      pid: child.pid,
      startedAt: new Date(startedAt).toISOString()
    };
  } catch (error) {
    return { ok: false, error: "AVIUTL2_LAUNCH_FAILED", message: error?.message ?? String(error) };
  }
}
