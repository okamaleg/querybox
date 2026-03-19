import { app, BrowserWindow, ipcMain } from "electron";
import path from "path";
import { spawn, ChildProcess } from "child_process";

let mainWindow: BrowserWindow | null = null;
let serverProcess: ChildProcess | null = null;

const isDev = !app.isPackaged;
const VITE_PORT = 5173;
const SERVER_PORT = 3099;

function startServer(): Promise<void> {
  return new Promise((resolve) => {
    const serverEntry = isDev
      ? path.join(__dirname, "..", "server", "index.ts")
      : path.join(__dirname, "..", "dist-server", "index.js");

    const cmd = isDev ? "npx" : "node";
    const args = isDev ? ["tsx", serverEntry] : [serverEntry];

    serverProcess = spawn(cmd, args, {
      cwd: path.join(__dirname, ".."),
      env: {
        ...process.env,
        QUERYBOX_USER_DATA: app.getPath("userData"),
      },
      stdio: "pipe",
    });

    serverProcess.stdout?.on("data", (data: Buffer) => {
      const output = data.toString();
      console.log("[server]", output);
      if (output.includes("listening")) {
        resolve();
      }
    });

    serverProcess.stderr?.on("data", (data: Buffer) => {
      console.error("[server:err]", data.toString());
    });

    // Fallback resolve after 5s
    setTimeout(resolve, 5000);
  });
}

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

  if (isDev) {
    mainWindow.loadURL(`http://localhost:${VITE_PORT}`);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    // In production, load from the local server (API + static files)
    mainWindow.loadURL(`http://localhost:${SERVER_PORT}`);
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  await startServer();
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
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
});

// IPC handlers
ipcMain.handle("get-user-data-path", () => app.getPath("userData"));
ipcMain.handle("get-app-version", () => app.getVersion());
