const { ipcMain } = require("electron");
const { createFullscreenWindow } = require("../main.js");
const WindowHandlers = require("./windowHandlers.js");
const path = require("path");
const https = require("https");
const DatabaseService = require("../database.js");

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
      try {
      
        const { scrId, refreshInterval = 1 * 60 * 1000 } = config; // Default 5 minutes

        // Stop existing scheduler if running
        this.stopSchedulerForScreen(scrId);

        // Start new scheduler
        const content = await this.startSchedulerForScreen(
          scrId,
          refreshInterval
        );

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
    // ipcMain.handle("start-content-scheduler", async (event, config) => {
    //   try {
    //     if (!this.dbService) {
    //       throw new Error("Database service not initialized");
    //     }

    //     const { scrId, refreshInterval = 1 * 60 * 1000 } = config; // Default 5 minutes

    //     // Stop existing scheduler if running
    //     this.stopSchedulerForScreen(scrId);

    //     // Start new scheduler
    //     const content = await this.startSchedulerForScreen(
    //       scrId,
    //       refreshInterval
    //     );

    //     return {
    //       success: true,
    //       message: `Content scheduler started for screen ${scrId}`,
    //       data: content,
    //     };
    //   } catch (error) {
    //     console.error("Error starting content scheduler:", error);
    //     return {
    //       success: false,
    //       error: error.message,
    //     };
    //   }
    // });

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

    // Update refresh interval
    ipcMain.handle(
      "update-refresh-interval",
      async (event, { scrId, interval }) => {
        try {
          if (!this.dbService) {
            throw new Error("Database service not initialized");
          }

          // Update the refresh interval
          this.refreshIntervals.set(scrId, interval);

          // Restart scheduler with new interval if it's running
          if (this.schedulerStatus.get(scrId) === "running") {
            this.stopSchedulerForScreen(scrId);
            this.startSchedulerForScreen(scrId, interval);
          }

          return {
            success: true,
            message: "Refresh interval updated",
          };
        } catch (error) {
          console.error("Error updating refresh interval:", error);
          return {
            success: false,
            error: error.message,
          };
        }
      }
    );

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

  checkInternetConnection(url = "https://www.google.com") {
    return new Promise((resolve) => {
      https
        .get(url, (res) => resolve(res.statusCode === 200))
        .on("error", () => resolve(false));
    });
  }
  async checkDeviceStatus(scrId) {
    try {
      if (!this.dbService) {
        console.warn("Database service not available for device status check");
        return { isActive: true }; // Default to active if can't check
      }

      const deviceStatus = await this.dbService.getDeviceStatus(scrId);
      console.log(`Device status for ${scrId}:`, deviceStatus);

      return deviceStatus.ScrStatus == "Deactive"
        ? { isActive: false }
        : { isActive: true };
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
      let lastDeviceStatus = null; // Track device activation status

      const interval = setInterval(async () => {
        try {
          // Check device status first
          const deviceStatus = await this.checkDeviceStatus(scrId);
          const isDeviceActive = deviceStatus && deviceStatus.isActive;

          // If device is deactivated
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
            return; // Skip content checking if device is deactivated
          }

          // Device is active - proceed with normal content logic
          const online = await this.checkInternetConnection();

          if (!online) {
            // Going offline or staying offline
            if (lastOnlineStatus !== false) {
              console.warn(
                `[${scrId}] Lost internet switching to fallback content.`
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
            }
            lastOnlineStatus = false;
            lastDeviceStatus = true;
            return;
          }

          // Online and device is active
          const wasOffline = this.isOfflineMode.get(scrId);
          const wasDeactivated = lastDeviceStatus === false;

          if (lastOnlineStatus === false || wasOffline || wasDeactivated) {
            console.log(
              `[${scrId}] Internet restored or device reactivated — forcing reload of live content.`
            );
            this.isOfflineMode.set(scrId, false);
            // Force update when coming back online or device reactivated
            this.currentPlayingContent = await this.checkAndUpdateContent(
              scrId,
              true
            );
          } else {
            // Normal online operation
            this.currentPlayingContent = await this.checkAndUpdateContent(
              scrId,
              false
            );
          }

          lastOnlineStatus = true;
          lastDeviceStatus = true;
        } catch (error) {
          console.error(
            `Error in scheduler interval for screen ${scrId}:`,
            error
          );
        }
      }, refreshInterval);

      this.schedulerIntervals.set(scrId, interval);

      // Initial run
      (async () => {
        try {
          // Check device status first
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

          // Device is active - check internet
          const online = await this.checkInternetConnection();
          if (!online) {
            console.warn(
              `[${scrId}] No internet at startup — using fallback content.`
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

          // Device is active and online
          this.isOfflineMode.set(scrId, false);
          this.currentPlayingContent = await this.checkAndUpdateContent(
            scrId,
            false
          );
          lastOnlineStatus = true;
          lastDeviceStatus = true;
        } catch (error) {
          console.error(`Error in initial scheduler run for ${scrId}:`, error);
        }
      })();

      console.log(`Content scheduler started successfully for screen ${scrId}`);
      return this.currentPlayingContent;
    } catch (error) {
      console.error(`Error starting scheduler for screen ${scrId}:`, error);
      this.schedulerStatus.set(scrId, "error");
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
    };
  }
  getDeviceDeactivatedContent(scrId) {
    const deactivatedPagePath = path.join(
      __dirname,
      "assets",
      "deactivated.html"
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

  // async checkAndUpdateContent(scrId) {
  //   console.log(`================Checking content for screen ${scrId}`);
  //   const currentContentDuration = null;
  //   const currentContentScheduleType = null;

  //   try {
  //     if (!this.dbService) {
  //       console.warn("Database service not available for content check");
  //       return;
  //     }

  //     // Get current content for the screen
  //     const currentContent = await this.dbService.getCurrentContentForDevice(
  //       scrId
  //     );

  //     console.log(
  //       `Current planning content for screen ${scrId}:`,
  //       this.currentPlaingContent
  //     );

  //     if (currentContent) {
  //       console.log(`Current content for screen ${scrId}:`, currentContent);

  //       const prevContent = this.currentPlaingContent;

  //       currentContentDuration = currentContent.DurMin;
  //       currentContentScheduleType = currentContent.ScheduleType;

  //       if(currentContentScheduleType === "Default") {
  //         const startTime = new Date();

  //       }

  //       // Check if content changed (by Id)
  //       if (!prevContent || prevContent.Id !== currentContent.Id) {
  //         this.currentPlaingContent = currentContent;

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
  //           this.windowHandlers.createDisplayWindow(displayUrl);
  //           console.log(`Display window updated with URL: ${displayUrl}`);
  //         } else {
  //           console.error("WindowHandlers instance not set");
  //         }
  //       } else {
  //         console.log("Content unchanged, no update sent.");
  //       }

  //       // Update device status
  //       // await this.dbService.updateDeviceStatus(scrId, true);

  //       return currentContent;
  //     } else {
  //       console.log(`No content available for screen ${scrId}`);
  //     }
  //   } catch (error) {
  //     console.error(`Error checking content for screen ${scrId}:`, error);
  //   }
  // }

  async checkAndUpdateContent(scrId, forceUpdate = false) {
    console.log(`================Checking content for screen ${scrId}`);

    try {
   const databaseService =new DatabaseService();
      // Get current content for the screen
      const contentResult = await databaseService.getCurrentContentForDevice(
        scrId
      );

      console.log(
        `Current playing content for screen ${scrId}:`,
        this.currentPlayingContent
      );

      if (contentResult) {
        let currentContent = null;
        let shouldUpdate = forceUpdate; // Start with forceUpdate flag

        // Handle different content types
        if (contentResult.type === "DEFAULT_POOL") {
          // Check if we need to select a new default content
          const needsDefaultUpdate = this.shouldUpdateDefaultContent(
            contentResult.items
          );
          shouldUpdate = shouldUpdate || needsDefaultUpdate;

          if (needsDefaultUpdate) {
            // Select random default content
            const randomIndex = Math.floor(
              Math.random() * contentResult.items.length
            );
            currentContent = contentResult.items[randomIndex];
            // Set start time for default content
            currentContent.actualStartTime = new Date();
          } else {
            // Keep current content
            currentContent = this.currentPlayingContent;
          }
        } else {
          // Live or Schedule content
          currentContent = contentResult;
          const prevContent = this.currentPlayingContent;
          shouldUpdate =
            shouldUpdate ||
            !prevContent ||
            prevContent.Id !== currentContent.Id;
        }

        if (shouldUpdate && currentContent) {
          console.log(`Updating content for screen ${scrId}:`, currentContent);

          this.currentPlayingContent = currentContent;

          // Determine display URL
          let displayUrl = currentContent.Source;

          if (currentContent.Type.toLowerCase() === "url") {
            // If it's a YouTube embed or similar, append autoplay & mute if not present
            if (displayUrl.includes("youtube.com/embed/")) {
              if (!displayUrl.includes("autoplay=1")) {
                displayUrl += displayUrl.includes("?")
                  ? "&autoplay=1&mute=1"
                  : "?autoplay=1&mute=1";
              }
            }
          }

          // Use your WindowHandlers instance to open/update the display window
          if (this.windowHandlers) {
            await this.windowHandlers.createDisplayWindow(displayUrl);
            console.log(`Display window updated with URL: ${displayUrl}`);
          } else {
            console.error("WindowHandlers instance not set");
          }
        } else {
          console.log("Content unchanged, no update sent.");
        }

        return currentContent;
      } else {
        console.log(`No content available for screen ${scrId}`);
      }
    } catch (error) {
      console.error(`Error checking content for screen ${scrId}:`, error);
    }
  }
  // async checkAndUpdateContent(scrId, forceUpdate = false) {
  //   console.log(`================Checking content for screen ${scrId}`);

  //   try {
  //     if (!this.dbService) {
  //       console.warn("Database service not available for content check");
  //       return;
  //     }

  //     // Get current content for the screen
  //     const contentResult = await this.dbService.getCurrentContentForDevice(
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
  //           prevContent.Id !== currentContent.Id;
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

    // If no current content, we need to select one
    if (!currentContent) {
      return true;
    }

    // If current content is not Default type, we need to select default
    if (currentContent.ScheduleType !== "Default") {
      return true;
    }

    // If current content is no longer in available default items, select new one
    const isCurrentContentStillAvailable = availableDefaultItems.some(
      (item) => item.Id === currentContent.Id
    );
    if (!isCurrentContentStillAvailable) {
      return true;
    }

    // Check if current default content has exceeded its duration
    if (currentContent.actualStartTime && currentContent.DurMin) {
      const now = new Date();
      const playingDuration =
        (now - new Date(currentContent.actualStartTime)) / (1000 * 60); // in minutes

      if (playingDuration >= currentContent.DurMin) {
        console.log(
          `Default content ${
            currentContent.Id
          } has exceeded duration (${playingDuration.toFixed(1)}/${
            currentContent.DurMin
          } minutes)`
        );
        return true;
      }
    }
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
