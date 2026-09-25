import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

async function run(file, args = []) {
  const result = await execFileAsync(file, args, {
    windowsHide: true,
    timeout: 12000,
    maxBuffer: 2 * 1024 * 1024
  });
  return String(result.stdout ?? "").trim();
}

export function parseCmakeVersion(text) {
  const match = String(text ?? "").match(/cmake version\s+([^\s]+)/i);
  return match ? match[1] : null;
}

export function sortVersionNames(values) {
  return [...values].sort((a, b) => {
    const aa = a.split(".").map(Number);
    const bb = b.split(".").map(Number);
    const length = Math.max(aa.length, bb.length);
    for (let i = 0; i < length; i += 1) {
      const diff = (bb[i] ?? 0) - (aa[i] ?? 0);
      if (diff) return diff;
    }
    return 0;
  });
}

export async function detectCmake() {
  try {
    const output = await run("cmake", ["--version"]);
    return { available: true, version: parseCmakeVersion(output), path: "PATH" };
  } catch {
    return { available: false, version: null, path: null };
  }
}

function vswhereCandidates() {
  const roots = [
    process.env["ProgramFiles(x86)"],
    process.env.ProgramFiles
  ].filter(Boolean);
  return roots.map(root => path.join(root, "Microsoft Visual Studio", "Installer", "vswhere.exe"));
}

export async function detectVisualCpp() {
  if (process.platform !== "win32") {
    return { available: false, reason: "WINDOWS_ONLY" };
  }

  const vswhere = vswhereCandidates().find(candidate => fs.existsSync(candidate));
  if (!vswhere) return { available: false, reason: "VSWHERE_NOT_FOUND" };

  try {
    const installationPath = await run(vswhere, [
      "-latest",
      "-products", "*",
      "-requires", "Microsoft.VisualStudio.Component.VC.Tools.x86.x64",
      "-property", "installationPath"
    ]);
    if (!installationPath) return { available: false, reason: "VC_TOOLS_NOT_FOUND" };

    const toolsRoot = path.join(installationPath, "VC", "Tools", "MSVC");
    if (!fs.existsSync(toolsRoot)) return { available: false, reason: "MSVC_DIRECTORY_NOT_FOUND" };

    const versions = sortVersionNames(
      fs.readdirSync(toolsRoot).filter(name => fs.statSync(path.join(toolsRoot, name)).isDirectory())
    );
    for (const version of versions) {
      const compilerPath = path.join(toolsRoot, version, "bin", "Hostx64", "x64", "cl.exe");
      if (fs.existsSync(compilerPath)) {
        return { available: true, version, installationPath, compilerPath };
      }
    }
    return { available: false, reason: "CL_NOT_FOUND", installationPath };
  } catch (error) {
    return { available: false, reason: "VS_DETECTION_FAILED", message: error?.message ?? String(error) };
  }
}

export function detectWindowsSdk() {
  if (process.platform !== "win32") {
    return { available: false, reason: "WINDOWS_ONLY" };
  }
  const programFilesX86 = process.env["ProgramFiles(x86)"];
  if (!programFilesX86) return { available: false, reason: "PROGRAM_FILES_X86_NOT_FOUND" };

  const root = path.join(programFilesX86, "Windows Kits", "10");
  const binRoot = path.join(root, "bin");
  if (!fs.existsSync(binRoot)) return { available: false, reason: "WINDOWS_SDK_NOT_FOUND" };

  const versions = sortVersionNames(
    fs.readdirSync(binRoot)
      .filter(name => /^\d+\.\d+\.\d+\.\d+$/.test(name))
      .filter(name => fs.existsSync(path.join(binRoot, name, "x64")))
  );
  if (!versions.length) return { available: false, reason: "WINDOWS_SDK_VERSION_NOT_FOUND", root };

  return {
    available: true,
    version: versions[0],
    root,
    binPath: path.join(binRoot, versions[0], "x64")
  };
}

export async function detectAviUtl2(configuredPath = null) {
  if (configuredPath && fs.existsSync(configuredPath)) {
    return { available: true, path: configuredPath, source: "configured" };
  }

  if (process.platform !== "win32") {
    return { available: false, path: null, source: null };
  }

  try {
    const output = await run("where.exe", ["AviUtl2.exe"]);
    const found = output.split(/\r?\n/).find(Boolean);
    if (found && fs.existsSync(found)) {
      return { available: true, path: found, source: "path" };
    }
  } catch {}

  return { available: false, path: null, source: null };
}

export async function detectDevelopmentEnvironment(settings = {}) {
  const [cmake, visualCpp, aviutl2] = await Promise.all([
    detectCmake(),
    detectVisualCpp(),
    detectAviUtl2(settings.aviutl2Path)
  ]);

  return {
    aviutl2,
    cmake,
    visualCpp,
    windowsSdk: detectWindowsSdk()
  };
}
