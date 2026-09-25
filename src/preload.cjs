const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("hub", {
  getStatus: () => ipcRenderer.invoke("hub:get-status"),
  getDiagnostics: () => ipcRenderer.invoke("hub:get-diagnostics"),
  getSettings: () => ipcRenderer.invoke("hub:get-settings"),
  saveWindowPreference: (value) => ipcRenderer.invoke("hub:save-window-preference", value),
  listProjects: () => ipcRenderer.invoke("hub:list-projects"),
  chooseProjectFolder: () => ipcRenderer.invoke("hub:choose-project-folder"),
  addProject: (value) => ipcRenderer.invoke("hub:add-project", value),
  inspectProject: (projectId) => ipcRenderer.invoke("hub:inspect-project", projectId),
  checkForUpdates: () => ipcRenderer.invoke("hub:check-for-updates"),
  onUpdateStatus: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("hub:update-status", listener);
    return () => ipcRenderer.removeListener("hub:update-status", listener);
  }
});
