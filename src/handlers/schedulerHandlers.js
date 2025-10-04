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
    this.setupHandlers();
    this.currentPlaingContent = null; // Track currently playing content
    this.windowHandlers = null;
    this.isOfflineMode = new Map(); // Track offline state per screen
  }

  setDbService(dbService) {
    this.dbService = dbService;
  }

  setupHandlers() {
    // Start content scheduler for a specific screen
    ipcMain.handle("start-content-scheduler", async (event, config) => {
      //need this
      try {
        const databaseService = new DatabaseService();
        const refreshInfo = await databaseService.getNextRefreshTime(
          config.scrId
        );
        let refreshTime = new Date(Date.now() + 1 * 60 * 1000);
        if (!refreshInfo || !refreshInfo.NxtRefreshTime) {
          console.warn("No next refresh time found, using default 1 minute");
        }

        if (refreshInfo.NxtRefreshTime != null) {
          refreshTime = new Date(refreshInfo.NxtRefreshTime);
        }

        console.log("===================Refresh Time:", refreshTime);

        const now = new Date();

        console.log("===================Current Time:", now);

        const refreshInterval = refreshTime.getTime() - now.getTime();
        console.log(
          "===================Calculated refresh interval (ms):",
          refreshInterval
        );

        const { scrId } = config;

        // Stop existing scheduler if running
        this.stopSchedulerForScreen(scrId);

        // Start new scheduler
        const content = await this.startSchedulerForScreen(
          scrId,
          refreshInterval
        );

        console.log("Content after starting scheduler:", content);

        return {
          success: true,
          message: `Content scheduler started for screen ${scrId}`,
          data: content,
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
      //need this
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

    // Update refresh interval
    // ipcMain.handle(
    //   //need this
    //   "update-refresh-interval",
    //   async (event, { scrId, interval }) => {
    //     try {
    //       // Update the refresh interval
    //       this.refreshIntervals.set(scrId, interval);

    //       // Restart scheduler with new interval if it's running
    //       if (this.schedulerStatus.get(scrId) === "running") {
    //         this.stopSchedulerForScreen(scrId);
    //         this.startSchedulerForScreen(scrId, interval);
    //       }

    //       return {
    //         success: true,
    //         message: "Refresh interval updated",
    //       };
    //     } catch (error) {
    //       console.error("Error updating refresh interval:", error);
    //       return {
    //         success: false,
    //         error: error.message,
    //       };
    //     }
    //   }
    // );

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
              (start < itemEnd && end > itemStart) || // Overlap
              (itemStart < end && itemEnd > start) // Reverse overlap
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
  }

  // async checkInternetConnection(ip = "142.250.67.36") {
  //   try {
  //     const res = await ping.promise.probe(ip, { timeout: 3 });
  //     if (res.alive) {
  //       console.log(`Host ${ip} is reachable (ping success)`);
  //       return true;
  //     } else {
  //       console.log(`Host ${ip} is not reachable (ping failed)`);
  //       return false;
  //     }
  //   } catch (err) {
  //     console.error("Ping error:", err);
  //     return false;
  //   }
  // }
  async checkInternetConnection(ip = "10.76.152.20") {
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
    //need this
    console.log(`=========Checking Device Status ${scrId}:`);

    try {
      const databaseService = new DatabaseService();
      // Get current content for the screen
      const contentResult = await databaseService.getCurrentContentForDevice(
        scrId
      );

      console.log(`=========Checking Device Status ${scrId}:`);

      if (!contentResult || contentResult.length === 0) {
        console.log(`No content found for ${scrId}, marking inactive.`);
        return { isActive: false };
      } else {
        return { isActive: true };
      }
    } catch (error) {
      console.error(`Error checking device status for ${scrId}:`, error);
      return { isActive: true }; // Default to active on error
    }
  }

  startSchedulerForScreen(scrId, refreshInterval) {
    try {
      console.log(
        `Starting content scheduler for screen ${scrId} with ${refreshInterval}ms interval`
      );

      this.schedulerStatus.set(scrId, "running");
      this.refreshIntervals.set(scrId, refreshInterval);
      this.isOfflineMode.set(scrId, false);

      let lastOnlineStatus = null;
      let lastDeviceStatus = null;

      // --- Online/Offline watcher (immediate response) ---
      const onlineWatcher = setInterval(async () => {
        try {
          const online = await this.checkInternetConnection();

          if (online !== lastOnlineStatus) {
            if (!online) {
              console.warn(
                `[${scrId}] Lost internet - switching to offline content`
              );
              this.isOfflineMode.set(scrId, true);
              this.currentPlayingContent = await this.getDefaultOfflineContent(
                scrId
              );
            } else {
              console.log(
                `[${scrId}] Internet restored - reloading live content`
              );
              this.isOfflineMode.set(scrId, false);
              console.log("checkAndUpdateContent called from onlineWatcher");
              this.currentPlayingContent = await this.checkAndUpdateContent(
                scrId,
                true
              );
            }

            if (this.windowHandlers) {
              await this.windowHandlers.createDisplayWindow(
                this.currentPlayingContent.Source
              );
            }

            lastOnlineStatus = online;
          }
        } catch (err) {
          console.error(`[${scrId}] Error in online watcher:`, err);
        }
      }, 1000 * 60);
      this.schedulerIntervals.set(scrId + "_onlineWatcher", onlineWatcher);

      // --- Main content scheduler ---
      const interval = setInterval(async () => {
        try {
          console.log(
            `[${scrId}] Refreshing... ${new Date().toLocaleTimeString()}`
          );

          // Check device status first
          const deviceStatus = await this.checkDeviceStatus(scrId);
          const isDeviceActive = deviceStatus && deviceStatus.isActive;

          if (!isDeviceActive) {
            if (lastDeviceStatus !== false) {
              console.warn(
                `[${scrId}] Device deactivated - showing deactivation message`
              );
              this.currentPlayingContent =
                this.getDeviceDeactivatedContent(scrId);

              if (this.windowHandlers) {
                await this.windowHandlers.createDisplayWindow(
                  this.currentPlayingContent.Source
                );
              }
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
            this.currentPlayingContent = await this.checkAndUpdateContent(
              scrId,
              true
            );
          } else {
            // Normal online operation
            console.log("checkAndUpdateContent called from deactive");
            this.currentPlayingContent = await this.checkAndUpdateContent(
              scrId,
              true
            );
          }

          lastDeviceStatus = true;
        } catch (error) {
          console.error(`[${scrId}] Error in scheduler interval:`, error);
        }
      }, refreshInterval);

      this.schedulerIntervals.set(scrId, interval);

      // --- Initial startup check ---
      (async () => {
        try {
          const deviceStatus = await this.checkDeviceStatus(scrId);
          const isDeviceActive = deviceStatus && deviceStatus.isActive;

          if (!isDeviceActive) {
            console.warn(`[${scrId}] Device deactivated at startup`);
            this.currentPlayingContent =
              this.getDeviceDeactivatedContent(scrId);

            if (this.windowHandlers) {
              await this.windowHandlers.createDisplayWindow(
                this.currentPlayingContent.Source
              );
            }
            lastDeviceStatus = false;
            return;
          }

          const online = await this.checkInternetConnection();
          if (!online) {
            console.warn(
              `[${scrId}] No internet at startup — using fallback content`
            );
            this.isOfflineMode.set(scrId, true);
            this.currentPlayingContent = await this.getDefaultOfflineContent(
              scrId
            );

            if (this.windowHandlers) {
              await this.windowHandlers.createDisplayWindow(
                this.currentPlayingContent.Source
              );
            }

            lastOnlineStatus = false;
            lastDeviceStatus = true;
            return;
          }

          // Device active and online
          this.isOfflineMode.set(scrId, false);
          console.log("checkAndUpdateContent called from initial check");
          this.currentPlayingContent = await this.checkAndUpdateContent(
            scrId,
            true
          );
          lastOnlineStatus = true;
          lastDeviceStatus = true;
        } catch (error) {
          console.error(`[${scrId}] Error in initial scheduler run:`, error);
        }
      })();

      console.log(`[${scrId}] Content scheduler started successfully`);
      return this.currentPlayingContent;
    } catch (error) {
      console.error(`Error starting scheduler for screen ${scrId}:`, error);
      this.schedulerStatus.set(scrId, "error");
    }
  }

  getDefaultOfflineContent(scrId) {
    //need this
    const offlinePagePath = path.join(__dirname, "assets", "offline.html");

    return {
      Id: 0,
      ScrId: scrId,
      Type: "url",
      Source: `file://${offlinePagePath.replace(/\\/g, "/")}`,
      Title: "Offline Mode",
    };
  }
  getDeviceDeactivatedContent(scrId) {
    //need this
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
    };
  }

  stopSchedulerForScreen(scrId) {
    //need this
    try {
      console.log(`Stopping content scheduler for screen ${scrId}`);

      // Clear the interval
      const interval = this.schedulerIntervals.get(scrId);
      if (interval) {
        clearInterval(interval);
        this.schedulerIntervals.delete(scrId);
      }

      // Update status
      this.schedulerStatus.set(scrId, "stopped");
      this.isOfflineMode.delete(scrId); // Clean up offline state

      console.log(`Content scheduler stopped for screen ${scrId}`);
    } catch (error) {
      console.error(`Error stopping scheduler for screen ${scrId}:`, error);
    }
  }

  async checkAndUpdateContent(scrId, forceUpdate) {
    console.log(`================ Checking content for screen ${scrId}`);

    try {
      if (this.isOfflineMode.get(scrId)) {
        console.log(
          `[${scrId}] Skipping checkAndUpdateContent — offline mode active`
        );
        return this.currentPlayingContent; // keep showing offline page
      }
      const now = new Date();

      // Fetch content list from DB if not cached or forced
      if (!this.cachedContentList || forceUpdate) {
        console.log(`Fetching content list from DB for screen ${scrId}`);
        this.cachedContentList = null;
        this.defaultIndex = 0;
        const databaseService = new DatabaseService();
        this.cachedContentList = await databaseService.getAllContetent(scrId);

        if (!this.cachedContentList || this.cachedContentList.length === 0) {
          console.log(`No content available for screen ${scrId}`);
          return null;
        }
      } else {
        console.log(`Using cached content list for screen ${scrId}`);
      }

      const contentList = this.cachedContentList;
      console.log("Full Content List:", contentList);

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

      console.log("Scheduled Items:", scheduledItems);

      const defaultItems = contentList
        .filter((c) => c.ScheduleType === "Default")
        .sort((a, b) => {
          if (a.srtOrd != null && b.srtOrd != null) {
            return a.srtOrd - b.srtOrd;
          }
          return new Date(a.CreatedAt) - new Date(b.CreatedAt);
        });

      // Pick scheduled content if active
      const activeScheduled = scheduledItems.find(
        (item) => now >= item.start && now <= item.end
      );

      let nextContent = null;

      if (activeScheduled) {
        nextContent = activeScheduled; // scheduled takes priority
      } else if (defaultItems.length > 0) {
        if (!this.defaultIndex || this.defaultIndex >= defaultItems.length) {
          this.defaultIndex = 0;
        }
        nextContent = defaultItems[this.defaultIndex];
        this.defaultIndex++;
      }

      if (!nextContent) {
        console.log("No valid content to display right now.");
        return null;
      }

      // Update display if content changed
      const prevContent = this.currentPlayingContent;
      const shouldUpdate =
        forceUpdate ||
        !prevContent ||
        prevContent.Source !== nextContent.Source;

      if (shouldUpdate) {
        console.log(`Updating content for screen ${scrId}:`, nextContent);
        this.currentPlayingContent = nextContent;

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

        if (this.windowHandlers) {
          await this.windowHandlers.createDisplayWindow(displayUrl);
          console.log(`Display window updated with URL: ${displayUrl}`);
        } else {
          console.error("WindowHandlers instance not set");
        }
      } else {
        console.log("Content unchanged, no update sent.");
      }

      // ✅ Calculate next check dynamically
      let nextCheckTime = now.getTime() + (nextContent.DurMin || 1) * 60 * 1000; // default fallback

      scheduledItems.forEach((item) => {
        if (
          item.start.getTime() > now.getTime() &&
          item.start.getTime() < nextCheckTime
        ) {
          nextCheckTime = item.start.getTime(); // schedule check right before next scheduled start
        }
      });

      const nextCheckDelay = Math.max(nextCheckTime - now.getTime(), 1000); // at least 1 second
      clearTimeout(this.nextCheckTimer);
      this.nextCheckTimer = setTimeout(() => {
        this.checkAndUpdateContent(scrId, false); // re-check all content
      }, nextCheckDelay);

      console.log(`Next check scheduled in ${nextCheckDelay / 1000} seconds`);

      return nextContent;
    } catch (error) {
      console.error(`Error checking content for screen ${scrId}:`, error);
      return null;
    }
  }

  // async checkAndUpdateContent(scrId, forceUpdate = false) {
  //   console.log(`================Checking content for screen ${scrId}`);

  //   try {
  //     const databaseService = new DatabaseService();
  //     // Get current content for the screen
  //     const contentResult = await databaseService.getCurrentContentForDevice(
  //       scrId
  //     );

  //     console.log(
  //       `Current playing content for screen ${scrId}:`,
  //       this.currentPlayingContent
  //     );

  //     if (contentResult) {
  //       let currentContent = null;
  //       let shouldUpdate = forceUpdate; // Start with forceUpdate flag

  //       // Handle different content types
  //       if (contentResult.type === "DEFAULT_POOL") {
  //         // Check if we need to select a new default content
  //         const needsDefaultUpdate = this.shouldUpdateDefaultContent(
  //           contentResult.items
  //         );
  //         shouldUpdate = shouldUpdate || needsDefaultUpdate;

  //         if (needsDefaultUpdate) {
  //           // Select random default content
  //           const randomIndex = Math.floor(
  //             Math.random() * contentResult.items.length
  //           );
  //           currentContent = contentResult.items[randomIndex];
  //           // Set start time for default content
  //           currentContent.actualStartTime = new Date();
  //         } else {
  //           // Keep current content
  //           currentContent = this.currentPlayingContent;
  //         }
  //       } else {
  //         // Live or Schedule content
  //         currentContent = contentResult;
  //         const prevContent = this.currentPlayingContent;
  //         shouldUpdate =
  //           shouldUpdate ||
  //           !prevContent ||
  //           prevContent.Source !== currentContent.Source;
  //       }

  //       if (shouldUpdate && currentContent) {
  //         console.log(`Updating content for screen ${scrId}:`, currentContent);

  //         this.currentPlayingContent = currentContent;

  //         // Determine display URL
  //         let displayUrl = currentContent.Source;

  //         if (currentContent.Type.toLowerCase() === "url") {
  //           // If it's a YouTube embed or similar, append autoplay & mute if not present
  //           if (displayUrl.includes("youtube.com/embed/")) {
  //             if (!displayUrl.includes("autoplay=1")) {
  //               displayUrl += displayUrl.includes("?")
  //                 ? "&autoplay=1&mute=1"
  //                 : "?autoplay=1&mute=1";
  //             }
  //           }
  //         }

  //         // Use your WindowHandlers instance to open/update the display window
  //         if (this.windowHandlers) {
  //           await this.windowHandlers.createDisplayWindow(displayUrl);
  //           console.log(`Display window updated with URL: ${displayUrl}`);
  //         } else {
  //           console.error("WindowHandlers instance not set");
  //         }
  //       } else {
  //         console.log("Content unchanged, no update sent.");
  //       }

  //       return currentContent;
  //     } else {
  //       console.log(`No content available for screen ${scrId}`);
  //     }
  //   } catch (error) {
  //     console.error(`Error checking content for screen ${scrId}:`, error);
  //   }
  // }
  // Helper method to determine if default content should be updated
  shouldUpdateDefaultContent(availableDefaultItems) {
    const currentContent = this.currentPlayingContent;

    console.log("Checking shouldUpdateDefaultContent...");
    console.log("Current content:", currentContent);
    console.log("Available default items:", availableDefaultItems);

    // If no current content, we need to select one
    if (!currentContent) {
      console.log("No current content — need to select one.");
      return true;
    }

    // If current content is not Default type, we need to select default
    if (
      currentContent.ScheduleType !== "Default" &&
      currentContent.SchedileType !== "Default"
    ) {
      console.log(
        `⚠️ Current content type is not Default (found: ${
          currentContent.ScheduleType || currentContent.SchedileType
        })`
      );
      return true;
    }

    // If current content is no longer in available default items, select new one
    const isCurrentContentStillAvailable = availableDefaultItems.some(
      (item) => item.Source === currentContent.Source
    );
    if (!isCurrentContentStillAvailable) {
      console.log(
        `⚠️ Current content (Id=${currentContent.Source}) not found in available default items.`
      );
      return true;
    } else {
      console.log(
        `✅ Current content (Id=${currentContent.Source}) is still in available default items.`
      );
    }

    // Check if current default content has exceeded its duration
    if (currentContent.actualStartTime && currentContent.DurMin) {
      const now = new Date();
      const playingDuration =
        (now - new Date(currentContent.actualStartTime)) / (1000 * 60); // in minutes

      console.log(
        `⏱️ Playing duration: ${playingDuration.toFixed(
          2
        )} min, Allowed duration: ${currentContent.DurMin} min`
      );

      if (playingDuration >= currentContent.DurMin) {
        console.log(
          `⚠️ Default content ${
            currentContent.Id
          } exceeded duration (${playingDuration.toFixed(1)}/${
            currentContent.DurMin
          } minutes)`
        );
        return true;
      }
    } else {
      console.log(
        "ℹ️ No actualStartTime or DurMin defined for current content."
      );
    }

    console.log("✅ No update needed for default content.");
    return false;
  }

  // Cleanup method
  cleanup() {
    try {
      // Stop all schedulers
      for (const [scrId] of this.schedulerIntervals) {
        this.stopSchedulerForScreen(scrId);
      }

      // Clear all maps
      this.schedulerIntervals.clear();
      this.schedulerStatus.clear();
      this.refreshIntervals.clear();

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
          cuscrIdstomId,
          refreshInterval: this.refreshIntervals.get(scrId),
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
      isRunning: this.schedulerStatus.get(custscrIdomId) === "running",
    };
  }
}

module.exports = SchedulerHandlers;
