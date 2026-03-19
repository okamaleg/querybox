"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld("electronAPI", {
    getUserDataPath: () => electron_1.ipcRenderer.invoke("get-user-data-path"),
    getAppVersion: () => electron_1.ipcRenderer.invoke("get-app-version"),
});
