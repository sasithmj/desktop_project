const { ipcMain, BrowserWindow, dialog } = require("electron");

class WindowHandlers {
  constructor() {
    this.controlPanelVisible = true;
    this.settingsWindow = null;
    this.displayWindow = null;
    this.registerHandlers();
  }

  registerHandlers() {
    ipcMain.handle("display-url", this.displayUrlHandler.bind(this));
    ipcMain.handle("close-display", this.closeDisplayHandler.bind(this));
    ipcMain.handle(
      "toggle-control-panel",
      this.toggleControlPanelHandler.bind(this)
    );
    ipcMain.handle("open-settings", this.openSettingsHandler.bind(this));
    ipcMain.handle(
      "toggle-fullscreen",
      this.toggleFullscreenHandler.bind(this)
    );
    ipcMain.handle("show-quit-dialog", this.showQuitDialogHandler.bind(this));
  }

  getMainWindow() {
    return this.mainWindow;
  }

  getSettingsWindow() {
    return this.settingsWindow;
  }

  getDisplayWindow() {
    return this.displayWindow;
  }

  displayUrlHandler(event, url) {
    this.createDisplayWindow(url);
    return { success: true };
  }

  closeDisplayHandler() {
    if (this.displayWindow) {
      this.displayWindow.close();
    }
    return { success: true };
  }

  toggleControlPanelHandler() {
    if (this.mainWindow) {
      if (this.controlPanelVisible) {
        this.mainWindow.hide();
        this.controlPanelVisible = false;
      } else {
        this.mainWindow.show();
        this.mainWindow.focus();
        this.controlPanelVisible = true;
      }
    }
    return { success: true, visible: this.controlPanelVisible };
  }

  toggleFullscreenHandler() {
    if (this.mainWindow) {
      const isFullScreen = this.mainWindow.isFullScreen();
      this.mainWindow.setFullScreen(!isFullScreen);
      return { success: true, fullscreen: !isFullScreen };
    }
    return { success: false };
  }

  showQuitDialogHandler() {
    const response = dialog.showMessageBoxSync(this.mainWindow, {
      type: "question",
      buttons: ["Yes", "No"],
      defaultId: 1,
      message: "Are you sure you want to close the application?",
      detail: "This will stop the remote display service.",
    });

    if (response === 0) {
      require("electron").app.quit();
      return { success: true, quit: true };
    }
    return { success: true, quit: false };
  }

  async createDisplayWindow(url) {
    // Close existing display window and wait for it to be properly closed
    if (this.displayWindow && !this.displayWindow.isDestroyed()) {
      console.log("Closing existing display window...");

      // Create a promise that resolves when the window is closed
      const closePromise = new Promise((resolve) => {
        if (this.displayWindow.isDestroyed()) {
          resolve();
          return;
        }

        this.displayWindow.once("closed", () => {
          console.log("Previous display window closed");
          resolve();
        });

        // Force close the window
        this.displayWindow.close();
      });

      // Wait for the window to close, with a timeout
      await Promise.race([
        closePromise,
        new Promise((resolve) => setTimeout(resolve, 1000)), // 1 second timeout
      ]);

      // Ensure the reference is cleared
      this.displayWindow = null;
    }

    console.log("Creating new display window with URL:", url);

    this.displayWindow = new BrowserWindow({
      width: 1920,
      height: 1080,
      fullscreen: true,
      alwaysOnTop: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: false, // Allow loading external URLs
      },
    });

    this.displayWindow.loadURL(url);

    // Register ESC key to close display window
    this.displayWindow.webContents.on("before-input-event", (event, input) => {
      if (input.key === "Escape") {
        this.displayWindow.close();
      }
    });

    this.displayWindow.on("closed", () => {
      console.log("Display window closed event fired");
      this.displayWindow = null;
    });

    // Handle any load failures
    this.displayWindow.webContents.on(
      "did-fail-load",
      (event, errorCode, errorDescription, validatedURL) => {
        console.error(`Failed to load URL: ${validatedURL}`, errorDescription);
      }
    );
  }

  openSettingsHandler(event, screen = "settings") {
    this.createSettingsWindow(screen);
    return { success: true };
  }

  createSettingsWindow(screen = "settings") {
    if (this.settingsWindow) {
      this.settingsWindow.focus();
      this.settingsWindow.webContents.send("navigate-to", screen); // optional live reload
      return;
    }

    this.settingsWindow = new BrowserWindow({
      width: 800,
      height: 600,
      parent: this.mainWindow,
      modal: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      },
    });

    const route = `${MAIN_WINDOW_WEBPACK_ENTRY}#${screen}`;
    this.settingsWindow.loadURL(route);

    this.settingsWindow.on("closed", () => {
      this.settingsWindow = null;
    });
  }

  setMainWindow(mainWindow) {
    this.mainWindow = mainWindow;
  }

  setControlPanelVisible(visible) {
    this.controlPanelVisible = visible;
  }

  getControlPanelVisible() {
    return this.controlPanelVisible;
  }
}

module.exports = WindowHandlers;
