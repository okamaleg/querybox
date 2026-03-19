"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
let mainWindow = null;
let nextServer = null;
const isDev = !electron_1.app.isPackaged;
const PORT = 3099;
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 900,
        minHeight: 600,
        titleBarStyle: "hiddenInset",
        trafficLightPosition: { x: 16, y: 16 },
        backgroundColor: "#09090b",
        webPreferences: {
            preload: path_1.default.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });
    mainWindow.loadURL(`http://localhost:${PORT}`);
    if (isDev) {
        mainWindow.webContents.openDevTools({ mode: "detach" });
    }
    mainWindow.on("closed", () => {
        mainWindow = null;
    });
}
function startNextServer() {
    return new Promise((resolve, reject) => {
        const appPath = isDev
            ? path_1.default.join(__dirname, "..")
            : path_1.default.join(process.resourcesPath, "app");
        const cmd = isDev ? "npm" : "node";
        const args = isDev
            ? ["run", "dev", "--", "-p", String(PORT)]
            : [path_1.default.join(appPath, ".next/standalone/server.js")];
        const env = {
            ...process.env,
            PORT: String(PORT),
            NODE_ENV: isDev ? "development" : "production",
            QUERYBOX_USER_DATA: electron_1.app.getPath("userData"),
        };
        nextServer = (0, child_process_1.spawn)(cmd, args, {
            cwd: isDev ? appPath : undefined,
            env,
            stdio: "pipe",
        });
        nextServer.stdout?.on("data", (data) => {
            const output = data.toString();
            console.log("[next]", output);
            if (output.includes("Ready") || output.includes("started server")) {
                resolve();
            }
        });
        nextServer.stderr?.on("data", (data) => {
            console.error("[next:err]", data.toString());
        });
        nextServer.on("error", reject);
        // Fallback resolve after 10s in case "Ready" message format changes
        setTimeout(resolve, 10000);
    });
}
electron_1.app.whenReady().then(async () => {
    await startNextServer();
    createWindow();
    electron_1.app.on("activate", () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});
electron_1.app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        electron_1.app.quit();
    }
});
electron_1.app.on("will-quit", () => {
    if (nextServer) {
        nextServer.kill();
        nextServer = null;
    }
});
// IPC handlers for renderer
electron_1.ipcMain.handle("get-user-data-path", () => electron_1.app.getPath("userData"));
electron_1.ipcMain.handle("get-app-version", () => electron_1.app.getVersion());
