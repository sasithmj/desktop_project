const { ipcMain } = require("electron");
const { createFullscreenWindow } = require("../main.js");
const WindowHandlers = require("./windowHandlers.js");
const path = require("path");
const https = require("https");
const DatabaseService = require("../database.js");
const http = require("http");
const ping = require("ping");

class SchedulerHandlers {
  constructor() {
    this.dbService = null;
    this.schedulerIntervals = new Map(); // Map of scrId to interval
    this.schedulerStatus = new Map(); // Map of scrId to status
    this.refreshIntervals = new Map(); // Map of scrId to refresh interval
    this.dbCheckIntervals = new Map(); // Map of scrId to DB check interval
    this.contentTimers = new Map(); // Map of scrId to content playback timer
    this.windowHandlers = null;
    this.currentPlayingContent = new Map(); // Track currently playing content per screen
    this.cachedContentList = new Map(); // Cache content per screen
    this.defaultIndex = new Map(); // Track default content index per screen
    this.isOfflineMode = new Map(); // Track offline state per screen
    this.contentHashMap = new Map(); // Track content hash to detect changes
    this.isUpdatingWindow = new Map(); // Prevent concurrent window updates
    this.lastCheckTime = new Map(); // Track last check time to prevent rapid calls
    this.setupHandlers();
  }

  setDbService(dbService) {
    this.dbService = dbService;
  }

  setupHandlers() {
    // Remove any existing handlers to prevent duplicates
    ipcMain.removeHandler("start-content-scheduler");
    ipcMain.removeHandler("stop-content-scheduler");
    ipcMain.removeHandler("get-scheduler-status");
    ipcMain.removeHandler("get-current-content-for-display");
    ipcMain.removeHandler("validate-content-schedule");
    ipcMain.removeHandler("get-scheduler-statistics");

    // Start content scheduler for a specific screen
    ipcMain.handle("start-content-scheduler", async (event, config) => {
      try {
        const { scrId } = config;

        // Check internet connection status
        const online = await this.checkInternetConnection();
        console.log(
          `[${scrId}] Internet status: ${online ? "Online ✅" : "Offline ❌"}`
        );

        // Stop existing scheduler if running
        this.stopSchedulerForScreen(scrId);

        let refreshInterval = 1 * 60 * 1000; // Default 1 minute

        if (online) {
          // Try to get refresh time from database
          try {
            const databaseService = new DatabaseService();
            const refreshInfo = await databaseService.getNextRefreshTime(scrId);

            if (refreshInfo && refreshInfo.NxtRefreshTime) {
              const refreshTime = new Date(refreshInfo.NxtRefreshTime);
              const now = new Date();
              refreshInterval = refreshTime.getTime() - now.getTime();

              console.log("===================Refresh Time:", refreshTime);
              console.log("===================Current Time:", now);
              console.log(
                "===================Calculated refresh interval (ms):",
                refreshInterval
              );
            } else {
              console.warn(
                "No next refresh time found, using default 1 minute"
              );
            }
          } catch (dbError) {
            console.error("Error fetching refresh time:", dbError);
            console.warn("Using default refresh interval due to DB error");
          }
        } else {
          console.warn(
            `[${scrId}] Starting in offline mode - will monitor for internet recovery`
          );
        }

        // Start scheduler regardless of online status
        // The scheduler will handle offline/online transitions
        const content = await this.startSchedulerForScreen(
          scrId,
          refreshInterval
        );

        console.log("Content after starting scheduler:", content);

        return {
          success: true,
          message: `Content scheduler started for screen ${scrId}`,
          data: content,
          isOffline: !online,
        };
      } catch (error) {
        console.error("Error starting content scheduler:", error);
        return {
          success: false,
          error: error.message,
        };
      }
    });

    // Stop content scheduler
    ipcMain.handle("stop-content-scheduler", async (event, scrId) => {
      try {
        this.stopSchedulerForScreen(scrId);
        return {
          success: true,
          message: "Content scheduler stopped",
        };
      } catch (error) {
        console.error("Error stopping content scheduler:", error);
        return {
          success: false,
          error: error.message,
        };
      }
    });

    // Get scheduler status
    ipcMain.handle("get-scheduler-status", async (event, scrId) => {
      try {
        const status = scrId ? this.schedulerStatus.get(scrId) : "stopped";
        const refreshInterval = scrId
          ? this.refreshIntervals.get(scrId)
          : 5 * 60 * 1000;

        return {
          success: true,
          data: {
            status: status || "stopped",
            refreshInterval: refreshInterval || 5 * 60 * 1000,
            isRunning: status === "running",
          },
        };
      } catch (error) {
        console.error("Error getting scheduler status:", error);
        return {
          success: false,
          error: error.message,
        };
      }
    });

    // Get current content for display
    ipcMain.handle("get-current-content-for-display", async (event, scrId) => {
      try {
        if (!this.dbService) {
          throw new Error("Database service not initialized");
        }

        const currentContent = await this.dbService.getCurrentContentForDevice(
          scrId
        );
        return {
          success: true,
          data: currentContent,
        };
      } catch (error) {
        console.error("Error getting current content for display:", error);
        return {
          success: false,
          error: error.message,
        };
      }
    });

    // Validate content schedule
    ipcMain.handle(
      "validate-content-schedule",
      async (event, { scrId, startTime, duration }) => {
        try {
          if (!this.dbService) {
            throw new Error("Database service not initialized");
          }

          const scheduledContent = await this.dbService.getScheduledContent(
            scrId
          );

          const start = new Date(startTime);
          const end = new Date(start.getTime() + duration * 60 * 1000);

          // Check for conflicts
          const conflicts = scheduledContent.filter((item) => {
            const itemStart = new Date(item.StartTime);
            const itemEnd = new Date(
              itemStart.getTime() + item.DurMin * 60 * 1000
            );

            return (
              (start < itemEnd && end > itemStart) ||
              (itemStart < end && itemEnd > start)
            );
          });

          return {
            success: true,
            data: {
              hasConflicts: conflicts.length > 0,
              conflicts: conflicts,
              isValid: conflicts.length === 0,
            },
          };
        } catch (error) {
          console.error("Error validating content schedule:", error);
          return {
            success: false,
            error: error.message,
          };
        }
      }
    );

    // Get scheduler statistics
    ipcMain.handle("get-scheduler-statistics", async (event, scrId) => {
      try {
        if (!this.dbService) {
          throw new Error("Database service not initialized");
        }

        const [liveContent, scheduledContent, defaultContent] =
          await Promise.all([
            this.dbService.getLiveContent(scrId),
            this.dbService.getScheduledContent(scrId),
            this.dbService.getDefaultContent(scrId),
          ]);

        const totalContent =
          liveContent.length + scheduledContent.length + defaultContent.length;
        const upcomingScheduled = scheduledContent.filter(
          (item) => new Date(item.StartTime) > new Date()
        );

        return {
          success: true,
          data: {
            totalContent,
            liveContent: liveContent.length,
            scheduledContent: scheduledContent.length,
            defaultContent: defaultContent.length,
            upcomingScheduled: upcomingScheduled.length,
            isRunning: this.schedulerStatus.get(scrId) === "running",
            refreshInterval: this.refreshIntervals.get(scrId) || 5 * 60 * 1000,
          },
        };
      } catch (error) {
        console.error("Error getting scheduler statistics:", error);
        return {
          success: false,
          error: error.message,
        };
      }
    });

    // Get current content with internet check
    ipcMain.handle("get-current-content", async (event, scrId) => {
      console.log(`[${scrId}] Getting content........`);
      try {
        // Check internet connection first
        const online = await this.checkInternetConnection();
        console.log(
          `[${scrId}] Internet status: ${online ? "Online ✅" : "Offline ❌"}`
        );

        if (!online) {
          console.warn(
            `[${scrId}] No internet connection - returning offline content`
          );

          // Return offline fallback content
          const offlineContent = this.getDefaultOfflineContent(scrId);

          return {
            success: true,
            isOffline: true,
            data: [offlineContent],
            message: "No internet connection - showing offline content",
          };
        }

        // Internet available - fetch from database
        const databaseService = new DatabaseService();
        const currentContent = await databaseService.getAllContetent(scrId);

        console.log(
          `[${scrId}] Content fetched from DB:`,
          currentContent?.length || 0,
          "items"
        );

        if (!currentContent || currentContent.length === 0) {
          console.warn(`[${scrId}] No content found in database`);

          // Return empty/deactivated content
          const deactivatedContent = this.getDeviceDeactivatedContent(scrId);

          return {
            success: true,
            isEmpty: true,
            data: [deactivatedContent],
            message: "No content available for this screen",
          };
        }

        return {
          success: true,
          isOffline: false,
          data: currentContent,
        };
      } catch (error) {
        console.error(`[${scrId}] Error getting current content:`, error);

        // Return error with offline fallback
        const offlineContent = this.getDefaultOfflineContent(scrId);

        return {
          success: false,
          error: error.message,
          data: [offlineContent],
          message: "Error fetching content - showing offline page",
        };
      }
    });
  }

  async updateRefreshInterval(scrId) {
    try {
      const databaseService = new DatabaseService();
      const refreshInfo = await databaseService.getNextRefreshTime(scrId);

      if (refreshInfo && refreshInfo.NxtRefreshTime) {
        const refreshTime = new Date(refreshInfo.NxtRefreshTime);
        const now = new Date();
        let refreshInterval = refreshTime.getTime() - now.getTime();

        console.log(
          "Updating new New refresh===================Refresh Time:",
          refreshTime
        );
        console.log("===================Current Time:", now);
        console.log(
          "===================Calculated refresh interval (ms):",
          refreshInterval
        );
        this.refreshIntervals.set(scrId, refreshInterval);
      } else {
        console.warn("No next refresh time found, using default 1 minute");
      }
    } catch (error) {
      console.error(`[${scrId}] Error updating refresh interval:`, error);
      return this.refreshIntervals.get(scrId) || 60000;
    }
  }

  async checkInternetConnection(ip = "142.251.43.36") {
    try {
      const res = await ping.promise.probe(ip, { timeout: 3 });
      if (res.alive) {
        console.log(`Host ${ip} is reachable (ping success)`);
        return true;
      } else {
        console.log(`Host ${ip} is not reachable (ping failed)`);
        return false;
      }
    } catch (err) {
      console.error("Ping error:", err);
      return false;
    }
  }

  async checkDeviceStatus(scrId) {
    console.log(`=========Checking Device Status ${scrId}:`);

    try {
      const databaseService = new DatabaseService();
      const contentResult = await databaseService.getCurrentContentForDevice(
        scrId
      );

      if (!contentResult || contentResult.length === 0) {
        console.log(`No content found for ${scrId}, marking inactive.`);
        return { isActive: false };
      } else {
        return { isActive: true };
      }
    } catch (error) {
      console.error(`Error checking device status for ${scrId}:`, error);
      return { isActive: true };
    }
  }

  // Generate hash of content list to detect changes
  generateContentHash(contentList) {
    if (!contentList || contentList.length === 0) return "";

    const sortedContent = [...contentList].sort((a, b) => a.Id - b.Id);
    const hashString = sortedContent
      .map(
        (c) =>
          `${c.Id}-${c.Source}-${c.StartTime}-${c.DurMin}-${c.ScheduleType}-${c.srtOrd}`
      )
      .join("|");

    return hashString;
  }

  // Check if content has changed in database
  async hasContentChanged(scrId) {
    try {
      const databaseService = new DatabaseService();
      const newContentList = await databaseService.getAllContetent(scrId);

      const newHash = this.generateContentHash(newContentList);
      const oldHash = this.contentHashMap.get(scrId) || "";

      if (newHash !== oldHash) {
        console.log(`[${scrId}] Content changed in database!`);
        console.log(`Old hash: ${oldHash.substring(0, 50)}...`);
        console.log(`New hash: ${newHash.substring(0, 50)}...`);
        return { changed: true, newContent: newContentList, newHash };
      }

      return { changed: false };
    } catch (error) {
      console.error(`[${scrId}] Error checking content changes:`, error);
      return { changed: false };
    }
  }

  // Check if currently playing content still exists and is valid
  isCurrentContentStillValid(scrId, newContentList) {
    const currentContent = this.currentPlayingContent.get(scrId);

    if (!currentContent) {
      return false;
    }

    // Check if current content still exists in new list
    const stillExists = newContentList.find(
      (item) =>
        item.Id === currentContent.Id && item.Source === currentContent.Source
    );

    if (!stillExists) {
      console.log(`[${scrId}] Current content no longer exists in DB`);
      return false;
    }

    // If it's scheduled content, check if it's still within time range
    if (currentContent.ScheduleType === "Scheduled") {
      const now = new Date();
      const start = new Date(currentContent.StartTime);
      const end = new Date(
        start.getTime() + (currentContent.DurMin || 1) * 60 * 1000
      );

      if (now < start || now > end) {
        console.log(
          `[${scrId}] Scheduled content is no longer in valid time range`
        );
        return false;
      }
    }

    console.log(
      `[${scrId}] Current content is still valid, continuing playback`
    );
    return true;
  }

  startSchedulerForScreen(scrId, refreshInterval) {
    try {
      console.log(
        `Starting content scheduler for screen ${scrId} with ${refreshInterval}ms interval and continuous DB monitoring`
      );

      this.schedulerStatus.set(scrId, "running");
      this.refreshIntervals.set(scrId, refreshInterval);
      this.isOfflineMode.set(scrId, false);
      this.defaultIndex.set(scrId, 0);
      this.isUpdatingWindow.set(scrId, false);

      let lastOnlineStatus = null;
      let lastDeviceStatus = null;

      // --- DATABASE CHANGE MONITOR (checks every 1 minute) ---
      const dbCheckInterval = setInterval(async () => {
        try {
          if (this.isOfflineMode.get(scrId)) {
            console.log(`[${scrId}] Skipping DB check - offline mode`);
            return;
          }

          console.log(`[${scrId}] 🔍 Checking for database changes...`);
          const changeResult = await this.hasContentChanged(scrId);

          if (changeResult.changed) {
            console.log(`[${scrId}] 🔄 DB Content changed - updating cache`);

            // Update cache and hash
            this.cachedContentList.set(scrId, changeResult.newContent);
            this.contentHashMap.set(scrId, changeResult.newHash);

            // Check if currently playing content is still valid
            const isCurrentValid = this.isCurrentContentStillValid(
              scrId,
              changeResult.newContent
            );

            if (!isCurrentValid) {
              console.log(
                `[${scrId}] Current content invalid - switching to new content`
              );
              // Only update if current content is no longer valid
              await this.checkAndUpdateContent(scrId, true);
            } else {
              console.log(
                `[${scrId}] Current content still valid - continuing without interruption`
              );
              // Just update the cache, don't interrupt playback
            }
          } else {
            console.log(`[${scrId}] ✓ No database changes detected`);
          }
        } catch (err) {
          console.error(`[${scrId}] Error in DB check interval:`, err);
        }
      }, 60000); // Check every 1 minute (60000ms)

      this.dbCheckIntervals.set(scrId, dbCheckInterval);

      // --- MAIN CONTENT REFRESH (based on next refresh time from DB) ---
      const mainRefreshInterval = setInterval(async () => {
        try {
          console.log(
            `[${scrId}] 🔄 Main refresh triggered at ${new Date().toLocaleTimeString()}`
          );

          // Check device status first
          const deviceStatus = await this.checkDeviceStatus(scrId);
          const isDeviceActive = deviceStatus && deviceStatus.isActive;

          if (!isDeviceActive) {
            if (lastDeviceStatus !== false) {
              console.warn(
                `[${scrId}] Device deactivated - showing deactivation message`
              );
              const deactivatedContent =
                this.getDeviceDeactivatedContent(scrId);
              this.currentPlayingContent.set(scrId, deactivatedContent);

              await this.safeUpdateWindow(scrId, deactivatedContent.Source);
            }
            lastDeviceStatus = false;
            return; // skip content update if device is deactivated
          }

          // Device active
          const wasOffline = this.isOfflineMode.get(scrId);
          const wasDeactivated = lastDeviceStatus === false;

          if (wasOffline || wasDeactivated) {
            console.log(
              `[${scrId}] Device reactivated or came online — forcing reload of live content`
            );
            this.isOfflineMode.set(scrId, false);
            this.cachedContentList.delete(scrId); // Force fresh fetch
            await this.checkAndUpdateContent(scrId, true);
          } else {
            // Normal online operation - refresh content
            console.log(
              `[${scrId}] Normal refresh - checking and updating content`
            );
            this.cachedContentList.delete(scrId); // Force fresh fetch on main refresh
            await this.checkAndUpdateContent(scrId, true);
          }

          lastDeviceStatus = true;
        } catch (error) {
          console.error(`[${scrId}] Error in main refresh interval:`, error);
        }
      }, this.refreshIntervals.get(scrId));

      this.schedulerIntervals.set(scrId, mainRefreshInterval);

      // --- ONLINE/OFFLINE WATCHER ---
      const onlineWatcher = setInterval(async () => {
        try {
          const online = await this.checkInternetConnection();

          if (online !== lastOnlineStatus) {
            if (!online) {
              console.warn(
                `[${scrId}] Lost internet - switching to offline content`
              );
              this.isOfflineMode.set(scrId, true);
              const offlineContent = this.getDefaultOfflineContent(scrId);
              this.currentPlayingContent.set(scrId, offlineContent);

              await this.safeUpdateWindow(scrId, offlineContent.Source);
            } else {
              console.log(
                `[${scrId}] Internet restored - reloading live content`
              );
              this.isOfflineMode.set(scrId, false);

              // Force refresh from database
              this.cachedContentList.delete(scrId);
              await this.updateRefreshInterval(scrId);
              await this.checkAndUpdateContent(scrId, true);
            }

            lastOnlineStatus = online;
          }
        } catch (err) {
          console.error(`[${scrId}] Error in online watcher:`, err);
        }
      }, 30000); // Check every 30 seconds

      this.schedulerIntervals.set(scrId + "_onlineWatcher", onlineWatcher);

      // --- DEVICE STATUS WATCHER (checks every 60 seconds) ---
      const deviceStatusWatcher = setInterval(async () => {
        try {
          const deviceStatus = await this.checkDeviceStatus(scrId);
          const isDeviceActive = deviceStatus && deviceStatus.isActive;

          if (!isDeviceActive && lastDeviceStatus !== false) {
            console.warn(
              `[${scrId}] Device deactivated - showing deactivation message`
            );
            const deactivatedContent = this.getDeviceDeactivatedContent(scrId);
            this.currentPlayingContent.set(scrId, deactivatedContent);

            await this.safeUpdateWindow(scrId, deactivatedContent.Source);

            lastDeviceStatus = false;
          } else if (isDeviceActive && lastDeviceStatus === false) {
            console.log(`[${scrId}] Device reactivated - reloading content`);
            this.isOfflineMode.set(scrId, false);
            this.cachedContentList.delete(scrId);
            await this.checkAndUpdateContent(scrId, true);
            lastDeviceStatus = true;
          } else if (isDeviceActive) {
            lastDeviceStatus = true;
          }
        } catch (err) {
          console.error(`[${scrId}] Error in device status watcher:`, err);
        }
      }, 60000); // Check every 60 seconds

      this.schedulerIntervals.set(
        scrId + "_deviceWatcher",
        deviceStatusWatcher
      );

      // --- CONTENT PLAYBACK TIMER (dynamic based on content duration) ---
      const scheduleNextContentCheck = async () => {
        try {
          // Safety check: ensure scheduler is still running
          if (this.schedulerStatus.get(scrId) !== "running") {
            console.log(
              `[${scrId}] Scheduler stopped, canceling content timer`
            );
            return;
          }

          const currentContent = this.currentPlayingContent.get(scrId);

          if (!currentContent || this.isOfflineMode.get(scrId)) {
            // Retry in 10 seconds if no content
            const timer = setTimeout(scheduleNextContentCheck, 10000);
            this.contentTimers.set(scrId, timer);
            return;
          }

          // Calculate next check time
          let nextCheckDelay = (currentContent.DurMin || 1) * 60 * 1000;

          // For scheduled content, check if there's a closer scheduled item
          const cachedContent = this.cachedContentList.get(scrId);
          if (cachedContent) {
            const now = new Date();
            const scheduledItems = cachedContent
              .filter((c) => c.ScheduleType === "Scheduled")
              .map((item) => ({
                ...item,
                start: new Date(item.StartTime),
              }))
              .filter((item) => item.start > now)
              .sort((a, b) => a.start - b.start);

            if (scheduledItems.length > 0) {
              const nextScheduledDelay =
                scheduledItems[0].start.getTime() - now.getTime();
              if (nextScheduledDelay < nextCheckDelay) {
                nextCheckDelay = nextScheduledDelay;
                console.log(
                  `[${scrId}] Next check adjusted for scheduled content in ${
                    nextCheckDelay / 1000
                  }s`
                );
              }
            }
          }

          // Ensure minimum delay and maximum delay
          nextCheckDelay = Math.max(nextCheckDelay, 1000); // Min 1 second
          nextCheckDelay = Math.min(nextCheckDelay, 60 * 60 * 1000); // Max 1 hour

          console.log(
            `[${scrId}] Next content check in ${nextCheckDelay / 1000} seconds`
          );

          // Clear previous timer if exists
          const existingTimer = this.contentTimers.get(scrId);
          if (existingTimer) {
            clearTimeout(existingTimer);
          }

          const timer = setTimeout(async () => {
            // Double-check scheduler is still running before executing
            if (this.schedulerStatus.get(scrId) === "running") {
              await this.checkAndUpdateContent(scrId, false);
              scheduleNextContentCheck(); // Schedule next check
            }
          }, nextCheckDelay);

          this.contentTimers.set(scrId, timer);
        } catch (err) {
          console.error(`[${scrId}] Error scheduling next content check:`, err);

          // Clear existing timer on error
          const existingTimer = this.contentTimers.get(scrId);
          if (existingTimer) {
            clearTimeout(existingTimer);
          }

          const timer = setTimeout(scheduleNextContentCheck, 10000); // Retry in 10s on error
          this.contentTimers.set(scrId, timer);
        }
      };

      // --- INITIAL STARTUP ---
      (async () => {
        try {
          // Check internet first
          const online = await this.checkInternetConnection();
          lastOnlineStatus = online;

          console.log(
            `[${scrId}] Initial startup - Internet: ${
              online ? "Online ✅" : "Offline ❌"
            }`
          );

          if (!online) {
            console.warn(
              `[${scrId}] No internet at startup — using fallback content`
            );
            this.isOfflineMode.set(scrId, true);
            const offlineContent = this.getDefaultOfflineContent(scrId);
            this.currentPlayingContent.set(scrId, offlineContent);

            await this.safeUpdateWindow(scrId, offlineContent.Source);

            // Set device status to true (we don't know yet, will check when online)
            lastDeviceStatus = true;
            console.log(
              `[${scrId}] ⏳ Waiting for internet connection to check device status...`
            );
            return;
          }

          // Internet available - check device status
          const deviceStatus = await this.checkDeviceStatus(scrId);
          const isDeviceActive = deviceStatus && deviceStatus.isActive;
          lastDeviceStatus = isDeviceActive;

          if (!isDeviceActive) {
            console.warn(`[${scrId}] Device deactivated at startup`);
            const deactivatedContent = this.getDeviceDeactivatedContent(scrId);
            this.currentPlayingContent.set(scrId, deactivatedContent);

            await this.safeUpdateWindow(scrId, deactivatedContent.Source);
            return;
          }

          // Device active and online - load content
          console.log(
            `[${scrId}] ✅ Device active and online - loading content`
          );
          this.isOfflineMode.set(scrId, false);
          await this.checkAndUpdateContent(scrId, true);

          // Start the dynamic content playback timer
          scheduleNextContentCheck();
        } catch (error) {
          console.error(`[${scrId}] Error in initial scheduler run:`, error);

          // Fallback to offline mode on error
          this.isOfflineMode.set(scrId, true);
          const offlineContent = this.getDefaultOfflineContent(scrId);
          this.currentPlayingContent.set(scrId, offlineContent);
          await this.safeUpdateWindow(scrId, offlineContent.Source);
        }
      })();

      console.log(`[${scrId}] Content scheduler started successfully`);
      console.log(
        `[${scrId}] - Main refresh interval: ${refreshInterval}ms (${
          refreshInterval / 1000
        }s)`
      );
      console.log(`[${scrId}] - DB change check: every 60 seconds`);
      console.log(`[${scrId}] - Online check: every 30 seconds`);
      console.log(`[${scrId}] - Device status check: every 60 seconds`);

      return this.currentPlayingContent.get(scrId);
    } catch (error) {
      console.error(`Error starting scheduler for screen ${scrId}:`, error);
      this.schedulerStatus.set(scrId, "error");
    }
  }

  // Safe window update with concurrency protection
  async safeUpdateWindow(scrId, displayUrl) {
    // Prevent concurrent window updates
    if (this.isUpdatingWindow.get(scrId)) {
      console.log(
        `[${scrId}] ⚠️ Window update already in progress, skipping...`
      );
      return false;
    }

    try {
      this.isUpdatingWindow.set(scrId, true);
      console.log(`[${scrId}] 🪟 Starting window update to: ${displayUrl}`);

      if (this.windowHandlers) {
        // Add timeout to prevent hanging
        const updatePromise =
          this.windowHandlers.createDisplayWindow(displayUrl);
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Window update timeout")), 10000)
        );

        await Promise.race([updatePromise, timeoutPromise]);
        console.log(`[${scrId}] ✅ Window updated successfully`);
        return true;
      } else {
        console.error(`[${scrId}] WindowHandlers instance not set`);
        return false;
      }
    } catch (error) {
      console.error(`[${scrId}] Error updating window:`, error);
      return false;
    } finally {
      // Release lock after a short delay
      setTimeout(() => {
        this.isUpdatingWindow.set(scrId, false);
        console.log(`[${scrId}] 🔓 Window update lock released`);
      }, 2000); // Increased to 2 seconds for safety
    }
  }

  getDefaultOfflineContent(scrId) {
    const offlinePagePath = path.join(__dirname, "assets", "offline.html");

    return {
      Id: 0,
      ScrId: scrId,
      Type: "url",
      Source: `file://${offlinePagePath.replace(/\\/g, "/")}`,
      Title: "Offline Mode",
      ScheduleType: "Fallback",
    };
  }

  getDeviceDeactivatedContent(scrId) {
    const deactivatedPagePath = path.join(
      __dirname,
      "assets",
      "DeactivePg.html"
    );

    return {
      Id: 0,
      ScrId: scrId,
      Type: "url",
      Source: `file://${deactivatedPagePath.replace(/\\/g, "/")}`,
      Title: "Deactive Mode",
      ScheduleType: "Fallback",
    };
  }

  stopSchedulerForScreen(scrId) {
    try {
      console.log(`Stopping content scheduler for screen ${scrId}`);

      // Clear all intervals for this screen
      const mainInterval = this.schedulerIntervals.get(scrId);
      if (mainInterval) {
        clearInterval(mainInterval);
        this.schedulerIntervals.delete(scrId);
      }

      const onlineWatcher = this.schedulerIntervals.get(
        scrId + "_onlineWatcher"
      );
      if (onlineWatcher) {
        clearInterval(onlineWatcher);
        this.schedulerIntervals.delete(scrId + "_onlineWatcher");
      }

      const deviceWatcher = this.schedulerIntervals.get(
        scrId + "_deviceWatcher"
      );
      if (deviceWatcher) {
        clearInterval(deviceWatcher);
        this.schedulerIntervals.delete(scrId + "_deviceWatcher");
      }

      const dbCheckInterval = this.dbCheckIntervals.get(scrId);
      if (dbCheckInterval) {
        clearInterval(dbCheckInterval);
        this.dbCheckIntervals.delete(scrId);
      }

      // Clear content timer
      const contentTimer = this.contentTimers.get(scrId);
      if (contentTimer) {
        clearTimeout(contentTimer);
        this.contentTimers.delete(scrId);
      }

      // Clear cached data
      this.schedulerStatus.set(scrId, "stopped");
      this.isOfflineMode.delete(scrId);
      this.refreshIntervals.delete(scrId);
      this.cachedContentList.delete(scrId);
      this.contentHashMap.delete(scrId);
      this.defaultIndex.delete(scrId);
      this.currentPlayingContent.delete(scrId);
      this.isUpdatingWindow.delete(scrId);

      console.log(`Content scheduler stopped for screen ${scrId}`);
    } catch (error) {
      console.error(`Error stopping scheduler for screen ${scrId}:`, error);
    }
  }

  async checkAndUpdateContent(scrId, forceUpdate) {
    const callStack = new Error().stack;
    console.log(
      `================ Checking content for screen ${scrId} (forceUpdate: ${forceUpdate})`
    );
    console.log(`[${scrId}] 📞 Called from:`, callStack.split("\n")[2].trim());

    try {
      if (this.isOfflineMode.get(scrId)) {
        console.log(
          `[${scrId}] Skipping checkAndUpdateContent — offline mode active`
        );
        return this.currentPlayingContent.get(scrId);
      }

      // Prevent rapid repeated calls
      const lastCallTime = this.lastCheckTime?.get(scrId) || 0;
      const now = Date.now();
      if (now - lastCallTime < 500 && !forceUpdate) {
        console.log(
          `[${scrId}] ⚠️ Rapid call detected (${
            now - lastCallTime
          }ms ago), skipping...`
        );
        return this.currentPlayingContent.get(scrId);
      }

      if (!this.lastCheckTime) {
        this.lastCheckTime = new Map();
      }
      this.lastCheckTime.set(scrId, now);

      const currentTime = new Date();

      // Fetch content list from DB if not cached or forced
      let contentList = this.cachedContentList.get(scrId);

      if (!contentList || forceUpdate) {
        console.log(`Fetching fresh content list from DB for screen ${scrId}`);
        const databaseService = new DatabaseService();
        contentList = await databaseService.getAllContetent(scrId);

        if (!contentList || contentList.length === 0) {
          console.log(`No content available for screen ${scrId}`);
          return null;
        }

        // Update cache and hash
        this.cachedContentList.set(scrId, contentList);
        const newHash = this.generateContentHash(contentList);
        this.contentHashMap.set(scrId, newHash);
      } else {
        console.log(`Using cached content list for screen ${scrId}`);
      }

      console.log(`[${scrId}] Content list count: ${contentList.length}`);

      // Separate scheduled and default content
      const scheduledItems = contentList
        .filter((c) => c.ScheduleType === "Scheduled")
        .map((item) => ({
          ...item,
          start: new Date(item.StartTime),
          end: new Date(
            new Date(item.StartTime).getTime() + (item.DurMin || 1) * 60 * 1000
          ),
        }))
        .sort((a, b) => a.start - b.start);

      console.log(`[${scrId}] Scheduled items: ${scheduledItems.length}`);

      const defaultItems = contentList
        .filter((c) => c.ScheduleType === "Default")
        .sort((a, b) => {
          if (a.srtOrd != null && b.srtOrd != null) {
            return a.srtOrd - b.srtOrd;
          }
          return new Date(a.CreatedAt) - new Date(b.CreatedAt);
        });

      console.log(`[${scrId}] Default items: ${defaultItems.length}`);

      // Pick scheduled content if active
      const activeScheduled = scheduledItems.find(
        (item) => currentTime >= item.start && currentTime <= item.end
      );

      let nextContent = null;

      if (activeScheduled) {
        nextContent = activeScheduled;
        console.log(
          `[${scrId}] Playing scheduled content: ${nextContent.Title}`
        );
      } else if (defaultItems.length > 0) {
        let index = this.defaultIndex.get(scrId) || 0;
        if (index >= defaultItems.length) {
          index = 0;
        }
        nextContent = defaultItems[index];
        this.defaultIndex.set(scrId, index + 1);
        console.log(
          `[${scrId}] Playing default content #${index}: ${nextContent.Title}`
        );
      }

      if (!nextContent) {
        console.log("No valid content to display right now.");
        return null;
      }

      // Update display if content changed
      const prevContent = this.currentPlayingContent.get(scrId);
      const shouldUpdate =
        forceUpdate ||
        !prevContent ||
        prevContent.Source !== nextContent.Source ||
        prevContent.Id !== nextContent.Id;

      if (shouldUpdate) {
        console.log(`Updating content for screen ${scrId}:`, nextContent);
        this.currentPlayingContent.set(scrId, nextContent);

        // Build display URL
        let displayUrl = nextContent.Source;
        if (nextContent.Type.toLowerCase() === "url") {
          if (
            displayUrl.includes("youtube.com/embed/") &&
            !displayUrl.includes("autoplay=1")
          ) {
            displayUrl += displayUrl.includes("?")
              ? "&autoplay=1&mute=1"
              : "?autoplay=1&mute=1";
          }
        }

        // Use safe window update with concurrency protection
        await this.safeUpdateWindow(scrId, displayUrl);
      } else {
        console.log(`[${scrId}] Content unchanged, no update needed.`);
      }

      return nextContent;
    } catch (error) {
      console.error(`Error checking content for screen ${scrId}:`, error);
      return null;
    }
  }

  // Cleanup method
  cleanup() {
    try {
      // Stop all schedulers
      for (const [scrId] of this.schedulerStatus) {
        this.stopSchedulerForScreen(scrId);
      }

      // Clear all maps
      this.schedulerIntervals.clear();
      this.schedulerStatus.clear();
      this.refreshIntervals.clear();
      this.dbCheckIntervals.clear();
      this.contentTimers.clear();
      this.cachedContentList.clear();
      this.contentHashMap.clear();
      this.defaultIndex.clear();
      this.currentPlayingContent.clear();
      this.isOfflineMode.clear();
      this.isUpdatingWindow.clear();
      this.lastCheckTime.clear();

      console.log("Scheduler handlers cleaned up");
    } catch (error) {
      console.error("Error during scheduler cleanup:", error);
    }
  }

  // Get all running schedulers
  getRunningSchedulers() {
    const running = [];
    for (const [scrId, status] of this.schedulerStatus) {
      if (status === "running") {
        running.push({
          scrId,
          currentContent: this.currentPlayingContent.get(scrId)?.Title || "N/A",
        });
      }
    }
    return running;
  }

  // Get scheduler info for a specific screen
  getSchedulerInfo(scrId) {
    return {
      status: this.schedulerStatus.get(scrId) || "stopped",
      refreshInterval: this.refreshIntervals.get(scrId) || 5 * 60 * 1000,
      isRunning: this.schedulerStatus.get(scrId) === "running",
      currentContent: this.currentPlayingContent.get(scrId),
      isOffline: this.isOfflineMode.get(scrId) || false,
    };
  }
}

module.exports = SchedulerHandlers;
