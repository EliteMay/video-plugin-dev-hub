import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, ipcMain, nativeTheme, net, screen } from "electron";
import { autoUpdater } from "electron-updater";
import { loadSettings, saveSettings } from "./core/settings.mjs";
import { createLogger } from "./core/logger.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
nativeTheme.themeSource = "dark";
app.setAppUserModelId("com.elitemay.videoplugindevhub");

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();

let mainWindow;
let settings;
let settingsPath;
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
  settings = loadSettings(settingsPath);
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

ipcMain.handle("hub:get-status", () => ({
  appVersion: app.getVersion(),
  online: net.isOnline(),
  theme: nativeTheme.shouldUseDarkColors ? "dark" : "light"
}));

ipcMain.handle("hub:get-diagnostics", () => ({
  app: { name: app.getName(), version: app.getVersion(), packaged: app.isPackaged },
  runtime: { electron: process.versions.electron, node: process.versions.node, chrome: process.versions.chrome },
  os: { platform: process.platform, arch: process.arch, release: process.getSystemVersion() },
  network: { online: net.isOnline() },
  storage: { userData: "<redacted-userData>", settingsReadable: Boolean(settings) }
}));

ipcMain.handle("hub:get-settings", () => settings);

ipcMain.handle("hub:save-window-preference", (_event, value) => {
  settings = saveSettings(settingsPath, { ...settings, ...value });
  return settings;
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
