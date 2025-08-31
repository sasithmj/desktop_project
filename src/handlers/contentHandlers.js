const { ipcMain } = require("electron");
const DatabaseService = require("../database");

class ContentHandlers {
  constructor() {
    this.dbService = null;
    this.setupHandlers();
  }

  setDbService(dbService) {
    this.dbService = dbService;
  }

  setupHandlers() {
    // Fetch content items for a specific screen
    ipcMain.handle("fetch-content-items", async (event, scrId) => {
      try {
        if (!this.dbService) {
          throw new Error("Database service not initialized");
        }

        const contentItems = await this.dbService.getContentItemsByScrId(scrId);
        return {
          success: true,
          data: contentItems,
        };
      } catch (error) {
        console.error("Error fetching content items:", error);
        return {
          success: false,
          error: error.message,
        };
      }
    });

    // Get current content for a device
    ipcMain.handle("get-current-content", async (event, scrId) => {
      console.log("Getting content........");
      try {
        const databaseService=new DatabaseService();
        const currentContent = await databaseService.getCurrentContentForDevice(
          scrId
        );
        console.log("Current content for screen:", scrId, currentContent);
        return {
          success: true,
          data: currentContent,
        };
      } catch (error) {
        console.error("Error getting current content:", error);
        return {
          success: false,
          error: error.message,
        };
      }
    });
    // // Get current content for a device
    // ipcMain.handle("get-current-content", async (event, scrId) => {
    //   try {
    //     if (!this.dbService) {
    //       throw new Error("Database service not initialized");
    //     }

    //     const currentContent = await this.dbService.getCurrentContentForDevice(
    //       scrId
    //     );
    //     console.log("Current content for screen:", scrId, currentContent);
    //     return {
    //       success: true,
    //       data: currentContent,
    //     };
    //   } catch (error) {
    //     console.error("Error getting current content:", error);
    //     return {
    //       success: false,
    //       error: error.message,
    //     };
    //   }
    // });

    // Add new content item
    ipcMain.handle("add-content-item", async (event, contentData) => {
      try {
        if (!this.dbService) {
          throw new Error("Database service not initialized");
        }

        const {
          scrId,
          type,
          source,
          duration,
          scheduleStatus,
          startTime,
          title,
        } = contentData;

        const result = await this.dbService.addContentItem(
          scrId,
          type,
          source,
          duration,
          scheduleStatus,
          startTime,
          title
        );

        return {
          success: true,
          data: result,
        };
      } catch (error) {
        console.error("Error adding content item:", error);
        return {
          success: false,
          error: error.message,
        };
      }
    });

    // Update content item
    ipcMain.handle("update-content-item", async (event, { id, updates }) => {
      try {
        if (!this.dbService) {
          throw new Error("Database service not initialized");
        }

        await this.dbService.updateContentItem(id, updates);
        return {
          success: true,
          message: "Content item updated successfully",
        };
      } catch (error) {
        console.error("Error updating content item:", error);
        return {
          success: false,
          error: error.message,
        };
      }
    });

    // Delete content item
    ipcMain.handle("delete-content-item", async (event, id) => {
      try {
        if (!this.dbService) {
          throw new Error("Database service not initialized");
        }

        await this.dbService.deleteContentItem(id);
        return {
          success: true,
          message: "Content item deleted successfully",
        };
      } catch (error) {
        console.error("Error deleting content item:", error);
        return {
          success: false,
          error: error.message,
        };
      }
    });

    // Get scheduled content
    ipcMain.handle("get-scheduled-content", async (event, scrId) => {
      try {
        if (!this.dbService) {
          throw new Error("Database service not initialized");
        }

        const scheduledContent = await this.dbService.getScheduledContent(
          scrId
        );
        console.log("Scheduled content for screen:", scrId, scheduledContent);
        return {
          success: true,
          data: scheduledContent,
        };
      } catch (error) {
        console.error("Error getting scheduled content:", error);
        return {
          success: false,
          error: error.message,
        };
      }
    });

    // Get default content
    ipcMain.handle("get-default-content", async (event, scrId) => {
      try {
        if (!this.dbService) {
          throw new Error("Database service not initialized");
        }

        const defaultContent = await this.dbService.getDefaultContent(scrId);
        console.log("Default content for screen:", scrId, defaultContent);
        return {
          success: true,
          data: defaultContent,
        };
      } catch (error) {
        console.error("Error getting default content:", error);
        return {
          success: false,
          error: error.message,
        };
      }
    });

    // Get live content
    ipcMain.handle("get-live-content", async (event, scrId) => {
      try {
        if (!this.dbService) {
          throw new Error("Database service not initialized");
        }

        const liveContent = await this.dbService.getLiveContent(scrId);
        console.log("Live content for screen:", scrId, liveContent);
        return {
          success: true,
          data: liveContent,
        };
      } catch (error) {
        console.error("Error getting live content:", error);
        return {
          success: false,
          error: error.message,
        };
      }
    });

    // Get content by type and status
    ipcMain.handle(
      "get-content-by-type",
      async (event, { scrId, type, status }) => {
        try {
          if (!this.dbService) {
            throw new Error("Database service not initialized");
          }

          let content;
          switch (status) {
            case "scheduled":
              content = await this.dbService.getScheduledContent(scrId);
              break;
            case "default":
              content = await this.dbService.getDefaultContent(scrId);
              break;
            case "live":
              content = await this.dbService.getLiveContent(scrId);
              break;
            default:
              content = await this.dbService.getContentItemsByScrId(scrId);
          }

          // Filter by type if specified
          if (type && type !== "all") {
            content = content.filter((item) => item.Type === type);
          }

          return {
            success: true,
            data: content,
          };
        } catch (error) {
          console.error("Error getting content by type:", error);
          return {
            success: false,
            error: error.message,
          };
        }
      }
    );

    // Get content by type and status
    ipcMain.handle(
      "get-content-by-scrid",
      async (event, { scrId, type, status }) => {
        try {
          if (!this.dbService) {
            throw new Error("Database service not initialized");
          }

          let content;
          switch (status) {
            case "scheduled":
              content = await this.dbService.getScheduledContent(scrId);
              break;
            case "default":
              content = await this.dbService.getDefaultContent(scrId);
              break;
            case "live":
              content = await this.dbService.getLiveContent(scrId);
              break;
            default:
              content = await this.dbService.getContentItemsByScrId(scrId);
          }

          // Filter by type if specified
          if (type && type !== "all") {
            content = content.filter((item) => item.Type === type);
          }

          return {
            success: true,
            data: content,
          };
        } catch (error) {
          console.error("Error getting content by type:", error);
          return {
            success: false,
            error: error.message,
          };
        }
      }
    );

    // Bulk content operations
    ipcMain.handle("bulk-update-content", async (event, { scrId, updates }) => {
      try {
        if (!this.dbService) {
          throw new Error("Database service not initialized");
        }

        const results = [];
        for (const update of updates) {
          try {
            await this.dbService.updateContentItem(update.id, update.changes);
            results.push({ id: update.id, success: true });
          } catch (error) {
            results.push({
              id: update.id,
              success: false,
              error: error.message,
            });
          }
        }

        return {
          success: true,
          data: results,
        };
      } catch (error) {
        console.error("Error in bulk update:", error);
        return {
          success: false,
          error: error.message,
        };
      }
    });

    // Content scheduling validation
    // ipcMain.handle(
    //   "validate-content-schedule",
    //   async (event, { scrId, startTime, duration }) => {
    //     try {
    //       if (!this.dbService) {
    //         throw new Error("Database service not initialized");
    //       }

    //       // Get all scheduled content for the screen
    //       const scheduledContent = await this.dbService.getScheduledContent(
    //         scrId
    //       );

    //       const start = new Date(startTime);
    //       const end = new Date(start.getTime() + duration * 60 * 1000); // Convert minutes to milliseconds

    //       // Check for conflicts
    //       const conflicts = scheduledContent.filter((item) => {
    //         const itemStart = new Date(item.StartTime);
    //         const itemEnd = new Date(
    //           itemStart.getTime() + item.DurMin * 60 * 1000
    //         );

    //         return (
    //           (start < itemEnd && end > itemStart) || // Overlap
    //           (itemStart < end && itemEnd > start) // Reverse overlap
    //         );
    //       });

    //       return {
    //         success: true,
    //         data: {
    //           hasConflicts: conflicts.length > 0,
    //           conflicts: conflicts,
    //           isValid: conflicts.length === 0,
    //         },
    //       };
    //     } catch (error) {
    //       console.error("Error validating content schedule:", error);
    //       return {
    //         success: false,
    //         error: error.message,
    //       };
    //     }
    //   }
    // );
  }
}

module.exports = ContentHandlers;
