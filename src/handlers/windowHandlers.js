const { ipcMain, BrowserWindow, dialog, session } = require("electron");

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
    //need this
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

    // Use a unique partition for isolation (prevents session bleed from prior windows/initial run)
    const partition = `persist:display-${Date.now()}`;

    this.displayWindow = new BrowserWindow({
      width: 1920,
      height: 1080,
      fullscreen: true,
      alwaysOnTop: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: false, // Allow loading external URLs
        partition, // Isolated session
      },
    });

    // Always rewrite YouTube embeds to no-cookie domain (fixes referrer flakiness)
    let finalUrl = url;
    if (
      url.includes("youtube.com/embed/") ||
      url.includes("youtube.com/watch?v=")
    ) {
      if (url.includes("watch?v=")) {
        // Convert watch to embed if needed
        const videoId = url.split("v=")[1]?.split("&")[0];
        finalUrl = `https://www.youtube-nocookie.com/embed/${videoId}`;
      } else {
        finalUrl = url.replace(
          "youtube.com/embed/",
          "youtube-nocookie.com/embed/"
        );
      }
      console.log("Rewrote URL to no-cookie domain:", finalUrl);
    }

    // Get the session for this partition and set up interceptor
    const ses = session.fromPartition(partition);
    ses.webRequest.onBeforeSendHeaders(
      {
        urls: [
          "*://*.youtube.com/*",
          "*://*.googlevideo.com/*",
          "*://*.ytimg.com/*",
        ],
      },
      (details, callback) => {
        // Ensure Referer is always set (even if partially present)
        details.requestHeaders["Referer"] = "https://www.youtube.com/";
        callback({ requestHeaders: details.requestHeaders });
      }
    );

    // Clear YouTube-related storage to nuke stale data (cookies/auth causing intermittency)
    ses.clearStorageData(
      {
        storages: ["cookies", "localstorage", "sessionstorage"],
        quotas: ["cachestorage"],
      },
      (error) => {
        if (error) console.error("Session clear failed:", error);
        else console.log("Cleared session data for fresh load");
      }
    );

    // Micro-delay load to ensure interceptor + clear are settled (fixes initial run timing)
    setTimeout(() => {
      // NEW: Load with strict referrer policy to mimic iframe attribute
      this.displayWindow.loadURL(finalUrl, {
        referrer: {
          policy: "strict-origin-when-cross-origin", // Strips path/query for cross-origin, keeps origin
        },
      });
    }, 100);

    // Register ESC key to close display window
    this.displayWindow.webContents.on("before-input-event", (event, input) => {
      if (input.key === "Escape") {
        this.displayWindow.close();
      }
    });

    this.displayWindow.on("closed", () => {
      console.log("Display window closed event fired");
      this.displayWindow = null;
      // Optional: Clear the partition on close for next time
      ses.clearStorageData({ storages: ["all"] });
    });

    // Handle any load failures
    this.displayWindow.webContents.on(
      "did-fail-load",
      (event, errorCode, errorDescription, validatedURL) => {
        console.error(`Failed to load URL: ${validatedURL}`, errorDescription);
        // Fallback to external browser on YouTube errors
        if (
          validatedURL.includes("youtube.com") &&
          (errorCode === -6 || errorDescription.includes("153"))
        ) {
          const { shell } = require("electron");
          shell.openExternal(
            validatedURL.replace("youtube-nocookie.com", "www.youtube.com")
          );
        }
      }
    );
  }
  
  // async createDisplayWindow(url) {
  //   //need this
  //   // Close existing display window and wait for it to be properly closed
  //   if (this.displayWindow && !this.displayWindow.isDestroyed()) {
  //     console.log("Closing existing display window...");

  //     // Create a promise that resolves when the window is closed
  //     const closePromise = new Promise((resolve) => {
  //       if (this.displayWindow.isDestroyed()) {
  //         resolve();
  //         return;
  //       }

  //       this.displayWindow.once("closed", () => {
  //         console.log("Previous display window closed");
  //         resolve();
  //       });

  //       // Force close the window
  //       this.displayWindow.close();
  //     });

  //     // Wait for the window to close, with a timeout
  //     await Promise.race([
  //       closePromise,
  //       new Promise((resolve) => setTimeout(resolve, 1000)), // 1 second timeout
  //     ]);

  //     // Ensure the reference is cleared
  //     this.displayWindow = null;
  //   }

  //   console.log("Creating new display window with URL:", url);

  //   this.displayWindow = new BrowserWindow({
  //     width: 1920,
  //     height: 1080,
  //     fullscreen: true,
  //     alwaysOnTop: true,
  //     webPreferences: {
  //       nodeIntegration: false,
  //       contextIsolation: true,
  //       webSecurity: false, // Allow loading external URLs
  //     },
  //   });

  //   let finalUrl = url;
  //   if (url.includes("youtube.com/embed/")) {
  //     finalUrl = url.replace(
  //       "youtube.com/embed/",
  //       "youtube-nocookie.com/embed/"
  //     );
  //     console.log("Rewrote URL to no-cookie domain:", finalUrl);
  //   }

  //   // Add Referer header interceptor for this window's session (fixes Error 153)
  //   const ses = this.displayWindow.webContents.session;
  //   ses.webRequest.onBeforeSendHeaders(
  //     {
  //       urls: [
  //         "*://*.youtube.com/*",
  //         "*://*.googlevideo.com/*",
  //         "*://*.ytimg.com/*",
  //       ],
  //     },
  //     (details, callback) => {
  //       // Only add if missing; use a safe YouTube referrer
  //       if (!details.requestHeaders["Referer"]) {
  //         details.requestHeaders["Referer"] = "https://www.youtube.com/";
  //       }
  //       callback({ requestHeaders: details.requestHeaders });
  //     }
  //   );

  //   this.displayWindow.loadURL(finalUrl);

  //   // Register ESC key to close display window
  //   this.displayWindow.webContents.on("before-input-event", (event, input) => {
  //     if (input.key === "Escape") {
  //       this.displayWindow.close();
  //     }
  //   });

  //   this.displayWindow.on("closed", () => {
  //     console.log("Display window closed event fired");
  //     this.displayWindow = null;
  //   });

  //   // Handle any load failures
  //   this.displayWindow.webContents.on(
  //     "did-fail-load",
  //     (event, errorCode, errorDescription, validatedURL) => {
  //       console.error(`Failed to load URL: ${validatedURL}`, errorDescription);
  //     }
  //   );
  // }

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
