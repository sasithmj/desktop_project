const { ipcMain, BrowserWindow, dialog, session } = require("electron");

class WindowHandlers {
  constructor() {
    this.controlPanelVisible = true;
    this.settingsWindow = null;
    this.displayWindow = null;
    this.displaySessionPartition = null;
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
    const finalUrl = this.normalizeDisplayUrl(url);
    const isReusingWindow =
      this.displayWindow && !this.displayWindow.isDestroyed();

    if (isReusingWindow) {
      console.log("Reusing existing display window for URL:", finalUrl);
      const existingSession = this.displayWindow.webContents.session;
      await this.prepareDisplayContent(
        this.displayWindow,
        existingSession,
        finalUrl,
        { isReusingWindow: true }
      );
      this.displayWindow.show();
      this.displayWindow.focus();
      return;
    }

    console.log("Creating new display window with URL:", finalUrl);

    // Use a persistent partition so we can reuse the same window without closing it
    if (!this.displaySessionPartition) {
      this.displaySessionPartition = `persist:display-${Date.now()}`;
    }

    this.displayWindow = new BrowserWindow({
      width: 1920,
      height: 1080,
      fullscreen: true,
      alwaysOnTop: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: false, // Allow loading external URLs
        partition: this.displaySessionPartition,
      },
    });

    const ses = session.fromPartition(this.displaySessionPartition);

    // Register ESC key to close display window
    this.displayWindow.webContents.on("before-input-event", (event, input) => {
      if (input.key === "Escape") {
        this.displayWindow.close();
      }
    });

    this.displayWindow.on("closed", () => {
      console.log("Display window closed event fired");
      this.displayWindow = null;
      this.displaySessionPartition = null;
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

    await this.prepareDisplayContent(this.displayWindow, ses, finalUrl, {
      isReusingWindow,
    });
  }

  normalizeDisplayUrl(url) {
    if (!url) return url;
    let finalUrl = url.trim();
    let rewritten = false;

    if (finalUrl.includes("youtube.com/watch?v=")) {
      const videoId = finalUrl.split("v=")[1]?.split("&")[0];
      if (videoId) {
        finalUrl = `https://www.youtube-nocookie.com/embed/${videoId}`;
        rewritten = true;
      }
    } else if (finalUrl.includes("youtube.com/embed/")) {
      finalUrl = finalUrl.replace(
        "youtube.com/embed/",
        "youtube-nocookie.com/embed/"
      );
      rewritten = true;
    }

    if (rewritten) {
      console.log("Rewrote URL to no-cookie domain:", finalUrl);
    }

    return finalUrl;
  }

  async prepareDisplayContent(window, ses, finalUrl, options = {}) {
    const { isReusingWindow = false } = options;

    if (!window || window.isDestroyed()) {
      console.warn("Display window is not available to load content.");
      return;
    }

    const isYoutubeUrl =
      finalUrl.includes("youtube") || finalUrl.includes("youtube-nocookie");

    if (ses) {
      // Only apply YouTube-specific logic for YouTube URLs
      if (isYoutubeUrl) {
        this.ensureYoutubeInterceptor(ses);
        if (!isReusingWindow) {
          await this.clearDisplaySessionData(ses);
        }
      }
    }

    await this.loadDisplayUrl(window, finalUrl, isYoutubeUrl);
  }

  ensureYoutubeInterceptor(ses) {
    if (ses.__hasYoutubeInterceptor) {
      return;
    }

    ses.webRequest.onBeforeSendHeaders(
      {
        urls: [
          "*://*.youtube.com/*",
          "*://*.googlevideo.com/*",
          "*://*.ytimg.com/*",
        ],
      },
      (details, callback) => {
        details.requestHeaders["Referer"] = "https://www.youtube.com/";
        callback({ requestHeaders: details.requestHeaders });
      }
    );

    ses.__hasYoutubeInterceptor = true;
  }

  async clearDisplaySessionData(ses) {
    return new Promise((resolve) => {
      ses.clearStorageData(
        {
          storages: ["cookies", "localstorage", "sessionstorage"],
          quotas: ["cachestorage"],
        },
        (error) => {
          if (error) {
            console.error("Session clear failed:", error);
          } else {
            console.log("Cleared session data for fresh load");
          }
          resolve();
        }
      );
    });
  }

  async loadDisplayUrl(window, finalUrl, isYoutubeUrl = false) {
    if (!finalUrl) {
      console.warn("No URL provided for display window load.");
      return;
    }

    if (!window || window.isDestroyed()) {
      console.warn("Display window no longer available when loading URL.");
      return;
    }

    // Wait for page to finish loading
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error(`Timeout loading URL: ${finalUrl}`));
      }, 30000); // 30 second timeout

      const cleanup = () => {
        window.webContents.removeListener("did-finish-load", onLoad);
        window.webContents.removeListener("did-fail-load", onFail);
        clearTimeout(timeout);
      };

      const onLoad = () => {
        cleanup();
        console.log("Display window loaded content:", finalUrl);
        resolve();
      };

      const onFail = (event, errorCode, errorDescription, validatedURL) => {
        // Only reject on actual failures, not navigation errors
        if (errorCode !== -3) {
          // -3 is ERR_ABORTED, which is normal for navigation
          cleanup();
          console.error(
            `Failed to load URL: ${validatedURL}`,
            errorDescription
          );
          reject(new Error(`Failed to load: ${errorDescription}`));
        }
      };

      window.webContents.once("did-finish-load", onLoad);
      window.webContents.once("did-fail-load", onFail);

      // Prepare load options
      const loadOptions = {
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
      };

      // Only add YouTube-specific referrer for YouTube URLs
      if (isYoutubeUrl) {
        loadOptions.httpReferrer = {
          url: "https://www.youtube-nocookie.com/",
          policy: "no-referrer-when-downgrade",
        };
      }

      // Small delay to ensure listeners are registered
      setTimeout(() => {
        if (!window || window.isDestroyed()) {
          cleanup();
          reject(new Error("Window destroyed before load"));
          return;
        }

        window.loadURL(finalUrl, loadOptions).catch((error) => {
          cleanup();
          console.error("Failed to start loading URL:", finalUrl, error);
          reject(error);
        });
      }, 50);
    });
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
