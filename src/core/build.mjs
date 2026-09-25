import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { validateRelativePath } from "./plugin-manifest.mjs";

const execFileAsync = promisify(execFile);

function insideRoot(root, candidate) {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative === "" || (!relative.startsWith(".." + path.sep) && relative !== ".." && !path.isAbsolute(relative));
}

export function resolveProjectPath(repositoryPath, relativePath) {
  if (!validateRelativePath(relativePath)) throw new Error("INVALID_RELATIVE_PATH");
  const resolved = path.resolve(repositoryPath, relativePath);
  if (!insideRoot(repositoryPath, resolved)) throw new Error("PATH_OUTSIDE_REPOSITORY");
  return resolved;
}

export function parseCompilerDiagnostics(text) {
  const rows = [];
  for (const line of String(text ?? "").split(/\r?\n/)) {
    let match = line.match(/^(.+?)\((\d+)(?:,(\d+))?\):\s*(warning|error)\s+([^:]+):\s*(.+)$/i);
    if (match) {
      rows.push({
        file: match[1].trim(),
        line: Number(match[2]),
        column: match[3] ? Number(match[3]) : null,
        severity: match[4].toLowerCase(),
        code: match[5].trim(),
        message: match[6].trim()
      });
      continue;
    }

    match = line.match(/^(.+?):(\d+):(\d+):\s*(warning|error):\s*(.+)$/i);
    if (match) {
      rows.push({
        file: match[1].trim(),
        line: Number(match[2]),
        column: Number(match[3]),
        severity: match[4].toLowerCase(),
        code: null,
        message: match[5].trim()
      });
    }
  }
  return rows.slice(0, 200);
}

export function selectArtifact(manifest, configuration) {
  const artifacts = Array.isArray(manifest?.build?.artifacts) ? manifest.build.artifacts : [];
  return artifacts.find(item => item.configuration === configuration) ?? null;
}

function sha256(filePath) {
  const hash = crypto.createHash("sha256");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex");
}

async function run(file, args, cwd, timeout = 180000) {
  const result = await execFileAsync(file, args, {
    cwd,
    windowsHide: true,
    timeout,
    maxBuffer: 16 * 1024 * 1024
  });
  return {
    stdout: String(result.stdout ?? ""),
    stderr: String(result.stderr ?? "")
  };
}

export async function buildCmakeProject({
  project,
  manifest,
  configuration,
  trusted,
  environment,
  commit
}) {
  if (!trusted) return { ok: false, error: "REPOSITORY_NOT_TRUSTED" };
  if (!manifest || manifest.build?.system !== "cmake") {
    return { ok: false, error: "UNSUPPORTED_BUILD_SYSTEM" };
  }
  if (!environment?.cmake?.available) return { ok: false, error: "CMAKE_NOT_AVAILABLE" };

  const allowedConfigurations = Array.isArray(manifest.build.configurations)
    ? manifest.build.configurations
    : ["Debug", "Release"];
  if (!allowedConfigurations.includes(configuration)) {
    return { ok: false, error: "INVALID_CONFIGURATION" };
  }

  let sourceDirectory;
  let buildDirectory;
  try {
    sourceDirectory = resolveProjectPath(project.localPath, manifest.build.sourceDirectory || ".");
    buildDirectory = resolveProjectPath(project.localPath, manifest.build.buildDirectory || "build");
  } catch (error) {
    return { ok: false, error: error.message };
  }

  const configureArgs = ["-S", sourceDirectory, "-B", buildDirectory];
  if (manifest.target?.architecture === "x64" && process.platform === "win32") {
    configureArgs.push("-A", "x64");
  }

  const startedAt = new Date();
  const logs = [];
  try {
    const configured = await run("cmake", configureArgs, project.localPath);
    logs.push(configured.stdout, configured.stderr);
    const built = await run(
      "cmake",
      ["--build", buildDirectory, "--config", configuration, "--parallel"],
      project.localPath
    );
    logs.push(built.stdout, built.stderr);
  } catch (error) {
    logs.push(String(error?.stdout ?? ""), String(error?.stderr ?? ""), String(error?.message ?? ""));
    const combinedLogs = logs.filter(Boolean).join("\n").slice(-200000);
    return {
      ok: false,
      error: "BUILD_FAILED",
      diagnostics: parseCompilerDiagnostics(combinedLogs),
      logs: combinedLogs
    };
  }

  const artifactSpec = selectArtifact(manifest, configuration);
  let artifact = null;
  if (artifactSpec?.path) {
    try {
      const artifactPath = resolveProjectPath(project.localPath, artifactSpec.path);
      if (fs.existsSync(artifactPath) && fs.statSync(artifactPath).isFile()) {
        artifact = {
          path: artifactPath,
          relativePath: artifactSpec.path,
          size: fs.statSync(artifactPath).size,
          sha256: sha256(artifactPath)
        };
      }
    } catch {}
  }

  const endedAt = new Date();
  const stamp = startedAt.toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  const shortCommit = String(commit ?? "unknown").slice(0, 8);
  const combinedLogs = logs.filter(Boolean).join("\n").slice(-200000);
  return {
    ok: true,
    build: {
      id: stamp + "-" + shortCommit + "-" + configuration.toLowerCase(),
      configuration,
      startedAt: startedAt.toISOString(),
      endedAt: endedAt.toISOString(),
      durationMs: endedAt.getTime() - startedAt.getTime(),
      commit: commit ?? null,
      artifact
    },
    diagnostics: parseCompilerDiagnostics(combinedLogs),
    logs: combinedLogs
  };
}
