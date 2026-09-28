import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, dialog, ipcMain, nativeTheme, net, screen, shell } from "electron";
import electronUpdater from "electron-updater";
const { autoUpdater } = electronUpdater;
import { loadSettings, saveSettings } from "./core/settings.mjs";
import { createLogger } from "./core/logger.mjs";
import { createProject, loadProjects, saveProjects } from "./core/projects.mjs";
import { getGitVersion, inspectRepository } from "./core/git.mjs";
import { cloneRepository, safeSync, validateRepositoryIdentity } from "./core/git-sync.mjs";
import { previewSave, saveToGitHub } from "./core/git-save.mjs";
import { readRoadmap } from "./core/roadmap.mjs";
import { detectDevelopmentEnvironment } from "./core/environment.mjs";
import { compatibilityState, readPluginManifest } from "./core/plugin-manifest.mjs";
import { isRepositoryTrusted, loadTrust, saveTrust, setRepositoryTrust } from "./core/trust.mjs";
import { buildCmakeProject } from "./core/build.mjs";
import { appendBuildHistory, loadBuildHistory } from "./core/build-history.mjs";
import { createTestEnvironment, loadEnvironments, saveEnvironments } from "./core/test-environments.mjs";
import { getInstallState, installArtifact, rollbackInstall, uninstallManagedFiles } from "./core/deploy.mjs";
import { launchAviUtl2 } from "./core/runtime.mjs";
import { getTaskVerification, loadVerification, saveVerification, updateTaskVerification } from "./core/verification.mjs";
import { createHandoffPack } from "./core/handoff-pack.mjs";
import { sanitizeValue } from "./core/handoff.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
nativeTheme.themeSource = "dark";
app.setAppUserModelId("com.elitemay.videoplugindevhub");

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();

let mainWindow;
let settings;
let settingsPath;
let projectsPath;
let projectStore;
let trustPath;
let trustStore;
let environmentsPath;
let environmentStore;
let logger;
let dataRoot;
const runtimeProcesses = new Map();
let updateState = { type: "idle", version: null, percent: null };

function isTrustedIpcEvent(event) {
  return Boolean(
    mainWindow &&
    !mainWindow.isDestroyed() &&
    event?.sender === mainWindow.webContents
  );
}

function isPayloadSizeSafe(args) {
  try {
    return Buffer.byteLength(JSON.stringify(args ?? []), "utf8") <= 64 * 1024;
  } catch {
    return false;
  }
}

function handleIpc(channel, handler) {
  ipcMain.handle(channel, async (event, ...args) => {
    if (!isTrustedIpcEvent(event)) {
      logger?.write("warn", "Rejected IPC sender", { channel });
      return { ok: false, error: "IPC_SENDER_REJECTED" };
    }
    if (!isPayloadSizeSafe(args)) {
      logger?.write("warn", "Rejected oversized IPC payload", { channel });
      return { ok: false, error: "IPC_PAYLOAD_TOO_LARGE" };
    }
    return handler(event, ...args);
  });
}

function clampWindow(win) {
  const bounds = win.getBounds();
  const displays = screen.getAllDisplays().map(d => d.workArea);
  const visible = displays.some(area =>
    bounds.x < area.x + area.width &&
    bounds.x + bounds.width > area.x &&
    bounds.y < area.y + area.height &&
    bounds.y + bounds.height > area.y
  );
  if (!visible) win.center();
}

function sendUpdateStatus(type, extra = {}) {
  updateState = {
    type,
    version: extra.version ?? updateState.version ?? null,
    percent: extra.percent ?? null,
    ...extra
  };
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("hub:update-status", updateState);
  }
}

function createWindow() {
  const w = settings.window;
  mainWindow = new BrowserWindow({
    width: w.width,
    height: w.height,
    x: Number.isFinite(w.x) ? w.x : undefined,
    y: Number.isFinite(w.y) ? w.y : undefined,
    minWidth: 1000,
    minHeight: 650,
    backgroundColor: "#0f1115",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  clampWindow(mainWindow);
  if (w.maximized) mainWindow.maximize();
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("will-navigate", (event, url) => {
    const currentUrl = mainWindow.webContents.getURL();
    if (url !== currentUrl) {
      event.preventDefault();
      logger.write("warn", "Blocked renderer navigation", { target: "<blocked>" });
    }
  });
  mainWindow.webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });

  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));
  mainWindow.once("ready-to-show", () => mainWindow.show());

  mainWindow.on("close", () => {
    const b = mainWindow.getBounds();
    settings.window = {
      width: b.width,
      height: b.height,
      x: b.x,
      y: b.y,
      maximized: mainWindow.isMaximized()
    };
    saveSettings(settingsPath, settings);
  });

  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    logger.write("error", "Renderer process ended", details);
    if (!mainWindow.isDestroyed()) {
      mainWindow.loadFile(path.join(__dirname, "renderer", "recovery.html"));
    }
  });
}

app.on("second-instance", () => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
});

app.whenReady().then(() => {
  dataRoot = path.join(app.getPath("userData"), "hub-data");
  fs.mkdirSync(dataRoot, { recursive: true });
  settingsPath = path.join(dataRoot, "settings.json");
  projectsPath = path.join(dataRoot, "projects.json");
  trustPath = path.join(dataRoot, "trust.json");
  environmentsPath = path.join(dataRoot, "test-environments.json");
  settings = loadSettings(settingsPath);
  projectStore = loadProjects(projectsPath);
  trustStore = loadTrust(trustPath);
  environmentStore = loadEnvironments(environmentsPath);
  logger = createLogger(path.join(dataRoot, "logs", "hub.log"));
  logger.write("info", "App ready", { version: app.getVersion() });

  createWindow();

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.on("checking-for-update", () => sendUpdateStatus("checking"));
  autoUpdater.on("update-available", info => sendUpdateStatus("available", { version: info.version }));
  autoUpdater.on("update-not-available", () => sendUpdateStatus("current", { version: app.getVersion() }));
  autoUpdater.on("download-progress", progress => sendUpdateStatus("downloading", {
    version: updateState.version,
    percent: Math.max(0, Math.min(100, Math.round(progress.percent ?? 0))),
    transferred: progress.transferred ?? null,
    total: progress.total ?? null
  }));
  autoUpdater.on("update-downloaded", info => sendUpdateStatus("downloaded", {
    version: info.version,
    percent: 100
  }));
  autoUpdater.on("error", error => {
    logger.write("error", "Updater error", { message: error.message });
    sendUpdateStatus("error", { message: error.message });
  });

  if (app.isPackaged && settings.update?.checkOnStartup !== false) {
    setTimeout(() => autoUpdater.checkForUpdates().catch(() => {}), 3000);
  }
});

handleIpc("hub:get-status", async () => ({
  appVersion: app.getVersion(),
  online: net.isOnline(),
  theme: nativeTheme.shouldUseDarkColors ? "dark" : "light",
  gitVersion: await getGitVersion()
}));

async function collectDiagnostics() {
  return sanitizeValue({
    schemaVersion: 1,
    capturedAt: new Date().toISOString(),
    app: { name: app.getName(), version: app.getVersion(), packaged: app.isPackaged },
    runtime: { electron: process.versions.electron, node: process.versions.node, chrome: process.versions.chrome },
    os: { platform: process.platform, arch: process.arch, release: process.getSystemVersion() },
    network: { online: net.isOnline() },
    git: { version: await getGitVersion() },
    update: updateState,
    settings: {
      schemaVersion: settings?.schemaVersion ?? null,
      update: settings?.update ?? null
    },
    projects: { count: projectStore.projects.length },
    testEnvironments: {
      count: environmentStore.environments.length,
      runningCount: runtimeProcesses.size
    },
    storage: {
      userData: "<redacted-userData>",
      settingsReadable: Boolean(settings),
      logBytes: logger?.size?.() ?? 0
    },
    recentLogs: logger?.readRecent?.(100) ?? []
  });
}

handleIpc("hub:get-diagnostics", async () => collectDiagnostics());

handleIpc("hub:export-diagnostics", async () => {
  const directory = path.join(dataRoot, "diagnostics");
  fs.mkdirSync(directory, { recursive: true });
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  const filePath = path.join(directory, "diagnostics-" + stamp + ".json");
  fs.writeFileSync(filePath, JSON.stringify(await collectDiagnostics(), null, 2), "utf8");
  shell.showItemInFolder(filePath);
  logger.write("info", "Diagnostic export created", { fileName: path.basename(filePath) });
  return { ok: true, fileName: path.basename(filePath) };
});

handleIpc("hub:clear-diagnostics", async () => {
  logger.clear();
  logger.write("info", "Diagnostics cleared");
  return { ok: true };
});

handleIpc("hub:open-log-folder", async () => {
  const error = await shell.openPath(path.dirname(logger.path));
  return error ? { ok: false, error: "OPEN_PATH_FAILED" } : { ok: true };
});

handleIpc("hub:open-data-folder", async () => {
  const error = await shell.openPath(dataRoot);
  return error ? { ok: false, error: "OPEN_PATH_FAILED" } : { ok: true };
});

handleIpc("hub:get-settings", () => settings);

handleIpc("hub:update-settings", (_event, patch) => {
  const checkOnStartup = patch?.update?.checkOnStartup;
  if (typeof checkOnStartup !== "boolean") {
    return { ok: false, error: "INVALID_SETTINGS" };
  }
  settings = saveSettings(settingsPath, {
    ...settings,
    update: {
      ...settings.update,
      checkOnStartup
    }
  });
  return { ok: true, settings };
});

handleIpc("hub:get-environment", async () => {
  return detectDevelopmentEnvironment(settings);
});

handleIpc("hub:choose-aviutl2", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "AviUtl2.exeを選択",
    properties: ["openFile"],
    filters: [{ name: "AviUtl2", extensions: ["exe"] }]
  });
  if (result.canceled || result.filePaths.length === 0) return { ok: false, canceled: true };
  const selected = result.filePaths[0];
  settings = saveSettings(settingsPath, { ...settings, aviutl2Path: selected });
  return { ok: true, path: selected, environment: await detectDevelopmentEnvironment(settings) };
});

handleIpc("hub:list-test-environments", async () => ({
  ok: true,
  environments: environmentStore.environments.map(environment => ({
    ...environment,
    running: runtimeProcesses.has(environment.id),
    pid: runtimeProcesses.get(environment.id)?.pid ?? null
  }))
}));

handleIpc("hub:create-test-environment", async () => {
  const detected = await detectDevelopmentEnvironment(settings);
  if (!detected.aviutl2.available) return { ok: false, error: "AVIUTL2_NOT_CONFIGURED" };

  const root = path.join(app.getPath("userData"), "hub-data", "test-environments");
  const result = createTestEnvironment({
    sourceExecutable: detected.aviutl2.path,
    environmentsRoot: root,
    name: "AviUtl2 Test " + (environmentStore.environments.length + 1)
  });
  if (!result.ok) return result;

  environmentStore.environments.push(result.environment);
  environmentStore = saveEnvironments(environmentsPath, environmentStore);
  logger.write("info", "Test environment created", { environmentId: result.environment.id });
  return { ok: true, environment: result.environment };
});

handleIpc("hub:save-window-preference", (_event, value) => {
  settings = saveSettings(settingsPath, { ...settings, ...value });
  return settings;
});

handleIpc("hub:list-projects", async () => {
  const result = [];
  const environment = await detectDevelopmentEnvironment(settings);
  for (const project of projectStore.projects) {
    const gitState = await inspectRepository(project.localPath);
    const roadmap = readRoadmap(project.localPath);
    const manifest = readPluginManifest(project.localPath);
    const currentTask = roadmap.tasks?.find(task => task.key === project.currentTaskKey) ??
      roadmap.tasks?.find(task => !task.completed) ??
      null;
    result.push({
      ...project,
      gitState,
      currentTask,
      roadmapSummary: {
        found: roadmap.found,
        source: roadmap.source ?? null,
        completedCount: roadmap.completedCount ?? 0,
        remainingCount: roadmap.remainingCount ?? 0
      },
      manifestSummary: manifest.valid ? {
        valid: true,
        pluginType: manifest.value.target?.pluginType ?? null,
        architecture: manifest.value.target?.architecture ?? null,
        sdkRepository: manifest.value.sdk?.repository ?? null,
        sdkCommit: manifest.value.sdk?.commit ?? null
      } : {
        valid: false,
        found: manifest.found,
        errors: manifest.errors
      },
      compatibility: compatibilityState(manifest.value, environment),
      trusted: isRepositoryTrusted(trustStore, project.repositorySlug)
    });
  }
  return result;
});

handleIpc("hub:choose-project-folder", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Plugin Repositoryフォルダを選択",
    properties: ["openDirectory"]
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

handleIpc("hub:add-project", async (_event, input) => {
  try {
    const project = createProject(input ?? {});
    if (projectStore.projects.some(item => item.id === project.id)) {
      return { ok: false, error: "ALREADY_REGISTERED" };
    }
    const gitState = await inspectRepository(project.localPath);
    if (!gitState.validGitRepository) {
      return { ok: false, error: "NOT_GIT_REPOSITORY", gitState };
    }
    const identityError = validateRepositoryIdentity(project, gitState);
    if (identityError) {
      return { ok: false, error: identityError, gitState };
    }
    project.defaultBranch = gitState.branch || "main";
    projectStore.projects.push(project);
    projectStore = saveProjects(projectsPath, projectStore);
    logger.write("info", "Project registered", { repositorySlug: project.repositorySlug });
    return { ok: true, project: { ...project, gitState } };
  } catch (error) {
    return { ok: false, error: error?.message ?? "PROJECT_ADD_FAILED" };
  }
});

handleIpc("hub:inspect-project", async (_event, projectId) => {
  const project = projectStore.projects.find(item => item.id === projectId);
  if (!project) return { ok: false, error: "PROJECT_NOT_FOUND" };
  return { ok: true, project, gitState: await inspectRepository(project.localPath) };
});

handleIpc("hub:clone-project", async (_event, input) => {
  try {
    const project = createProject(input ?? {});
    if (projectStore.projects.some(item => item.id === project.id)) {
      return { ok: false, error: "ALREADY_REGISTERED" };
    }
    const cloned = await cloneRepository(project.repositoryUrl, project.localPath);
    if (!cloned.ok) return cloned;
    project.defaultBranch = cloned.state.branch || "main";
    projectStore.projects.push(project);
    projectStore = saveProjects(projectsPath, projectStore);
    logger.write("info", "Project cloned and registered", { repositorySlug: project.repositorySlug });
    return { ok: true, project: { ...project, gitState: cloned.state } };
  } catch (error) {
    return { ok: false, error: error?.message ?? "CLONE_FAILED" };
  }
});

handleIpc("hub:sync-project", async (_event, projectId) => {
  const project = projectStore.projects.find(item => item.id === projectId);
  if (!project) return { ok: false, error: "PROJECT_NOT_FOUND" };
  const result = await safeSync(project);
  logger.write(result.ok ? "info" : "warn", "Project sync", {
    repositorySlug: project.repositorySlug,
    result: result.ok ? "success" : result.error
  });
  return result;
});

handleIpc("hub:set-project-trust", async (_event, projectId, trusted) => {
  const project = projectStore.projects.find(item => item.id === projectId);
  if (!project) return { ok: false, error: "PROJECT_NOT_FOUND" };
  trustStore = setRepositoryTrust(trustStore, project.repositorySlug, trusted === true);
  trustStore = saveTrust(trustPath, trustStore);
  logger.write("info", trusted ? "Repository trusted" : "Repository trust revoked", {
    repositorySlug: project.repositorySlug
  });
  return { ok: true, trusted: isRepositoryTrusted(trustStore, project.repositorySlug) };
});

handleIpc("hub:build-project", async (_event, projectId, configuration) => {
  const project = projectStore.projects.find(item => item.id === projectId);
  if (!project) return { ok: false, error: "PROJECT_NOT_FOUND" };

  const trusted = isRepositoryTrusted(trustStore, project.repositorySlug);
  if (!trusted) return { ok: false, error: "REPOSITORY_NOT_TRUSTED" };

  const manifestResult = readPluginManifest(project.localPath);
  if (!manifestResult.valid) {
    return { ok: false, error: "MANIFEST_INVALID", details: manifestResult.errors };
  }

  const environment = await detectDevelopmentEnvironment(settings);
  const gitState = await inspectRepository(project.localPath);
  const result = await buildCmakeProject({
    project,
    manifest: manifestResult.value,
    configuration,
    trusted,
    environment,
    commit: gitState.head || null
  });

  const safeId = project.id.replace(/[^a-z0-9._-]+/gi, "_");
  const historyPath = path.join(app.getPath("userData"), "hub-data", "build-history", safeId + ".json");
  const entry = result.ok
    ? {
        id: result.build.id,
        ok: true,
        configuration: result.build.configuration,
        startedAt: result.build.startedAt,
        endedAt: result.build.endedAt,
        durationMs: result.build.durationMs,
        commit: result.build.commit,
        dirty: !gitState.clean,
        artifact: result.build.artifact,
        diagnostics: result.diagnostics ?? [],
        logs: result.logs
      }
    : {
        id: new Date().toISOString(),
        ok: false,
        configuration,
        at: new Date().toISOString(),
        commit: gitState.head || null,
        dirty: !gitState.clean,
        error: result.error,
        diagnostics: result.diagnostics ?? [],
        logs: result.logs ?? result.message ?? ""
      };

  appendBuildHistory(historyPath, entry);
  logger.write(result.ok ? "info" : "warn", "Project build", {
    repositorySlug: project.repositorySlug,
    configuration,
    result: result.ok ? "success" : result.error
  });

  return result;
});

handleIpc("hub:get-build-history", async (_event, projectId) => {
  const project = projectStore.projects.find(item => item.id === projectId);
  if (!project) return { ok: false, error: "PROJECT_NOT_FOUND" };
  const safeId = project.id.replace(/[^a-z0-9._-]+/gi, "_");
  const historyPath = path.join(app.getPath("userData"), "hub-data", "build-history", safeId + ".json");
  return { ok: true, entries: loadBuildHistory(historyPath).slice(0, 10) };
});

handleIpc("hub:get-install-state", async (_event, projectId, environmentId) => {
  const project = projectStore.projects.find(item => item.id === projectId);
  const environment = environmentStore.environments.find(item => item.id === environmentId);
  if (!project) return { ok: false, error: "PROJECT_NOT_FOUND" };
  if (!environment) return { ok: false, error: "TEST_ENVIRONMENT_NOT_FOUND" };

  const safeProject = project.id.replace(/[^a-z0-9._-]+/gi, "_");
  const installManifestPath = path.join(
    app.getPath("userData"),
    "hub-data",
    "install-manifests",
    safeProject + "__" + environment.id + ".json"
  );
  return { ok: true, state: getInstallState({ installManifestPath }) };
});

handleIpc("hub:install-latest-build", async (_event, projectId, environmentId) => {
  const project = projectStore.projects.find(item => item.id === projectId);
  const environment = environmentStore.environments.find(item => item.id === environmentId);
  if (!project) return { ok: false, error: "PROJECT_NOT_FOUND" };
  if (!environment) return { ok: false, error: "TEST_ENVIRONMENT_NOT_FOUND" };
  if (runtimeProcesses.has(environment.id)) return { ok: false, error: "TEST_ENVIRONMENT_RUNNING" };
  if (!isRepositoryTrusted(trustStore, project.repositorySlug)) {
    return { ok: false, error: "REPOSITORY_NOT_TRUSTED" };
  }

  const manifestResult = readPluginManifest(project.localPath);
  if (!manifestResult.valid) return { ok: false, error: "MANIFEST_INVALID", details: manifestResult.errors };

  const safeProject = project.id.replace(/[^a-z0-9._-]+/gi, "_");
  const historyPath = path.join(app.getPath("userData"), "hub-data", "build-history", safeProject + ".json");
  const latest = loadBuildHistory(historyPath).find(entry => entry.ok && entry.artifact?.path);
  if (!latest?.artifact?.path || !fs.existsSync(latest.artifact.path)) {
    return { ok: false, error: "ARTIFACT_NOT_FOUND" };
  }

  const installManifestPath = path.join(
    app.getPath("userData"),
    "hub-data",
    "install-manifests",
    safeProject + "__" + environment.id + ".json"
  );
  const backupRoot = path.join(
    app.getPath("userData"),
    "hub-data",
    "deploy-backups",
    safeProject,
    environment.id
  );

  const result = installArtifact({
    projectId: project.id,
    environment,
    pluginManifest: manifestResult.value,
    artifactPath: latest.artifact.path,
    installManifestPath,
    backupRoot
  });
  logger.write(result.ok ? "info" : "warn", "Test install", {
    repositorySlug: project.repositorySlug,
    environmentId,
    result: result.ok ? "success" : result.error
  });
  return result;
});

handleIpc("hub:rollback-install", async (_event, projectId, environmentId) => {
  const project = projectStore.projects.find(item => item.id === projectId);
  const environment = environmentStore.environments.find(item => item.id === environmentId);
  if (!project) return { ok: false, error: "PROJECT_NOT_FOUND" };
  if (!environment) return { ok: false, error: "TEST_ENVIRONMENT_NOT_FOUND" };
  if (runtimeProcesses.has(environment.id)) return { ok: false, error: "TEST_ENVIRONMENT_RUNNING" };

  const safeProject = project.id.replace(/[^a-z0-9._-]+/gi, "_");
  const installManifestPath = path.join(
    app.getPath("userData"),
    "hub-data",
    "install-manifests",
    safeProject + "__" + environment.id + ".json"
  );
  return rollbackInstall({ environment, installManifestPath });
});

handleIpc("hub:uninstall-test-build", async (_event, projectId, environmentId) => {
  const project = projectStore.projects.find(item => item.id === projectId);
  const environment = environmentStore.environments.find(item => item.id === environmentId);
  if (!project) return { ok: false, error: "PROJECT_NOT_FOUND" };
  if (!environment) return { ok: false, error: "TEST_ENVIRONMENT_NOT_FOUND" };
  if (runtimeProcesses.has(environment.id)) return { ok: false, error: "TEST_ENVIRONMENT_RUNNING" };

  const safeProject = project.id.replace(/[^a-z0-9._-]+/gi, "_");
  const installManifestPath = path.join(
    app.getPath("userData"),
    "hub-data",
    "install-manifests",
    safeProject + "__" + environment.id + ".json"
  );
  return uninstallManagedFiles({ environment, installManifestPath });
});

handleIpc("hub:launch-test-aviutl2", async (_event, environmentId) => {
  const environment = environmentStore.environments.find(item => item.id === environmentId);
  if (!environment) return { ok: false, error: "TEST_ENVIRONMENT_NOT_FOUND" };
  if (runtimeProcesses.has(environment.id)) {
    const current = runtimeProcesses.get(environment.id);
    return { ok: true, alreadyRunning: true, pid: current.pid, startedAt: current.startedAt };
  }

  const launched = launchAviUtl2(environment, result => {
    const current = runtimeProcesses.get(environment.id);
    runtimeProcesses.delete(environment.id);
    const payload = {
      environmentId: environment.id,
      environmentName: environment.name,
      pid: current?.pid ?? null,
      startedAt: current?.startedAt ?? null,
      endedAt: new Date().toISOString(),
      ...result
    };
    logger.write(result.cleanExit ? "info" : "warn", "AviUtl2 test runtime ended", payload);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("hub:runtime-exit", payload);
    }
  });

  if (!launched.ok) return launched;
  runtimeProcesses.set(environment.id, {
    child: launched.child,
    pid: launched.pid,
    startedAt: launched.startedAt
  });
  logger.write("info", "AviUtl2 test runtime started", {
    environmentId: environment.id,
    pid: launched.pid
  });
  return { ok: true, pid: launched.pid, startedAt: launched.startedAt };
});

handleIpc("hub:get-plugin-manifest", async (_event, projectId) => {
  const project = projectStore.projects.find(item => item.id === projectId);
  if (!project) return { ok: false, error: "PROJECT_NOT_FOUND" };
  return { ok: true, manifest: readPluginManifest(project.localPath) };
});

handleIpc("hub:get-verification", async (_event, projectId, taskKey) => {
  const project = projectStore.projects.find(item => item.id === projectId);
  if (!project) return { ok: false, error: "PROJECT_NOT_FOUND" };
  const roadmap = readRoadmap(project.localPath);
  const task = roadmap.tasks?.find(item => item.key === taskKey);
  if (!task) return { ok: false, error: "TASK_NOT_AVAILABLE" };

  const safeProject = project.id.replace(/[^a-z0-9._-]+/gi, "_");
  const verificationPath = path.join(
    app.getPath("userData"),
    "hub-data",
    "verification",
    safeProject + ".json"
  );
  const store = loadVerification(verificationPath);
  return { ok: true, task, verification: getTaskVerification(store, task) };
});

handleIpc("hub:save-verification", async (_event, projectId, taskKey, patch, environmentId) => {
  const project = projectStore.projects.find(item => item.id === projectId);
  if (!project) return { ok: false, error: "PROJECT_NOT_FOUND" };
  const roadmap = readRoadmap(project.localPath);
  const task = roadmap.tasks?.find(item => item.key === taskKey);
  if (!task) return { ok: false, error: "TASK_NOT_AVAILABLE" };

  const gitState = await inspectRepository(project.localPath);
  const safeProject = project.id.replace(/[^a-z0-9._-]+/gi, "_");
  const buildHistoryPath = path.join(
    app.getPath("userData"),
    "hub-data",
    "build-history",
    safeProject + ".json"
  );
  const latestBuild = loadBuildHistory(buildHistoryPath).find(entry => entry.ok) ?? null;
  const testEnvironment = environmentStore.environments.find(item => item.id === environmentId) ?? null;

  const verificationPath = path.join(
    app.getPath("userData"),
    "hub-data",
    "verification",
    safeProject + ".json"
  );
  let store = loadVerification(verificationPath);
  store = updateTaskVerification(store, task, patch ?? {}, {
    repository: {
      commit: gitState.head || null,
      branch: gitState.branch || null,
      dirty: !gitState.clean
    },
    build: latestBuild ? {
      id: latestBuild.id,
      configuration: latestBuild.configuration,
      commit: latestBuild.commit,
      artifactSha256: latestBuild.artifact?.sha256 ?? null
    } : null,
    testEnvironment: testEnvironment ? {
      id: testEnvironment.id,
      name: testEnvironment.name
    } : null,
    hubVersion: app.getVersion(),
    verifiedAt: new Date().toISOString()
  });
  saveVerification(verificationPath, store);
  return { ok: true, task, verification: getTaskVerification(store, task) };
});

handleIpc("hub:add-verification-screenshot", async (_event, projectId, taskKey) => {
  const project = projectStore.projects.find(item => item.id === projectId);
  if (!project) return { ok: false, error: "PROJECT_NOT_FOUND" };
  const roadmap = readRoadmap(project.localPath);
  const task = roadmap.tasks?.find(item => item.key === taskKey);
  if (!task) return { ok: false, error: "TASK_NOT_AVAILABLE" };

  const selected = await dialog.showOpenDialog(mainWindow, {
    title: "確認用スクリーンショットを選択",
    properties: ["openFile"],
    filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp"] }]
  });
  if (selected.canceled || selected.filePaths.length === 0) {
    return { ok: false, canceled: true };
  }

  const source = selected.filePaths[0];
  const safeProject = project.id.replace(/[^a-z0-9._-]+/gi, "_");
  const destinationDirectory = path.join(
    app.getPath("userData"),
    "hub-data",
    "screenshots",
    safeProject,
    task.key
  );
  fs.mkdirSync(destinationDirectory, { recursive: true });
  const extension = path.extname(source).toLowerCase();
  const fileName = Date.now() + extension;
  const destination = path.join(destinationDirectory, fileName);
  fs.copyFileSync(source, destination);

  const verificationPath = path.join(
    app.getPath("userData"),
    "hub-data",
    "verification",
    safeProject + ".json"
  );
  let store = loadVerification(verificationPath);
  store = updateTaskVerification(store, task, { screenshots: [destination] }, null);
  saveVerification(verificationPath, store);

  return {
    ok: true,
    screenshot: { path: destination, name: fileName },
    verification: getTaskVerification(store, task)
  };
});

handleIpc("hub:get-roadmap", async (_event, projectId) => {
  const project = projectStore.projects.find(item => item.id === projectId);
  if (!project) return { ok: false, error: "PROJECT_NOT_FOUND" };
  return { ok: true, roadmap: readRoadmap(project.localPath), currentTaskKey: project.currentTaskKey ?? null };
});

handleIpc("hub:set-current-task", async (_event, projectId, taskKey) => {
  const project = projectStore.projects.find(item => item.id === projectId);
  if (!project) return { ok: false, error: "PROJECT_NOT_FOUND" };
  const roadmap = readRoadmap(project.localPath);
  const task = roadmap.tasks?.find(item => item.key === taskKey);
  if (!task || task.completed) return { ok: false, error: "TASK_NOT_AVAILABLE" };
  project.currentTaskKey = task.key;
  projectStore = saveProjects(projectsPath, projectStore);
  return { ok: true, task };
});

handleIpc("hub:preview-save", async (_event, projectId) => {
  const project = projectStore.projects.find(item => item.id === projectId);
  if (!project) return { ok: false, error: "PROJECT_NOT_FOUND" };
  return previewSave(project);
});

handleIpc("hub:save-project", async (_event, projectId, commitMessage) => {
  const project = projectStore.projects.find(item => item.id === projectId);
  if (!project) return { ok: false, error: "PROJECT_NOT_FOUND" };
  const result = await saveToGitHub(project, commitMessage);
  logger.write(result.ok ? "info" : "warn", "Project save", {
    repositorySlug: project.repositorySlug,
    result: result.ok ? "success" : result.error
  });
  return result;
});

handleIpc("hub:create-chatgpt-pack", async (_event, projectId, environmentId) => {
  const project = projectStore.projects.find(item => item.id === projectId);
  if (!project) return { ok: false, error: "PROJECT_NOT_FOUND" };

  const gitState = await inspectRepository(project.localPath);
  const roadmap = readRoadmap(project.localPath);
  const currentTask = roadmap.tasks?.find(task => task.key === project.currentTaskKey) ??
    roadmap.tasks?.find(task => !task.completed) ??
    null;
  const manifest = readPluginManifest(project.localPath);
  const safeProject = project.id.replace(/[^a-z0-9._-]+/gi, "_");

  const buildHistoryPath = path.join(app.getPath("userData"), "hub-data", "build-history", safeProject + ".json");
  const latestBuild = loadBuildHistory(buildHistoryPath)[0] ?? null;
  const verificationPath = path.join(app.getPath("userData"), "hub-data", "verification", safeProject + ".json");
  const verificationStore = loadVerification(verificationPath);
  const selectedEnvironment = environmentStore.environments.find(item => item.id === environmentId) ?? null;

  let installState = null;
  if (selectedEnvironment) {
    const installManifestPath = path.join(
      app.getPath("userData"), "hub-data", "install-manifests",
      safeProject + "__" + selectedEnvironment.id + ".json"
    );
    installState = getInstallState({ installManifestPath });
  }

  const verificationTasks = Object.values(verificationStore.tasks ?? {}).map(item => ({
    taskKey: item.taskKey,
    taskText: item.taskText,
    owner: item.owner,
    stepResults: item.stepResults ?? {},
    memo: item.memo ?? "",
    screenshots: (item.screenshots ?? []).map(file => path.basename(file)),
    context: item.context ?? null,
    updatedAt: item.updatedAt ?? null
  }));

  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    hub: { version: app.getVersion() },
    project: {
      id: project.id,
      name: project.name,
      repositorySlug: project.repositorySlug,
      repositoryUrl: project.repositoryUrl
    },
    repository: {
      commit: gitState.head || null,
      branch: gitState.branch || null,
      dirty: !gitState.clean,
      changedCount: gitState.changedCount ?? 0,
      changes: (gitState.changes ?? []).map(item => ({ path: item.path, label: item.label }))
    },
    plugin: manifest.valid ? {
      id: manifest.value.id,
      name: manifest.value.name,
      type: manifest.value.target?.pluginType ?? null,
      architecture: manifest.value.target?.architecture ?? null,
      sdkRepository: manifest.value.sdk?.repository ?? null,
      sdkCommit: manifest.value.sdk?.commit ?? null
    } : { manifestValid: false, errors: manifest.errors },
    currentTask,
    roadmap: {
      source: roadmap.source ?? null,
      completedCount: roadmap.completedCount ?? 0,
      remainingCount: roadmap.remainingCount ?? 0
    },
    latestBuild: latestBuild ? {
      id: latestBuild.id,
      ok: latestBuild.ok,
      configuration: latestBuild.configuration,
      commit: latestBuild.commit,
      dirty: latestBuild.dirty,
      artifact: latestBuild.artifact ? {
        relativePath: latestBuild.artifact.relativePath,
        sha256: latestBuild.artifact.sha256,
        size: latestBuild.artifact.size
      } : null,
      error: latestBuild.error ?? null,
      diagnostics: latestBuild.diagnostics ?? []
    } : null,
    testEnvironment: selectedEnvironment ? {
      id: selectedEnvironment.id,
      name: selectedEnvironment.name,
      running: runtimeProcesses.has(selectedEnvironment.id)
    } : null,
    installState,
    verification: { tasks: verificationTasks },
    roleBoundary: {
      chatgpt: "Repositoryだけで完了できるコード・文書・Roadmap作業を実行する。",
      user: "Windows実機操作、AviUtl2目視、Previewや操作感の確認を行う。"
    }
  };

  const evidenceScreenshots = [];
  for (const item of Object.values(verificationStore.tasks ?? {})) {
    for (const screenshotPath of item.screenshots ?? []) {
      evidenceScreenshots.push({ taskKey: item.taskKey, path: screenshotPath });
    }
  }

  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  const packRoot = path.join(
    app.getPath("userData"), "hub-data", "chatgpt-packs",
    stamp + "-" + safeProject
  );
  const screenshotBuffer = mainWindow && !mainWindow.isDestroyed()
    ? (await mainWindow.capturePage()).toPNG()
    : null;

  createHandoffPack({
    packRoot,
    report,
    screenshotBuffer,
    evidenceScreenshots,
    logPath: logger.path
  });
  logger.write("info", "ChatGPT handoff pack created", {
    repositorySlug: project.repositorySlug,
    packName: path.basename(packRoot)
  });
  await shell.openPath(packRoot);
  return { ok: true, packName: path.basename(packRoot) };
});

handleIpc("hub:get-update-state", async () => ({ ok: true, state: updateState }));

handleIpc("hub:check-for-updates", async () => {
  if (!app.isPackaged) return { ok: false, reason: "development" };
  if (!net.isOnline()) return { ok: false, reason: "offline" };
  await autoUpdater.checkForUpdates();
  return { ok: true };
});

handleIpc("hub:download-update", async () => {
  if (!app.isPackaged) return { ok: false, reason: "development" };
  if (!net.isOnline()) return { ok: false, reason: "offline" };
  if (updateState.type === "downloaded") return { ok: true, alreadyDownloaded: true };
  if (updateState.type !== "available" && updateState.type !== "downloading") {
    return { ok: false, reason: "no-update" };
  }
  await autoUpdater.downloadUpdate();
  return { ok: true };
});

handleIpc("hub:install-update", async () => {
  if (!app.isPackaged) return { ok: false, reason: "development" };
  if (updateState.type !== "downloaded") return { ok: false, reason: "not-downloaded" };
  setTimeout(() => autoUpdater.quitAndInstall(false, true), 100);
  return { ok: true };
});

handleIpc("hub:open-release-page", async () => {
  await shell.openExternal("https://github.com/EliteMay/video-plugin-dev-hub/releases/latest");
  return { ok: true };
});

handleIpc("hub:reload-renderer", async () => {
  if (!mainWindow || mainWindow.isDestroyed()) return { ok: false, error: "WINDOW_NOT_AVAILABLE" };
  await mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));
  return { ok: true };
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
