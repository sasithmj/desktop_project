const DeviceHandlers = require("./deviceHandlers.js");
const ConfigHandlers = require("./configHandlers.js");
const ContentHandlers = require("./contentHandlers.js");
const WindowHandlers = require("./windowHandlers.js");
const SchedulerHandlers = require("./schedulerHandlers.js");

class IPCHandlers {
  constructor() {
    this.deviceHandlers = new DeviceHandlers();
    this.configHandlers = new ConfigHandlers();
    this.contentHandlers = new ContentHandlers();
    this.windowHandlers = new WindowHandlers();
    this.schedulerHandlers = new SchedulerHandlers();

    this.schedulerHandlers.windowHandlers = this.windowHandlers;

    // Set up database service sharing
    this.configHandlers.setDbServiceCallback((dbService) => {
      this.deviceHandlers.setDbService(dbService);
      this.contentHandlers.setDbService(dbService);
      this.schedulerHandlers.setDbService(dbService);
    });
  }

  setMainWindow(mainWindow) {
    this.windowHandlers.setMainWindow(mainWindow);
  }

  getWindowHandlers() {
    return this.windowHandlers;
  }

  getConfigHandlers() {
    return this.configHandlers;
  }

  getSchedulerHandlers() {
    return this.schedulerHandlers;
  }

  // Cleanup method for graceful shutdown
  cleanup() {
    try {
      this.schedulerHandlers.cleanup();
      console.log("IPC handlers cleaned up successfully");
    } catch (error) {
      console.error("Error during IPC handlers cleanup:", error);
    }
  }
}

module.exports = IPCHandlers;
