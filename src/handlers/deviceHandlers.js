const { ipcMain } = require("electron");
const NetworkUtils = require("../mainUtils/NetworkUtils.js");
const DB = require("../database.js");
const DatabaseService = require("../database.js");

class DeviceHandlers {
  constructor() {
    this.networkUtils = new NetworkUtils();
    this.db = new DB();
    this.registerHandlers();
  }

  registerHandlers() {
    ipcMain.handle("get-mac-address", this.getMacAddressHandler.bind(this));
    ipcMain.handle(
      "get-all-mac-addresses",
      this.getAllMacAddressesHandler.bind(this)
    );
    ipcMain.handle(
      "get-network-interfaces",
      this.getNetworkInterfacesHandler.bind(this)
    );
    ipcMain.handle("register-device", this.registerDeviceHandler.bind(this));
    ipcMain.handle(
      "update-device-status",
      this.updateDeviceStatusHandler.bind(this)
    );
    ipcMain.handle("connect-to-db", this.connectToDb.bind(this));
    ipcMain.handle(
      "check-device-exists",
      this.checkDeviceExistsHandler.bind(this)
    );
    ipcMain.handle("get-device-by-mac", this.getDeviceByMacHandler.bind(this));
    ipcMain.handle("get-screenids", this.getScreenIdsHandler.bind(this));
    ipcMain.handle("get-locations", this.getLocationsHandler.bind(this));
    ipcMain.handle("get-plantcodes", this.getPlantCodeHandler.bind(this));
  }

  getMacAddressHandler() {
    return this.networkUtils.getMacAddress();
  }

  getAllMacAddressesHandler() {
    return this.networkUtils.getAllMacAddresses();
  }

  getNetworkInterfacesHandler() {
    return this.networkUtils.getAllNetworkInterfaces();
  }
  connectToDb() {
    return this.db.connect();
  }

  async registerDeviceHandler(event, deviceInfo) {
    try {
      if (!this.dbService) {
        throw new Error("Database service not initialized");
      }

      const result = await this.dbService.registerDevice(
        deviceInfo.macAddress,
        deviceInfo.plantId,
        deviceInfo.location,
        deviceInfo.deviceName
      );

      return { success: true, data: result };
    } catch (error) {
      console.error("Failed to register device:", error);
      return { success: false, error: error.message };
    }
  }

  async updateDeviceStatusHandler(event, scrId, isOnline) {
    try {
      if (!this.dbService) {
        throw new Error("Database service not initialized");
      }

      await this.dbService.updateDeviceStatus(scrId, isOnline);
      return { success: true };
    } catch (error) {
      console.error("Failed to update device status:", error);
      return { success: false, error: error.message };
    }
  }

  async checkDeviceExistsHandler(event, macAddress) {
    try {
      if (!this.dbService) {
        throw new Error("Database service not initialized");
      }

      const exists = await this.dbService.checkDeviceExists(macAddress);
      return { success: true, exists };
    } catch (error) {
      console.error("Failed to check device existence:", error);
      return { success: false, error: error.message };
    }
  }

  // async getDeviceByMacHandler(event, macAddress) {
  //   try {
  //     if (!this.dbService) {
  //       throw new Error("Database service not initialized");
  //     }

  //     const device = await this.dbService.getDeviceByMacAddress(macAddress);
  //     return { success: true, device };
  //   } catch (error) {
  //     console.error("Failed to get device by MAC:", error);
  //     return { success: false, error: error.message };
  //   }
  // }


  async getDeviceByMacHandler(event, macAddress) {
    try {
    
      const databaseService = new DatabaseService(); // now it's an instance

      const device = await databaseService.getDeviceByMacAddress(macAddress);
      console.log("deviceData from soap:",device);
      return { success: true, device };
    } catch (error) {
      console.error("Failed to get device by MAC:", error);
      return { success: false, error: error.message };
    }
  }

  async getScreenIdsHandler(event) {
    try {
      if (!this.dbService) {
        throw new Error("Database service not initialized");
      }

      const screenIds = await this.dbService.getScreenIds();
      return { success: true, data: screenIds };
    } catch (error) {
      console.error("Failed to get screen IDs:", error);
      return { success: false, error: error.message };
    }
  }
  // async getPlantCodeHandler(event) {
  //   try {
  //     if (!this.dbService) {
  //       throw new Error("Database service not initialized");
  //     }

  //     const plantCodes = await this.dbService.getPlantCodes();
  //     return { success: true, data: plantCodes };
  //   } catch (error) {
  //     console.error("Failed to get plantCodes:", error);
  //     return { success: false, error: error.message };
  //   }
  // }
  async getPlantCodeHandler(event) {
    try {
      const databaseService = new DatabaseService(); // now it's an instance
      const plantCodes = await databaseService.getPlantCodes();
      return { success: true, data: plantCodes };
    } catch (error) {
      console.error("Failed to get plantCodes:", error);
      return { success: false, error: error.message };
    }
  }

  async getLocationsHandler(event) {
    try {
      if (!this.dbService) {
        throw new Error("Database service not initialized");
      }

      const locations = await this.dbService.getLocationList();
      return { success: true, data: locations };
    } catch (error) {
      console.error("Failed to get locations:", error);
      return { success: false, error: error.message };
    }
  }

  setDbService(dbService) {
    this.dbService = dbService;
  }
}

module.exports = DeviceHandlers;
