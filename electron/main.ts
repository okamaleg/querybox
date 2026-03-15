import { app, BrowserWindow, ipcMain } from "electron";
import path from "path";
import { spawn, ChildProcess } from "child_process";

let mainWindow: BrowserWindow | null = null;
let nextServer: ChildProcess | null = null;

const isDev = !app.isPackaged;
const PORT = 3099;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: "#09090b",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
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

function startNextServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    const appPath = isDev
      ? path.join(__dirname, "..")
      : path.join(process.resourcesPath, "app");

    const cmd = isDev ? "npm" : "node";
    const args = isDev
      ? ["run", "dev", "--", "-p", String(PORT)]
      : [path.join(appPath, ".next/standalone/server.js")];

    const env = {
      ...process.env,
      PORT: String(PORT),
      NODE_ENV: isDev ? "development" : "production",
      SESHAT_USER_DATA: app.getPath("userData"),
    };

    nextServer = spawn(cmd, args, {
      cwd: isDev ? appPath : undefined,
      env,
      stdio: "pipe",
    });

    nextServer.stdout?.on("data", (data: Buffer) => {
      const output = data.toString();
      console.log("[next]", output);
      if (output.includes("Ready") || output.includes("started server")) {
        resolve();
      }
    });

    nextServer.stderr?.on("data", (data: Buffer) => {
      console.error("[next:err]", data.toString());
    });

    nextServer.on("error", reject);

    // Fallback resolve after 10s in case "Ready" message format changes
    setTimeout(resolve, 10000);
  });
}

app.whenReady().then(async () => {
  await startNextServer();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("will-quit", () => {
  if (nextServer) {
    nextServer.kill();
    nextServer = null;
  }
});

// IPC handlers for renderer
ipcMain.handle("get-user-data-path", () => app.getPath("userData"));
ipcMain.handle("get-app-version", () => app.getVersion());
