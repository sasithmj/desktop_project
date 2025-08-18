const { app, BrowserWindow, globalShortcut, dialog } = require("electron");
const path = require("path");

// Import IPC handlers
const IPCHandlers = require("./handlers/handler.js");

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require("electron-squirrel-startup")) {
  app.quit();
}

let mainWindow;
let ipcHandlers;
let fullscreenWindow;

const credFilePath = path.join(app.getPath("userData"), "credentials.json");
const defaultCreds = {
  username: "admin",
  password: "mypassword123"
};
function initCredentials() {
  if (!fs.existsSync(credFilePath)) {
    const hashedPassword = bcrypt.hashSync(defaultCreds.password, 10);
    const data = {
      username: defaultCreds.username,
      passwordHash: hashedPassword
    };
    fs.writeFileSync(credFilePath, JSON.stringify(data, null, 2));
    console.log("Credentials file created:", credFilePath);
  }
}
function getStoredCredentials() {
  if (fs.existsSync(credFilePath)) {
    return JSON.parse(fs.readFileSync(credFilePath, "utf-8"));
  }
  return null;
}

const createFullscreenWindow = (contentData) => {
  if (fullscreenWindow && !fullscreenWindow.isDestroyed()) {
    fullscreenWindow.close();
  }

  fullscreenWindow = new BrowserWindow({
    fullscreen: true,
    alwaysOnTop: true,
    frame: false,
    show: false,
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  fullscreenWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY + "#/fullscreen");

  fullscreenWindow.once("ready-to-show", () => {
    fullscreenWindow.show();

    // Send the content data once the window is ready
    fullscreenWindow.webContents.send("play-content", contentData);
  });
};

const createWindow = () => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    fullscreen: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
    },
  });

  // Load the index.html of the app.
  if (MAIN_WINDOW_WEBPACK_ENTRY) {
    mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);
  }

  // Open the DevTools in development
  if (process.env.NODE_ENV === "development") {
    mainWindow.webContents.openDevTools();
  }

  // Initialize IPC handlers and pass the main window
  ipcHandlers = new IPCHandlers();
  ipcHandlers.setMainWindow(mainWindow);
};

// Register global shortcuts
const registerGlobalShortcuts = () => {
  const windowHandlers = ipcHandlers.getWindowHandlers();

  const getAllWindows = () => {
    return [
      windowHandlers.getMainWindow(),
      windowHandlers.getSettingsWindow(),
      windowHandlers.getDisplayWindow(),
    ].filter(Boolean); // Remove nulls
  };

  // F1: Toggle control panel visibility
  // F1: Toggle all window visibility (control panel)
  globalShortcut.register("F1", () => {
    const visible = windowHandlers.getControlPanelVisible();
    const allWindows = getAllWindows();

    allWindows.forEach((win) => {
      if (!win.isDestroyed()) {
        visible ? win.hide() : win.show();
      }
    });

    windowHandlers.setControlPanelVisible(!visible);
  });

  // F2: Open settings window
  globalShortcut.register("F2", () => {
    windowHandlers.openSettingsHandler();
  });

  // F3: Toggle fullscreen for all windows
  globalShortcut.register("F3", () => {
    const allWindows = getAllWindows();
    allWindows.forEach((win) => {
      if (!win.isDestroyed()) {
        const isFull = win.isFullScreen();
        win.setFullScreen(!isFull);
      }
    });
  });

  // F4: Quit app with confirmation
  globalShortcut.register("F4", () => {
    const focusedWindow =
      BrowserWindow.getFocusedWindow() || windowHandlers.getMainWindow();
    const response = dialog.showMessageBoxSync(focusedWindow, {
      type: "question",
      buttons: ["Yes", "No"],
      defaultId: 1,
      message: "Are you sure you want to close the application?",
      detail: "This will stop the remote display service.",
    });

    if (response === 0) {
      app.quit();
    }
  });

  console.log("Global shortcuts registered:");
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.whenReady().then(() => {
  createWindow();
  registerGlobalShortcuts();

  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("will-quit", () => {
  // Unregister all shortcuts when the app is about to quit
  globalShortcut.unregisterAll();

  // Cleanup IPC handlers and schedulers
  if (ipcHandlers) {
    ipcHandlers.cleanup();
  }
});

// Handle app activation on macOS
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  } else if (mainWindow && ipcHandlers) {
    mainWindow.show();
    ipcHandlers.getWindowHandlers().setControlPanelVisible(true);
  }
});
