const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("hub", {
  getStatus: () => ipcRenderer.invoke("hub:get-status"),
  getDiagnostics: () => ipcRenderer.invoke("hub:get-diagnostics"),
  getSettings: () => ipcRenderer.invoke("hub:get-settings"),
  getEnvironment: () => ipcRenderer.invoke("hub:get-environment"),
  chooseAviUtl2: () => ipcRenderer.invoke("hub:choose-aviutl2"),
  listTestEnvironments: () => ipcRenderer.invoke("hub:list-test-environments"),
  createTestEnvironment: () => ipcRenderer.invoke("hub:create-test-environment"),
  saveWindowPreference: (value) => ipcRenderer.invoke("hub:save-window-preference", value),
  listProjects: () => ipcRenderer.invoke("hub:list-projects"),
  chooseProjectFolder: () => ipcRenderer.invoke("hub:choose-project-folder"),
  addProject: (value) => ipcRenderer.invoke("hub:add-project", value),
  inspectProject: (projectId) => ipcRenderer.invoke("hub:inspect-project", projectId),
  cloneProject: (value) => ipcRenderer.invoke("hub:clone-project", value),
  syncProject: (projectId) => ipcRenderer.invoke("hub:sync-project", projectId),
  setProjectTrust: (projectId, enabled) => ipcRenderer.invoke("hub:set-project-trust", projectId, enabled),
  buildProject: (projectId, configuration) => ipcRenderer.invoke("hub:build-project", projectId, configuration),
  getBuildHistory: (projectId) => ipcRenderer.invoke("hub:get-build-history", projectId),
  getInstallState: (projectId, environmentId) => ipcRenderer.invoke("hub:get-install-state", projectId, environmentId),
  installLatestBuild: (projectId, environmentId) => ipcRenderer.invoke("hub:install-latest-build", projectId, environmentId),
  rollbackInstall: (projectId, environmentId) => ipcRenderer.invoke("hub:rollback-install", projectId, environmentId),
  uninstallTestBuild: (projectId, environmentId) => ipcRenderer.invoke("hub:uninstall-test-build", projectId, environmentId),
  launchTestAviUtl2: (environmentId) => ipcRenderer.invoke("hub:launch-test-aviutl2", environmentId),
  getPluginManifest: (projectId) => ipcRenderer.invoke("hub:get-plugin-manifest", projectId),
  getRoadmap: (projectId) => ipcRenderer.invoke("hub:get-roadmap", projectId),
  setCurrentTask: (projectId, taskKey) => ipcRenderer.invoke("hub:set-current-task", projectId, taskKey),
  previewSave: (projectId) => ipcRenderer.invoke("hub:preview-save", projectId),
  saveProject: (projectId, message) => ipcRenderer.invoke("hub:save-project", projectId, message),
  checkForUpdates: () => ipcRenderer.invoke("hub:check-for-updates"),
  onRuntimeExit: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("hub:runtime-exit", listener);
    return () => ipcRenderer.removeListener("hub:runtime-exit", listener);
  },
  onUpdateStatus: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("hub:update-status", listener);
    return () => ipcRenderer.removeListener("hub:update-status", listener);
  }
});
