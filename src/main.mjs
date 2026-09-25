import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, dialog, ipcMain, nativeTheme, net, screen } from "electron";
import { autoUpdater } from "electron-updater";
import { loadSettings, saveSettings } from "./core/settings.mjs";
import { createLogger } from "./core/logger.mjs";
import { createProject, loadProjects, saveProjects } from "./core/projects.mjs";
import { getGitVersion, inspectRepository } from "./core/git.mjs";
import { cloneRepository, safeSync } from "./core/git-sync.mjs";
import { previewSave, saveToGitHub } from "./core/git-save.mjs";

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
let logger;

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
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("hub:update-status", { type, ...extra });
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
  const dataRoot = path.join(app.getPath("userData"), "hub-data");
  fs.mkdirSync(dataRoot, { recursive: true });
  settingsPath = path.join(dataRoot, "settings.json");
  projectsPath = path.join(dataRoot, "projects.json");
  settings = loadSettings(settingsPath);
  projectStore = loadProjects(projectsPath);
  logger = createLogger(path.join(dataRoot, "logs", "hub.log"));
  logger.write("info", "App ready", { version: app.getVersion() });

  createWindow();

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.on("checking-for-update", () => sendUpdateStatus("checking"));
  autoUpdater.on("update-available", info => sendUpdateStatus("available", { version: info.version }));
  autoUpdater.on("update-not-available", () => sendUpdateStatus("current"));
  autoUpdater.on("error", error => {
    logger.write("error", "Updater error", { message: error.message });
    sendUpdateStatus("error", { message: error.message });
  });

  if (app.isPackaged) {
    setTimeout(() => autoUpdater.checkForUpdates().catch(() => {}), 3000);
  }
});

ipcMain.handle("hub:get-status", async () => ({
  appVersion: app.getVersion(),
  online: net.isOnline(),
  theme: nativeTheme.shouldUseDarkColors ? "dark" : "light",
  gitVersion: await getGitVersion()
}));

ipcMain.handle("hub:get-diagnostics", async () => ({
  app: { name: app.getName(), version: app.getVersion(), packaged: app.isPackaged },
  runtime: { electron: process.versions.electron, node: process.versions.node, chrome: process.versions.chrome },
  os: { platform: process.platform, arch: process.arch, release: process.getSystemVersion() },
  network: { online: net.isOnline() },
  git: { version: await getGitVersion() },
  projects: { count: projectStore.projects.length },
  storage: { userData: "<redacted-userData>", settingsReadable: Boolean(settings) }
}));

ipcMain.handle("hub:get-settings", () => settings);

ipcMain.handle("hub:save-window-preference", (_event, value) => {
  settings = saveSettings(settingsPath, { ...settings, ...value });
  return settings;
});

ipcMain.handle("hub:list-projects", async () => {
  const result = [];
  for (const project of projectStore.projects) {
    const gitState = await inspectRepository(project.localPath);
    result.push({ ...project, gitState });
  }
  return result;
});

ipcMain.handle("hub:choose-project-folder", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Plugin Repositoryフォルダを選択",
    properties: ["openDirectory"]
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

ipcMain.handle("hub:add-project", async (_event, input) => {
  try {
    const project = createProject(input ?? {});
    if (projectStore.projects.some(item => item.id === project.id)) {
      return { ok: false, error: "ALREADY_REGISTERED" };
    }
    const gitState = await inspectRepository(project.localPath);
    if (!gitState.validGitRepository) {
      return { ok: false, error: "NOT_GIT_REPOSITORY", gitState };
    }
    const normalizedOrigin = String(gitState.origin ?? "").replace(/\.git$/i, "").toLowerCase();
    if (normalizedOrigin && normalizedOrigin !== project.repositoryUrl.toLowerCase()) {
      return { ok: false, error: "ORIGIN_MISMATCH", gitState };
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

ipcMain.handle("hub:inspect-project", async (_event, projectId) => {
  const project = projectStore.projects.find(item => item.id === projectId);
  if (!project) return { ok: false, error: "PROJECT_NOT_FOUND" };
  return { ok: true, project, gitState: await inspectRepository(project.localPath) };
});

ipcMain.handle("hub:clone-project", async (_event, input) => {
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

ipcMain.handle("hub:sync-project", async (_event, projectId) => {
  const project = projectStore.projects.find(item => item.id === projectId);
  if (!project) return { ok: false, error: "PROJECT_NOT_FOUND" };
  const result = await safeSync(project);
  logger.write(result.ok ? "info" : "warn", "Project sync", {
    repositorySlug: project.repositorySlug,
    result: result.ok ? "success" : result.error
  });
  return result;
});

ipcMain.handle("hub:preview-save", async (_event, projectId) => {
  const project = projectStore.projects.find(item => item.id === projectId);
  if (!project) return { ok: false, error: "PROJECT_NOT_FOUND" };
  return previewSave(project);
});

ipcMain.handle("hub:save-project", async (_event, projectId, commitMessage) => {
  const project = projectStore.projects.find(item => item.id === projectId);
  if (!project) return { ok: false, error: "PROJECT_NOT_FOUND" };
  const result = await saveToGitHub(project, commitMessage);
  logger.write(result.ok ? "info" : "warn", "Project save", {
    repositorySlug: project.repositorySlug,
    result: result.ok ? "success" : result.error
  });
  return result;
});

ipcMain.handle("hub:check-for-updates", async () => {
  if (!app.isPackaged) return { ok: false, reason: "development" };
  if (!net.isOnline()) return { ok: false, reason: "offline" };
  await autoUpdater.checkForUpdates();
  return { ok: true };
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
