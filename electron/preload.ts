import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  getUserDataPath: () => ipcRenderer.invoke("get-user-data-path"),
  getAppVersion: () => ipcRenderer.invoke("get-app-version"),
});
