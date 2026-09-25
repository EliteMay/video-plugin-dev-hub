const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("hub", {
  getStatus: () => ipcRenderer.invoke("hub:get-status"),
  getDiagnostics: () => ipcRenderer.invoke("hub:get-diagnostics"),
  getSettings: () => ipcRenderer.invoke("hub:get-settings"),
  getEnvironment: () => ipcRenderer.invoke("hub:get-environment"),
  chooseAviUtl2: () => ipcRenderer.invoke("hub:choose-aviutl2"),
  saveWindowPreference: (value) => ipcRenderer.invoke("hub:save-window-preference", value),
  listProjects: () => ipcRenderer.invoke("hub:list-projects"),
  chooseProjectFolder: () => ipcRenderer.invoke("hub:choose-project-folder"),
  addProject: (value) => ipcRenderer.invoke("hub:add-project", value),
  inspectProject: (projectId) => ipcRenderer.invoke("hub:inspect-project", projectId),
  cloneProject: (value) => ipcRenderer.invoke("hub:clone-project", value),
  syncProject: (projectId) => ipcRenderer.invoke("hub:sync-project", projectId),
  getRoadmap: (projectId) => ipcRenderer.invoke("hub:get-roadmap", projectId),
  setCurrentTask: (projectId, taskKey) => ipcRenderer.invoke("hub:set-current-task", projectId, taskKey),
  previewSave: (projectId) => ipcRenderer.invoke("hub:preview-save", projectId),
  saveProject: (projectId, message) => ipcRenderer.invoke("hub:save-project", projectId, message),
  checkForUpdates: () => ipcRenderer.invoke("hub:check-for-updates"),
  onUpdateStatus: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("hub:update-status", listener);
    return () => ipcRenderer.removeListener("hub:update-status", listener);
  }
});
